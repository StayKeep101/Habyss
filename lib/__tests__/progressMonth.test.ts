import { dayFill, monthDays, monthTotals } from '../progressMonth';
import type { Habit } from '../habitsSQLite';
import type { Task } from '../tasks';

const EVERY_DAY = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const habit = (over: Partial<Habit> = {}): Habit => ({
    id: 'h', name: 'Run', startDate: '2026-09-01', createdAt: '2026-09-01', taskDays: EVERY_DAY, ...over,
} as Habit);
const task = (over: Partial<Task> = {}): Task => ({
    id: Math.random().toString(36).slice(2), title: 'Task', priority: 2, status: 'open', source: 'app',
    createdAt: '2026-09-01', updatedAt: '2026-09-01', ...over,
});

const base = {
    habits: [habit({ id: 'a' }), habit({ id: 'b' })],
    tasks: [],
    history: {},
    month: new Date(2026, 8, 15),
    today: '2026-09-10',
};

describe('a month of progress', () => {
    it('covers every day of the month', () => {
        expect(monthDays(base)).toHaveLength(30);
    });

    it('splits a day into done, missed and skipped', () => {
        const days = monthDays({
            ...base,
            history: { '2026-09-03': ['a'] },
            skips: { '2026-09-03': ['b'] },
        });
        const third = days.find(day => day.date === '2026-09-03')!;
        expect(third.done).toEqual(['a']);
        expect(third.skipped).toEqual(['b']);
        expect(third.missed).toEqual([]);
        // The skipped habit was not asked for, so the day is complete.
        expect(third.complete).toBe(true);
    });

    it('never calls a day missed before it has happened', () => {
        const days = monthDays(base);
        const future = days.find(day => day.date === '2026-09-20')!;
        expect(future.future).toBe(true);
        expect(future.missed).toEqual([]);
        expect(future.complete).toBe(false);
    });

    it('counts tasks on the day they were finished', () => {
        const days = monthDays({
            ...base,
            tasks: [task({ status: 'done', completedAt: '2026-09-04T09:00:00' })],
        });
        expect(days.find(day => day.date === '2026-09-04')!.tasks).toHaveLength(1);
        expect(days.find(day => day.date === '2026-09-05')!.tasks).toHaveLength(0);
    });

    it('leaves out goals and archived habits', () => {
        const days = monthDays({
            ...base,
            habits: [habit({ id: 'g', isGoal: true }), habit({ id: 'x', isArchived: true })],
        });
        expect(days[0].scheduled).toBe(0);
    });

    it('does not count a day as missed when nothing was scheduled', () => {
        const days = monthDays({ ...base, habits: [habit({ id: 'a', taskDays: ['sun'] })] });
        const monday = days.find(day => day.date === '2026-09-07')!;
        expect(monday.scheduled).toBe(0);
        expect(monday.complete).toBe(false);
        expect(monday.missed).toEqual([]);
    });

    it('totals only the days that have happened', () => {
        const totals = monthTotals(monthDays({
            ...base,
            history: { '2026-09-01': ['a', 'b'], '2026-09-02': ['a'] },
            tasks: [task({ status: 'done', completedAt: '2026-09-02T09:00:00' })],
        }));
        expect(totals.activeDays).toBe(2);
        expect(totals.perfectDays).toBe(1);
        expect(totals.checkIns).toBe(3);
        expect(totals.tasks).toBe(1);
        // 3 of 20 check-ins over the ten days that have happened.
        expect(totals.rate).toBe(15);
        expect(totals.busiest).toBe(2);
    });

    it('reports no rate at all when nothing was ever scheduled', () => {
        expect(monthTotals(monthDays({ ...base, habits: [] })).rate).toBeNull();
    });

    it('fills a day ring by how much of it was done', () => {
        const days = monthDays({ ...base, history: { '2026-09-01': ['a'] } });
        expect(dayFill(days[0])).toBe(0.5);
        expect(dayFill(days[1])).toBe(0);
    });
});
