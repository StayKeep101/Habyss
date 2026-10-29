import { computeMarks } from '../marks';
import { SHARDS, earnedShards, shardsForDay, walletSeries } from '../shards';
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

    it('start everyone with a hundred, and the line ends where the bets leave it', () => {
        const series = walletSeries({ '2026-10-03': 50 }, { '2026-10-04': -25 }, TODAY);
        expect(series.map(point => point.value)).toEqual([110, 85, 85]);
        expect(walletSeries({}, {}, TODAY)).toEqual([{ date: TODAY, value: SHARDS.starter }]);
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
