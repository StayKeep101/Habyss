import { computeMarks, MARKS, type MarkEvent } from '../marks';
import { SHARDS, dailyCloses, sampleRange, shardMoves, valueAt, walletPoints } from '../shards';
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
        // Added Oct 1 (+1); done Oct 1, 2 and 4 (+15); missed Oct 3 (-2).
        const marks = computeMarks({ habits: [habit()], tasks: [], history: { '2026-10-01': ['h'], '2026-10-02': ['h'], '2026-10-04': ['h'] }, today: TODAY });
        expect(balance(shardMoves(marks.ledger, {}))).toBe(SHARDS.starter + 1 + 15 - 2);
        // Marks, the XP, never lost the 2.
        expect(marks.total).toBe(16);
    });

    it('never go below zero', () => {
        const misses = Array.from({ length: 80 }, (_, index) => event({ date: '2026-10-03', kind: 'miss', points: MARKS.miss.task, title: `m${index}` }));
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
    it('pay for same-day completions while respecting the daily cap', () => {
        const tasks = Array.from({ length: 30 }, (_, index) => task({ id: `t${index}`, status: 'done', createdAt: '2026-10-04T09:00:00', completedAt: '2026-10-04T09:01:00' }));
        const marks = computeMarks({ habits: [], tasks, history: {}, today: TODAY });
        const moves = shardMoves(marks.ledger, {});
        expect(paying(moves).some(move => move.kind === 'complete')).toBe(true);
        expect(moves.reduce((sum, move) => sum + move.amount, 0)).toBe(SHARDS.dailyCap);
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

describe('deletion removes earnings without debt', () => {
    it('removes creation and completion earnings when a task is deleted', () => {
        const completed = task({ status: 'done', completedAt: `${TODAY}T09:00:00` });
        const before = computeMarks({ habits: [], tasks: [completed], history: {}, today: TODAY });
        const after = computeMarks({ habits: [], tasks: [], history: {}, today: TODAY });
        expect(balance(shardMoves(before.ledger, {}))).toBeGreaterThan(SHARDS.starter);
        expect(balance(shardMoves(after.ledger, {}))).toBe(SHARDS.starter);
        expect(balance(shardMoves(after.ledger, {}, [{ at: at(TODAY, 10), amount: -200, reason: 'stake', title: 'Spent' }]))).toBe(0);
    });
});

it('does not let deletion or undo recycle the daily earning allowance', () => {
    const old = event({ id: 'old', points: SHARDS.dailyCap, at: at('2026-10-03', 8) });
    const replacement = event({ id: 'new', points: 10, at: at('2026-10-03', 9) });
    const moves = shardMoves([replacement], {}, [], [old]);
    expect(moves).toHaveLength(1);
    expect(moves[0].amount).toBe(0);
    expect(moves[0].held).toBe('limit');
    expect(balance(moves)).toBe(SHARDS.starter);
    expect(shardMoves([old], {}, [], [old])[0].amount).toBe(SHARDS.dailyCap);
});
