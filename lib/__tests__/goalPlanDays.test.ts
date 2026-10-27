import { goalDays, monthGrid, monthsBetween } from '../goalPlanPeriod';
import type { Habit } from '../habitsSQLite';
import type { Task } from '../tasks';
import type { Milestone } from '../goalMilestones';

const habit = (over: Partial<Habit> = {}): Habit => ({
    id: 'run', name: 'Run', startDate: '2026-10-01', createdAt: '2026-10-01', taskDays: ['mon', 'wed', 'fri'], ...over,
} as Habit);
const task = (over: Partial<Task> = {}): Task => ({
    id: 't', title: 'Buy shoes', priority: 2, status: 'open', source: 'app', createdAt: '2026-10-01', updatedAt: '2026-10-01', ...over,
});

describe('a goal day by day', () => {
    it('lists each day of the range with what it asks, milestones first', () => {
        const days = goalDays('2026-10-26', '2026-11-01', {
            habits: [habit()],
            tasks: [task({ dueDate: '2026-10-27' }), task({ id: 'x', dueDate: '2026-10-27', status: 'cancelled' })],
            milestones: [{ id: 'm', title: 'Half', dueDate: '2026-10-28' } as Milestone],
            history: { '2026-10-26': ['run'] },
        });
        expect(days.map(day => day.day)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
        expect(days[0].items).toEqual([expect.objectContaining({ kind: 'habit', title: 'Run', done: true })]);
        expect(days[1].items).toEqual([expect.objectContaining({ kind: 'task', title: 'Buy shoes', done: false })]);
        expect(days[2].items.map(item => item.kind)).toEqual(['milestone', 'habit']);
        expect(days[3].items).toEqual([]);
    });

    it('leaves out a habit skipped that day', () => {
        const [day] = goalDays('2026-10-26', '2026-10-26', { habits: [habit()], tasks: [], milestones: [], history: {}, skips: { '2026-10-26': ['run'] } });
        expect(day.items).toEqual([]);
    });
});

describe('the month grid', () => {
    it('starts October 2026 on a Thursday under a Monday week', () => {
        const rows = monthGrid('2026-10-01', true);
        expect(rows[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
        expect(rows.flat().filter(Boolean)).toHaveLength(31);
        expect(rows.every(row => row.length === 7)).toBe(true);
    });
    it('starts on Sunday when the week does', () => {
        expect(monthGrid('2026-10-15', false)[0].slice(0, 5)).toEqual([null, null, null, null, '2026-10-01']);
    });
    it('names every month from a goal start to its deadline', () => {
        expect(monthsBetween('2026-10-20', '2027-01-05')).toEqual(['2026-10-01', '2026-11-01', '2026-12-01', '2027-01-01']);
    });
});
