import { computeMarks, MARKS, MARKS_LIMITS, multiplierFor, penaltiesOf, rankBand, rankFor, RANKS } from '../marks';
import type { Habit } from '../habitsSQLite';
import type { Task } from '../tasks';

const TODAY = '2026-10-05';
const EVERY_DAY = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const habit = (over: Partial<Habit> = {}): Habit => ({
    id: 'h', name: 'Read', startDate: '2026-10-01', createdAt: '2026-10-01T09:00:00', taskDays: EVERY_DAY, ...over,
} as Habit);

const task = (over: Partial<Task> = {}): Task => ({
    id: 't', title: 'Send proposal', priority: 2, status: 'open', source: 'app',
    createdAt: '2026-10-01T09:00:00', updatedAt: '2026-10-01T09:00:00', ...over,
});

/** The record's net, misses included: what Shards follow (lib/shards.ts). Marks themselves only go up. */
const net = (result: ReturnType<typeof computeMarks>) => result.ledger.reduce((sum, event) => sum + event.points, 0);

describe('marks', () => {
    it('pays for keeping a habit; a miss is on the record but costs no XP, and today is never a miss', () => {
        // Added Oct 1 (+1); done Oct 1, 2, 4 (+15); missed Oct 3 (-2 on the record, nothing in Marks).
        const result = computeMarks({
            habits: [habit()], tasks: [],
            history: { '2026-10-01': ['h'], '2026-10-02': ['h'], '2026-10-04': ['h'] },
            today: TODAY,
        });
        expect(result.total).toBe(16);
        expect(net(result)).toBe(14);
    });

    it('treats a skipped day as neither kept nor missed', () => {
        const result = computeMarks({
            habits: [habit({ startDate: '2026-10-04', createdAt: '2026-10-04T09:00:00' })], tasks: [],
            history: {}, skips: { '2026-10-04': ['h'] }, today: TODAY,
        });
        expect(result.total).toBe(1);
    });

    it('adds, completes and misses tasks', () => {
        const result = computeMarks({
            habits: [],
            tasks: [
                task({ id: 'a', status: 'done', completedAt: '2026-10-02T10:00:00' }), // +2 +10
                task({ id: 'b', dueDate: '2026-10-03' }), // +2 -4
                task({ id: 'c', dueDate: '2026-10-02', status: 'done', completedAt: '2026-10-04T10:00:00' }), // +2 +10 -4 (late)
            ],
            history: {}, today: TODAY,
        });
        expect(result.total).toBe(26);
        expect(net(result)).toBe(18);
    });

    it('rewards a goal reached and charges a goal missed', () => {
        const goal = (id: string, targetDate: string): Habit => habit({ id, isGoal: true, name: id, targetDate });
        const result = computeMarks({
            habits: [goal('won', '2026-10-30'), goal('lost', '2026-10-02')], tasks: [], history: {},
            goalsCompletedOn: { won: '2026-10-03' }, today: TODAY,
        });
        // +5 +5 for adding, +50 for reaching one; -15 for the deadline that passed is on the record only.
        expect(result.total).toBe(60);
        expect(net(result)).toBe(45);
    });

    it('never goes down, however much is missed, and draws a running total ending today', () => {
        const result = computeMarks({
            habits: [habit({ startDate: '2026-09-01', createdAt: '2026-09-01T09:00:00' })], tasks: [], history: {}, today: TODAY,
        });
        expect(result.total).toBe(1);
        expect(result.series[result.series.length - 1]).toEqual({ date: TODAY, value: 1 });
        expect(result.series.every((point, index) => index === 0 || point.value >= result.series[index - 1].value)).toBe(true);
        expect(result.ledger.some(event => event.kind === 'miss')).toBe(true);
        expect(result.events.every(event => event.points > 0)).toBe(true);
    });

    it('takes back what an undone tick earned', () => {
        const base = { habits: [habit({ startDate: TODAY, createdAt: `${TODAY}T09:00:00` })], tasks: [], today: TODAY };
        expect(computeMarks({ ...base, history: { [TODAY]: ['h'] } }).todayChange).toBe(6);
        expect(computeMarks({ ...base, history: {} }).todayChange).toBe(1);
    });
});

