import { computeMarks, MARKS, type MarkEvent } from '../marks';
import { SHARDS, dailyCloses, sampleRange, shardMoves, valueAt, walletPoints } from '../shards';
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
const at = (day: string, h: number, m = 0) => new Date(`${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).getTime();
const balance = (moves: ReturnType<typeof shardMoves>, now = at(TODAY, 23)) => { const points = walletPoints(moves, now); return points[points.length - 1].value; };
const paying = (moves: ReturnType<typeof shardMoves>) => moves.filter(move => move.amount !== 0);
const event = (over: Partial<MarkEvent>): MarkEvent => ({ date: '2026-10-03', points: 10, kind: 'complete', item: 'task', title: 'x', ...over });

describe('Shards follow the record: earned by doing, lost by missing', () => {
    it('add, complete and miss exactly as the table says, from a hundred to start', () => {
        // Added Oct 1 (+1); done Oct 1 is the day it was made (no Shards), done Oct 2 and 4 (+10); missed Oct 3 (-2).
        const marks = computeMarks({ habits: [habit()], tasks: [], history: { '2026-10-01': ['h'], '2026-10-02': ['h'], '2026-10-04': ['h'] }, today: TODAY });
        expect(balance(shardMoves(marks.ledger, {}))).toBe(SHARDS.starter + 1 + 10 - 2);
        // Marks, the XP, never lost the 2.
        expect(marks.total).toBe(16);
    });

    it('never go below zero', () => {
        const misses = Array.from({ length: 80 }, (_, index) => event({ date: '2026-10-03', kind: 'miss', points: MARKS.miss.goal, title: `m${index}` }));
        expect(balance(shardMoves(misses, {}))).toBe(0);
    });

    it('land at the moment: a habit at its tick, a miss as the day begins, a task when finished', () => {
        const moves = shardMoves([
            event({ item: 'habit', id: 'h', points: 5 }),
            event({ kind: 'miss', points: -4 }),
            event({ points: 10, at: at('2026-10-03', 15) }),
        ], { 'h:2026-10-03': at('2026-10-03', 9) });
        expect(moves.map(move => [new Date(move.t).getHours(), move.amount])).toEqual([[0, -4], [9, 5], [15, 10]]);
    });
});

describe('Shards cannot be farmed', () => {
    it('pay nothing for finishing something made the same day', () => {
        const tasks = Array.from({ length: 30 }, (_, index) => task({ id: `t${index}`, status: 'done', createdAt: '2026-10-04T09:00:00', completedAt: '2026-10-04T09:01:00' }));
        const marks = computeMarks({ habits: [], tasks, history: {}, today: TODAY });
        const moves = shardMoves(marks.ledger, {});
        expect(paying(moves).filter(move => move.kind === 'complete')).toHaveLength(0);
        // Still listed, saying why, so nobody wonders.
        expect(moves.filter(move => move.kind === 'complete').every(move => move.held === 'same day')).toBe(true);
        expect(moves.some(move => move.kind === 'add' && move.held === 'limit')).toBe(true);
        // Adding them all pays at most the daily cap for adding.
        expect(moves.filter(move => move.kind === 'add').reduce((sum, move) => sum + move.amount, 0)).toBe(SHARDS.addCap);
    });

    it('pay nothing for a habit ticked days after the day it counts for', () => {
        const late = shardMoves([event({ item: 'habit', id: 'h', points: 5 })], { 'h:2026-10-03': at('2026-10-06', 9) });
        expect(paying(late)).toHaveLength(0);
        expect(late[0].held).toBe('late');
        // The next morning is fine: logging yesterday.
        expect(paying(shardMoves([event({ item: 'habit', id: 'h', points: 5 })], { 'h:2026-10-03': at('2026-10-04', 8) }))).toHaveLength(1);
    });

    it('pay a goal only once it has lived a few days, and two milestones a day at most', () => {
        expect(paying(shardMoves([event({ item: 'goal', points: 50, madeOn: '2026-10-02' })], {}))).toHaveLength(0);
        expect(shardMoves([event({ item: 'goal', points: 50, madeOn: '2026-10-02' })], {})[0].held).toBe('new goal');
        expect(paying(shardMoves([event({ item: 'goal', points: 50, madeOn: '2026-09-28' })], {}))).toHaveLength(1);
        const milestones = Array.from({ length: 5 }, (_, index) => event({ item: 'milestone', points: 30, title: `m${index}` }));
        expect(paying(shardMoves(milestones, {}))).toHaveLength(SHARDS.milestonesPerDay);
    });

    it('stop at the daily cap, however much is done', () => {
        const lots = Array.from({ length: 50 }, (_, index) => event({ points: 50, title: `t${index}` }));
        expect(shardMoves(lots, {}).reduce((sum, move) => sum + move.amount, 0)).toBe(SHARDS.dailyCap);
    });
});

describe('the wallet line', () => {
    it('draws each range at its own fineness, ending now, and closes each day for a profile', () => {
        const now = at('2026-10-04', 23);
        const points = walletPoints(shardMoves([event({ date: '2026-10-04', points: 10, at: at('2026-10-04', 12) })], {}), now);
        expect(sampleRange(points, '1H', now)).toHaveLength(31);
        expect(sampleRange(points, '24H', now)).toHaveLength(49);
        expect(valueAt(points, at('2026-10-04', 11))).toBe(100);
        expect(valueAt(points, at('2026-10-04', 13))).toBe(110);
        expect(dailyCloses(points, 2, now)).toEqual([100, 110]);
    });
});

describe('the pool', () => {
    it('pays the winners their stake plus their share of the other side', () => {
        expect(payoutFor(10, 'make', { make: 30, miss: 60 })).toBe(25);
        expect(payoutFor(10, 'make', { make: 30, miss: 60 }, 20)).toBe(30 + Math.floor((60 * 30) / 40));
    });
    it('refunds when nobody is on the other side', () => {
        expect(payoutFor(25, 'miss', { make: 0, miss: 40 })).toBe(25);
    });
    it('says how a settled bet went', () => {
        expect(resultFor({ myStake: { side: 'make', amount: 20, payout: 50 } } as Market)).toBe(30);
        expect(resultFor({ myStake: { side: 'miss', amount: 20, payout: 0 } } as Market)).toBe(-20);
        expect(resultFor({ myStake: null } as Market)).toBeNull();
    });
});
