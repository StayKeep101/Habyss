import { isLate, lateBy, taskRank, tasksForDay, topTasksForToday, type Task } from '../tasks';

const TODAY = '2026-09-17';

const task = (over: Partial<Task> = {}): Task => ({
    id: Math.random().toString(36).slice(2),
    title: 'Task',
    priority: 2,
    status: 'open',
    source: 'app',
    createdAt: '2026-09-01T09:00:00.000Z',
    updatedAt: '2026-09-01T09:00:00.000Z',
    ...over,
});

describe('what matters today', () => {
    it('puts overdue before due today', () => {
        const overdue = task({ title: 'Overdue', dueDate: '2026-09-15' });
        const today = task({ title: 'Today', dueDate: TODAY });
        expect(topTasksForToday([today, overdue], TODAY).map(t => t.title)).toEqual(['Overdue', 'Today']);
    });

    it('puts due today before undated', () => {
        const undated = task({ title: 'Someday' });
        const today = task({ title: 'Today', dueDate: TODAY });
        expect(topTasksForToday([undated, today], TODAY).map(t => t.title)).toEqual(['Today', 'Someday']);
    });

    it('leaves future work out of today entirely', () => {
        const future = task({ title: 'Next week', dueDate: '2026-09-25' });
        const today = task({ title: 'Today', dueDate: TODAY });
        const result = topTasksForToday([future, today], TODAY);
        // Padding today's list with next week's work is how these lists stop
        // being believed.
        expect(result.map(t => t.title)).toEqual(['Today']);
    });

    it('breaks ties on priority, most important first', () => {
        const low = task({ title: 'Low', dueDate: TODAY, priority: 3 });
        const high = task({ title: 'High', dueDate: TODAY, priority: 1 });
        expect(topTasksForToday([low, high], TODAY).map(t => t.title)).toEqual(['High', 'Low']);
    });

    it('prefers the shorter task when urgency and priority match', () => {
        const long = task({ title: 'Long', dueDate: TODAY, estimatedMinutes: 120 });
        const short = task({ title: 'Short', dueDate: TODAY, estimatedMinutes: 15 });
        expect(topTasksForToday([long, short], TODAY).map(t => t.title)).toEqual(['Short', 'Long']);
    });

    it('never shows a task that is already done', () => {
        const done = task({ title: 'Done', dueDate: TODAY, status: 'done' });
        const open = task({ title: 'Open', dueDate: TODAY });
        expect(topTasksForToday([done, open], TODAY).map(t => t.title)).toEqual(['Open']);
    });

    it('never shows a cancelled task', () => {
        const cancelled = task({ title: 'Cancelled', dueDate: TODAY, status: 'cancelled' });
        expect(topTasksForToday([cancelled], TODAY)).toEqual([]);
    });

    it('returns at most the number asked for', () => {
        const many = Array.from({ length: 10 }, (_, i) => task({ title: `T${i}`, dueDate: TODAY }));
        expect(topTasksForToday(many, TODAY, 3)).toHaveLength(3);
        expect(topTasksForToday(many, TODAY, 5)).toHaveLength(5);
        expect(topTasksForToday(many, TODAY, 0)).toEqual([]);
    });

    it('is stable for tasks that are otherwise equal', () => {
        const first = task({ title: 'First', dueDate: TODAY, createdAt: '2026-09-01T09:00:00.000Z' });
        const second = task({ title: 'Second', dueDate: TODAY, createdAt: '2026-09-02T09:00:00.000Z' });
        expect(topTasksForToday([second, first], TODAY).map(t => t.title)).toEqual(['First', 'Second']);
    });

    it('copes with an empty list', () => {
        expect(topTasksForToday([], TODAY)).toEqual([]);
    });
});

describe('taskRank', () => {
    it('orders the buckets overdue, today, undated, future', () => {
        const overdue = taskRank(task({ dueDate: '2026-09-01' }), TODAY);
        const today = taskRank(task({ dueDate: TODAY }), TODAY);
        const undated = taskRank(task({}), TODAY);
        const future = taskRank(task({ dueDate: '2026-12-01' }), TODAY);
        expect(overdue).toBeLessThan(today);
        expect(today).toBeLessThan(undated);
        expect(undated).toBeLessThan(future);
    });

    it('treats a missing estimate as an ordinary length rather than zero', () => {
        // Otherwise every unestimated task would jump ahead of real short work.
        const unestimated = taskRank(task({ dueDate: TODAY }), TODAY);
        const fiveMinutes = taskRank(task({ dueDate: TODAY, estimatedMinutes: 5 }), TODAY);
        expect(fiveMinutes).toBeLessThan(unestimated);
    });
});

