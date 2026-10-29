import { computeMarks } from '../marks';
import { SHARDS, earnedShards, sampleRange, shardsForDay, valueAt, walletTimeline } from '../shards';
import { payoutFor, resultFor, type Market } from '../market';
import type { Habit } from '../habitsSQLite';
import type { Task } from '../tasks';

jest.mock('../supabase', () => ({ getSupabase: () => null }));

const TODAY = '2026-10-05';
const EVERY_DAY = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const habit = (over: Partial<Habit> = {}): Habit => ({
    id: 'h', name: 'Read', startDate: '2026-10-01', createdAt: '2026-10-01T09:00:00', taskDays: EVERY_DAY, ...over,
} as Habit);
const task = (over: Partial<Task> = {}): Task => ({
    id: 't', title: 'Send proposal', priority: 2, status: 'open', source: 'app',
    createdAt: '2026-10-01T09:00:00', updatedAt: '2026-10-01T09:00:00', ...over,
});

describe('Shards are earned only by doing', () => {
    it('come from completions, never from adding or missing', () => {
        const { completedByDay } = computeMarks({
            habits: [habit()], tasks: [task({ status: 'done', completedAt: '2026-10-03T10:00:00' })],
            history: { '2026-10-02': ['h'], '2026-10-03': ['h'] }, today: TODAY,
        });
        // Oct 2: the habit (+5). Oct 3: the habit (+5) and the task (+10). Missed Oct 4 counts for nothing here.
        expect(completedByDay).toEqual({ '2026-10-02': 5, '2026-10-03': 15 });
        expect(earnedShards(completedByDay)).toBe(1 + 3);
    });

    it('cannot be farmed: something made and ticked the same day earns none', () => {
        const tasks = Array.from({ length: 30 }, (_, index) => task({
            id: `t${index}`, status: 'done', createdAt: '2026-10-04T09:00:00', completedAt: '2026-10-04T09:01:00',
        }));
        const fresh = computeMarks({ habits: [habit({ createdAt: '2026-10-04T08:00:00', startDate: '2026-10-04' })], tasks, history: { '2026-10-04': ['h'] }, today: TODAY });
        expect(fresh.completedByDay['2026-10-04'] ?? 0).toBe(0);
        // The Marks are still there: only the Shards are held back.
        expect(fresh.total).toBeGreaterThan(0);
    });

    it('stop at the daily cap, however much is done', () => {
        expect(shardsForDay(5)).toBe(1);
        expect(shardsForDay(4)).toBe(0);
        expect(shardsForDay(10_000)).toBe(SHARDS.dailyCap);
    });

    it('start everyone with a hundred, landing at the moments things were done, and the line ends where the bets leave it', () => {
        const day = (h: number, m = 0) => new Date(`2026-10-04T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).getTime();
        const now = day(23);
        // 50 Marks that day = 10 Shards, across a habit at 9 (weight 5) and a task at 15 (weight 10).
        const timeline = walletTimeline({ '2026-10-04': 50 }, [{ at: day(9), weight: 5 }, { at: day(15), weight: 10 }], [{ at: day(20), amount: -25 }], now);
        expect(valueAt(timeline, day(8))).toBe(100);
        expect(valueAt(timeline, day(10))).toBe(103);
        expect(valueAt(timeline, day(16))).toBe(110);
        expect(valueAt(timeline, day(21))).toBe(85);
        // A day with nothing timed lands at noon.
        expect(valueAt(walletTimeline({ '2026-10-04': 25 }, [], [], now), day(12, 1))).toBe(105);
    });

    it('draws each range at its own fineness, ending now', () => {
        const now = new Date('2026-10-04T23:00:00').getTime();
        const timeline = walletTimeline({}, [], [], now);
        const hour = sampleRange(timeline, '1H', now);
        expect(hour).toHaveLength(31);
        expect(hour[hour.length - 1]).toEqual({ t: now, value: SHARDS.starter });
        expect(sampleRange(timeline, '24H', now)).toHaveLength(49);
    });
});

describe('the pool', () => {
    it('pays the winners their stake plus their share of the other side', () => {
        // 30 on makes it already, 60 on misses it; 10 more on makes it pays 10 + 60 × 10/40.
        expect(payoutFor(10, 'make', { make: 30, miss: 60 })).toBe(25);
        // Adding to a stake counts the whole of it.
        expect(payoutFor(10, 'make', { make: 30, miss: 60 }, 20)).toBe(30 + Math.floor((60 * 30) / 40));
    });

    it('refunds when nobody is on the other side', () => {
        expect(payoutFor(25, 'miss', { make: 0, miss: 40 })).toBe(25);
    });

    it('says how a settled bet went', () => {
        const market = { myStake: { side: 'make', amount: 20, payout: 50 } } as Market;
        expect(resultFor(market)).toBe(30);
        expect(resultFor({ myStake: { side: 'miss', amount: 20, payout: 0 } } as Market)).toBe(-20);
        expect(resultFor({ myStake: null } as Market)).toBeNull();
    });
});
