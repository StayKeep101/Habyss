import { buildWatchHabits, buildWatchTasks } from '../watchSync';
import type { Task } from '../tasks';
import type { Habit } from '../habitsSQLite';

const EVERY_DAY = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const habit = (over: Partial<Habit>): Habit => ({ id: 'h', name: 'Habit', startDate: '2026-10-01', createdAt: '2026-10-01', taskDays: EVERY_DAY, ...over } as Habit);

describe('what the watch shows', () => {
    it('lists today’s habits, unfinished first, with their streaks', () => {
        const list = buildWatchHabits([
            habit({ id: 'read', name: 'Read' }),
            habit({ id: 'run', name: 'Run' }),
            habit({ id: 'old', name: 'Old', isArchived: true }),
        ], { '2026-10-16': ['read'], '2026-10-15': ['read'] }, '2026-10-16');
        expect(list.map(item => [item.id, item.completed, item.streakCount])).toEqual([['run', false, 0], ['read', true, 2]]);
    });
});

describe('the tasks the watch shows', () => {
    const task = (over: Partial<Task>): Task => ({ id: 't', title: 'Task', priority: 2, status: 'open', source: 'app', createdAt: '', updatedAt: '', ...over } as Task);
    it('lists today’s tasks, open first and by time, and leaves out other days', () => {
        const list = buildWatchTasks([
            task({ id: 'late', dueDate: '2026-10-16', dueTime: '18:00' }),
            task({ id: 'early', dueDate: '2026-10-16', dueTime: '08:00' }),
            task({ id: 'done', dueDate: '2026-10-16', status: 'done' }),
            task({ id: 'tomorrow', dueDate: '2026-10-17' }),
            task({ id: 'gone', dueDate: '2026-10-16', status: 'cancelled' }),
        ], '2026-10-16');
        expect(list.map(item => [item.id, item.completed])).toEqual([['early', false], ['late', false], ['done', true]]);
    });
});
