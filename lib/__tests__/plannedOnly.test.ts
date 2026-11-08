import { buildTaskReminderPlan } from '../taskReminders';
import { scheduledMoments } from '../scheduledMoments';

const now = new Date(2026, 10, 6, 8, 0);
const task = { id: 't', title: 'Taxes', status: 'open', dueDate: '2026-11-06', dueTime: '15:00' } as never;

describe('today, only what is planned is reminded of', () => {
    it('a task on today’s timeline: at its place there', () => {
        const plan = buildTaskReminderPlan([task], now, '09:00', 16, { t: { start: 600 } });
        expect(plan[0].date).toEqual(new Date(2026, 10, 6, 10, 0));
    });
    it('a task not on today’s timeline: nothing', () => {
        expect(buildTaskReminderPlan([task], now, '09:00', 16, {})).toEqual([]);
        expect(scheduledMoments([], [task], now, {}, {}, 1, {})).toEqual([]);
    });
    it('the timeline could not be read: the time it was given', () => {
        expect(buildTaskReminderPlan([task], now, '09:00', 16, undefined)[0].date).toEqual(new Date(2026, 10, 6, 15, 0));
    });
});
