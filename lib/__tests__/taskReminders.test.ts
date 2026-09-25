import { buildTaskReminderPlan } from '../taskReminders';
import type { Task } from '../tasks';

const NOW = new Date('2026-09-22T10:00:00');

const task = (over: Partial<Task> = {}): Task => ({
    id: Math.random().toString(36).slice(2),
    title: 'Task', priority: 2, status: 'open', source: 'app',
    createdAt: '2026-09-01T09:00:00.000Z', updatedAt: '2026-09-01T09:00:00.000Z',
    ...over,
});

describe('when a task reminds you', () => {
    it('fires at the time the user set, on the day it is due', () => {
        const plan = buildTaskReminderPlan([task({ dueDate: '2026-09-25', dueTime: '18:30' })], NOW);
        expect(plan).toHaveLength(1);
        expect(plan[0].date).toEqual(new Date(2026, 8, 25, 18, 30));
    });

    it('uses the start of the user’s day when no time was given', () => {
        const plan = buildTaskReminderPlan([task({ dueDate: '2026-09-25' })], NOW, '07:30');
        expect(plan[0].date).toEqual(new Date(2026, 8, 25, 7, 30));
    });

    it('still reminds later today, but never for a time that has passed', () => {
        const later = buildTaskReminderPlan([task({ dueDate: '2026-09-22', dueTime: '17:00' })], NOW);
        expect(later).toHaveLength(1);
        const gone = buildTaskReminderPlan([task({ dueDate: '2026-09-22', dueTime: '08:00' })], NOW);
        expect(gone).toHaveLength(0);
    });

    it('leaves out finished, cancelled, undated and overdue tasks', () => {
        const plan = buildTaskReminderPlan([
            task({ dueDate: '2026-09-25', status: 'done' }),
            task({ dueDate: '2026-09-25', status: 'cancelled' }),
            task({ dueTime: '09:00' }),
            task({ dueDate: '2026-09-20', dueTime: '09:00' }),
        ], NOW);
        expect(plan).toHaveLength(0);
    });

    it('takes the soonest ones when there are more than it can schedule', () => {
        const plan = buildTaskReminderPlan([
            task({ id: 'c', title: 'Later', dueDate: '2026-12-01' }),
            task({ id: 'a', title: 'Sooner', dueDate: '2026-09-23' }),
            task({ id: 'b', title: 'Middle', dueDate: '2026-10-01' }),
        ], NOW, '09:00', 2);
        expect(plan.map(item => item.task.title)).toEqual(['Sooner', 'Middle']);
    });

    it('ignores a date or time that is not real', () => {
        expect(buildTaskReminderPlan([task({ dueDate: '2026-02-31' })], NOW)).toHaveLength(0);
        const odd = buildTaskReminderPlan([task({ dueDate: '2026-09-25', dueTime: '99:99' })], NOW, '08:00');
        expect(odd[0].date).toEqual(new Date(2026, 8, 25, 8, 0));
    });
});