describe('the tasks that belong to a day', () => {
    const DAY = '2026-09-23';

    it('keeps a task finished late on the day it was done, and says how late', () => {
        // Due Monday the 21st, done Wednesday the 23rd at noon.
        const late = task({ id: 'late', dueDate: '2026-09-21', status: 'done', completedAt: new Date(2026, 8, 23, 12).toISOString() });
        expect(tasksForDay([late], DAY, DAY).map(item => item.id)).toEqual(['late']);
        expect(tasksForDay([late], '2026-09-21', DAY)).toEqual([]);
        expect(lateBy(late)).toBe(2);
    });

    it('keeps a task with no day on the day it was ticked', () => {
        const loose = task({ id: 'loose', status: 'done', completedAt: new Date(2026, 8, 23, 9).toISOString() });
        expect(tasksForDay([loose], DAY, DAY).map(item => item.id)).toEqual(['loose']);
        expect(tasksForDay([loose], '2026-09-24', '2026-09-24')).toEqual([]);
    });

    it('a task done on time or early stays on its own day, never late', () => {
        const early = task({ id: 'early', dueDate: '2026-09-25', status: 'done', completedAt: new Date(2026, 8, 23, 9).toISOString() });
        expect(tasksForDay([early], '2026-09-25', DAY).map(item => item.id)).toEqual(['early']);
        expect(lateBy(early)).toBe(0);
    });

    it('shows a task on the day it was given, and on no other', () => {
        const friday = task({ id: 'f', title: 'Call the bank', dueDate: '2026-09-25' });
        expect(tasksForDay([friday], DAY, DAY)).toEqual([]);
        expect(tasksForDay([friday], '2026-09-24', DAY)).toEqual([]);
        expect(tasksForDay([friday], '2026-09-25', DAY).map(item => item.id)).toEqual(['f']);
    });

    it("puts a task with no day on today, but leaves a goal's unplanned to-do in its list", () => {
        const loose = task({ id: 'loose' });
        const todo = task({ id: 'todo', goalId: 'g' });
        expect(tasksForDay([loose, todo], DAY, DAY).map(item => item.id)).toEqual(['loose']);
    });

    it('carries something still open and past its date into today', () => {
        const late = task({ id: 'l', dueDate: '2026-09-20' });
        expect(tasksForDay([late], DAY, DAY).map(item => item.id)).toEqual(['l']);
    });

    it('does not carry it into a past day being read back', () => {
        const late = task({ id: 'l', dueDate: '2026-09-20' });
        expect(tasksForDay([late], '2026-09-22', DAY)).toEqual([]);
        // The day it was actually due still shows it.
        expect(tasksForDay([late], '2026-09-20', DAY).map(item => item.id)).toEqual(['l']);
    });

    it('keeps work with no date at all in today', () => {
        const loose = task({ id: 'u' });
        expect(tasksForDay([loose], DAY, DAY).map(item => item.id)).toEqual(['u']);
        expect(tasksForDay([loose], '2026-09-25', DAY)).toEqual([]);
    });

    it('stops carrying something once it is done', () => {
        const done = task({ id: 'd', dueDate: '2026-09-20', status: 'done' });
        expect(tasksForDay([done], DAY, DAY)).toEqual([]);
        // On its own day it stays, so that day still reads correctly.
        expect(tasksForDay([done], '2026-09-20', DAY).map(item => item.id)).toEqual(['d']);
    });

    it('leaves out anything cancelled', () => {
        expect(tasksForDay([task({ dueDate: TODAY, status: 'cancelled' })], DAY, DAY)).toEqual([]);
    });
});

describe('a task planned for one day, due by a later one', () => {
    const today = '2026-10-20';
    const make = (extra: Partial<Task>): Task => ({ id: 't', title: 'Project', status: 'open', priority: 2, source: 'app', createdAt: '', updatedAt: '', ...extra } as Task);
    it('is late only once its deadline has passed', () => {
        expect(isLate(make({ dueDate: '2026-10-19', deadline: '2026-10-23' }), today)).toBe(false);
        expect(isLate(make({ dueDate: '2026-10-19', deadline: '2026-10-19' }), today)).toBe(true);
        expect(isLate(make({ dueDate: '2026-10-19' }), today)).toBe(true);
        expect(isLate(make({ dueDate: '2026-10-19', status: 'done' }), today)).toBe(false);
    });
});