describe('ranks', () => {
    it('follows the ladder', () => {
        expect(rankFor(0).rank.name).toBe('Lost');
        expect(rankFor(149).rank.name).toBe('Lost');
        expect(rankFor(150).rank.name).toBe('Beginner');
        expect(rankFor(1499).rank.name).toBe('Consistent');
        expect(rankFor(11999).rank.name).toBe('Timekeeper');
        expect(rankFor(50000)).toMatchObject({ rank: { name: 'Eternal' }, next: null, progress: 1 });
        expect(RANKS).toHaveLength(10);
    });

    it('says how far through the rank you are', () => {
        expect(rankFor(600)).toMatchObject({ rank: { name: 'Growing' }, next: { name: 'Consistent' }, progress: 0.5, toNext: 200 });
    });
});

describe('the league you are in', () => {
    it('is the Marks range of your rank, open-ended at the top', () => {
        expect(rankBand(2)).toEqual({ name: 'Lost', min: 0, max: 150 });
        expect(rankBand(150)).toEqual({ name: 'Beginner', min: 150, max: 400 });
        expect(rankBand(20000)).toEqual({ name: 'Eternal', min: 12000, max: null });
    });
});

describe('sleep', () => {
    it('earns 20 for a night at the goal and loses 20 for a short one', () => {
        const good = computeMarks({ habits: [], tasks: [], history: {}, goodNights: ['2026-10-14', '2026-10-15', '2026-10-16'], today: '2026-10-16' });
        expect(good.total).toBe(60);
        const mixed = computeMarks({ habits: [], tasks: [], history: {}, goodNights: ['2026-10-14', '2026-10-15'], shortNights: ['2026-10-16'], today: '2026-10-16' });
        expect(mixed.total).toBe(40);
        expect(net(mixed)).toBe(20);
        expect(mixed.ledger.filter(event => event.item === 'sleep')).toHaveLength(3);
    });
});

describe('deleting is break-even, never a way up', () => {
    const base = { tasks: [] as Task[], today: TODAY };

    it('takes back everything a finished task earned when it is deleted', () => {
        const before = computeMarks({ habits: [], history: {}, today: TODAY, tasks: [] }).total;
        const done = task({ status: 'done', completedAt: '2026-10-02T10:00:00' });
        expect(computeMarks({ habits: [], history: {}, today: TODAY, tasks: [done] }).total).toBe(before + 12);
        // Deleted: gone from the list, nothing kept (it was never missed).
        expect(penaltiesOf({ habits: [], history: {}, today: TODAY, tasks: [done] }, { tasks: ['t'] })).toEqual([]);
        expect(computeMarks({ habits: [], history: {}, today: TODAY, tasks: [] }).total).toBe(before);
    });

    it('keeps the misses of a deleted habit, so deleting a neglected one does not raise Marks', () => {
        // Kept Oct 1 and 2 (+10, +1 for adding), missed Oct 3 and 4 (-4): 7.
        const input = { ...base, habits: [habit()], history: { '2026-10-01': ['h'], '2026-10-02': ['h'] } };
        const withHabit = net(computeMarks(input));
        const kept = penaltiesOf(input, { habits: ['h'] });
        expect(kept.map(p => [p.date, p.points])).toEqual([['2026-10-04', -2], ['2026-10-03', -2]]);
        const afterDelete = net(computeMarks({ ...base, habits: [], history: input.history, kept }));
        expect(afterDelete).toBeLessThanOrEqual(withHabit);
    });

    it('add then delete straight away changes nothing', () => {
        const fresh = habit({ startDate: TODAY, createdAt: `${TODAY}T09:00:00` });
        const kept = penaltiesOf({ ...base, habits: [fresh], history: {} }, { habits: ['h'] });
        expect(computeMarks({ ...base, habits: [], history: {}, kept }).total).toBe(0);
    });
});

