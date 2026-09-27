import {
    describeDay, onTimeRate, taskStatsForDay,
} from '../taskStats';
import type { Task } from '../tasks';

const DAY = '2026-09-17';

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

describe('a day in tasks', () => {
    it('counts what was due and what got done', () => {
        const stats = taskStatsForDay([
            task({ dueDate: DAY }),
            task({ dueDate: DAY, status: 'done', completedAt: `${DAY}T10:00:00.000Z` }),
        ], DAY);
        expect(stats).toEqual({ due: 2, done: 1, overdue: 0 });
    });

    it('counts an unfinished past task as due and overdue', () => {
        const stats = taskStatsForDay([task({ dueDate: '2026-09-10' })], DAY);
        expect(stats).toEqual({ due: 1, done: 1 - 1, overdue: 1 });
    });

    it('leaves future work out of the day', () => {
        expect(taskStatsForDay([task({ dueDate: '2026-09-30' })], DAY)).toEqual({ due: 0, done: 0, overdue: 0 });
    });

    it('does not count an undated task as due', () => {
        // Something with no date was never asked of today.
        expect(taskStatsForDay([task({})], DAY)).toEqual({ due: 0, done: 0, overdue: 0 });
    });

    it('counts a task finished today even if it had no due date', () => {
        const stats = taskStatsForDay([task({ status: 'done', completedAt: `${DAY}T12:00:00.000Z` })], DAY);
        expect(stats).toEqual({ due: 1, done: 1, overdue: 0 });
    });

    it('ignores cancelled work entirely', () => {
        expect(taskStatsForDay([task({ dueDate: DAY, status: 'cancelled' })], DAY))
            .toEqual({ due: 0, done: 0, overdue: 0 });
    });

    it('does not credit a task completed on another day', () => {
        const stats = taskStatsForDay([task({ status: 'done', completedAt: '2026-09-10T12:00:00.000Z' })], DAY);
        expect(stats.done).toBe(0);
    });
});

describe('on-time rate', () => {
    it('says nothing rather than zero when no dated task is finished', () => {
        // 0% would read as failure when the real answer is "no data".
        expect(onTimeRate([])).toBeNull();
        expect(onTimeRate([task({ dueDate: DAY })])).toBeNull();
    });

    it('counts finishing on the due date as on time', () => {
        expect(onTimeRate([task({ dueDate: DAY, status: 'done', completedAt: `${DAY}T23:00:00.000Z` })])).toBe(100);
    });

    it('counts finishing after the due date as late', () => {
        expect(onTimeRate([
            task({ dueDate: '2026-09-10', status: 'done', completedAt: `${DAY}T09:00:00.000Z` }),
            task({ dueDate: DAY, status: 'done', completedAt: `${DAY}T09:00:00.000Z` }),
        ])).toBe(50);
    });
});

describe('habits and tasks are never blended', () => {
    it('reports each side separately', () => {
        const line = describeDay({ done: 3, scheduled: 4 }, { due: 3, done: 2, overdue: 0 });
        expect(line).toBe('3/4 habits · 2/3 tasks');
        // Never a single combined fraction, which would let tasks hide a missed habit.
        expect(line).not.toContain('5/7');
    });

    it('omits a side that had nothing', () => {
        expect(describeDay({ done: 2, scheduled: 2 }, { due: 0, done: 0, overdue: 0 })).toBe('2/2 habits');
        expect(describeDay({ done: 0, scheduled: 0 }, { due: 2, done: 1, overdue: 0 })).toBe('1/2 tasks');
    });

    it('says so plainly when the day asked for nothing', () => {
        expect(describeDay({ done: 0, scheduled: 0 }, { due: 0, done: 0, overdue: 0 })).toBe('Nothing scheduled');
    });
});

it('counts a late-night completion on its local calendar date', () => {
    const stamp = new Date(2026, 8, 17, 23, 45).toISOString();
    const completed = task({ status: 'done', completedAt: stamp, dueDate: '2026-09-17' });
    expect(taskStatsForDay([completed], '2026-09-17').done).toBe(1);
    expect(taskStatsForDay([completed], '2026-09-18').done).toBe(0);
    expect(onTimeRate([completed])).toBe(100);
});