describe("the perfect-day multiplier", () => {
    const day = (offset: number) => { const d = new Date(2026, 9, 1 + offset, 12); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const doneOn = (id: string, on: string) => task({ id, status: 'done', createdAt: `${on}T08:00:00`, completedAt: `${on}T10:00:00`, dueDate: on });
    const three = (offset: number) => [0, 1, 2].map(n => doneOn(`t${offset}-${n}`, day(offset)));

    it('steps up every seven perfect days, to at most ×10', () => {
        expect([0, 6, 7, 13, 14, 63, 70, 200].map(multiplierFor)).toEqual([1, 1, 2, 2, 3, 10, 10, 10]);
    });

    it('doubles everything completed after seven perfect days in a row, but not a miss', () => {
        const tasks = [0, 1, 2, 3, 4, 5, 6, 7].map(three).flat();
        const result = computeMarks({ habits: [], tasks, history: {}, today: day(7), dailyTarget: 3 }, 200);
        expect(result.multiplier).toBe(2);
        const today = result.events.filter(event => event.date === day(7) && event.kind === 'complete');
        expect(today.some(event => event.item === 'focus')).toBe(false);
        expect(today.filter(event => event.item === 'task').every(event => event.points === 20)).toBe(true);
    });

    it('goes back to ×1 after a day that was not perfect', () => {
        // Day 7 had a task due and left undone: the run breaks there.
        const tasks = [...[0, 1, 2, 3, 4, 5, 6, 8].map(three).flat(), task({ id: 'missed', dueDate: day(7) })];
        const result = computeMarks({ habits: [], tasks, history: {}, today: day(9), dailyTarget: 3 }, 200);
        expect(result.multiplier).toBe(1);
    });

});

describe('milestones', () => {
    it('earns +30 for each milestone reached, on the day it was reached', () => {
        const result = computeMarks({
            habits: [], tasks: [], history: {}, today: '2026-10-26',
            milestones: [{ title: 'Finish Book 1', doneAt: new Date(2026, 9, 25, 15).toISOString() }],
        });
        expect(result.total).toBe(30);
        expect(result.events[0]).toMatchObject({ date: '2026-10-25', points: 30, kind: 'complete', item: 'milestone', title: 'Finish Book 1' });
    });
});

describe('marks reward a real day, not a long list', () => {
    it('pays the first habits of a day in full and one for each after', () => {
        // Twenty habits made on Sep 1 (adds there), all kept on Oct 4.
        const many = Array.from({ length: 20 }, (_, index) => habit({ id: `h${index}`, name: `Tiny ${index}`, createdAt: '2026-09-01T09:00:00', startDate: '2026-10-04' }));
        const result = computeMarks({ habits: many, tasks: [], history: { '2026-10-04': many.map(item => item.id) }, today: TODAY });
        const kept = result.series.find(point => point.date === '2026-10-04')!.value - result.series.find(point => point.date === '2026-10-03')!.value;
        expect(kept).toBe(MARKS_LIMITS.fullHabitsPerDay * MARKS.complete.habit + (20 - MARKS_LIMITS.fullHabitsPerDay) * MARKS_LIMITS.extraHabit);
    });

    it('counts at most the daily ceiling for adding things, and keeps the rest on the record', () => {
        const many = Array.from({ length: 20 }, (_, index) => habit({ id: `h${index}`, name: `Tiny ${index}`, createdAt: '2026-10-04T09:00:00', startDate: '2026-10-06' }));
        const result = computeMarks({ habits: many, tasks: [], history: {}, today: TODAY });
        expect(result.total).toBe(MARKS_LIMITS.addsPerDay);
        expect(result.ledger.filter(event => event.kind === 'add')).toHaveLength(20);
    });
});
