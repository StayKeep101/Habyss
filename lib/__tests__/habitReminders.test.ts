import type { Habit } from '../habitsSQLite';
import { buildHabitReminderPlan } from '../habitReminders';
import { localDateKey } from '../habitSchedule';

const makeHabit = (overrides: Partial<Habit> = {}): Habit => ({
    id: 'read', name: 'Read', category: 'mind', createdAt: '2026-01-01', startDate: '2026-01-01',
    type: 'build', color: '#fff', goalPeriod: 'daily', goalValue: 1, unit: 'times',
    frequency: 'daily', taskDays: [], reminders: ['09:00'], chartType: 'bar', isArchived: false, showMemo: false,
    ...overrides,
});
const now = new Date(2026, 8, 16, 8, 0);
const dates = (habit: Habit, start = now, completed = {}) => buildHabitReminderPlan([habit], start, completed, 4).map(item => localDateKey(item.date));

describe('habit reminder planning', () => {
    it('schedules weekly habits on their selected days only', () => {
        expect(dates(makeHabit({ frequency: 'weekly', taskDays: ['mon', 'wed'] }))).toEqual(['2026-09-16', '2026-09-21', '2026-09-23', '2026-09-28']);
    });
    it('honors every-other-week scheduling across a year boundary', () => {
        const habit = makeHabit({ frequency: 'weekly', startDate: '2025-12-22', taskDays: ['mon'], weekInterval: 2 });
        expect(dates(habit, new Date(2025, 11, 23, 8))).toEqual(['2026-01-05', '2026-01-19', '2026-02-02', '2026-02-16']);
    });
    it('clamps monthly dates to the last day of short months', () => {
        expect(dates(makeHabit({ frequency: 'monthly', startDate: '2026-01-31' }), new Date(2026, 0, 31, 10))).toEqual(['2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
    });
    it('does not turn yearly habits into daily notifications', () => {
        const plan = dates(makeHabit({ frequency: 'yearly', startDate: '2025-09-16' }));
        expect(plan).toEqual(['2026-09-16', '2027-09-16']);
    });
    it('excludes completed habits today while retaining their next occurrence', () => {
        expect(dates(makeHabit(), now, { read: true })[0]).toBe('2026-09-17');
    });
    it('excludes archived goals, disabled reminders, and invalid times', () => {
        expect(buildHabitReminderPlan([
            makeHabit({ isArchived: true }), makeHabit({ isGoal: true }), makeHabit({ reminders: [] }), makeHabit({ reminders: ['25:00', '09:60', 'invalid'] }),
        ], now)).toEqual([]);
    });
    it('respects future starts and inclusive end dates', () => {
        expect(dates(makeHabit({ startDate: '2026-09-18', endDate: '2026-09-19' }))).toEqual(['2026-09-18', '2026-09-19']);
    });
    it('subtracts an offset across midnight from the scheduled day', () => {
        const [reminder] = buildHabitReminderPlan([makeHabit({ frequency: 'weekly', taskDays: ['thu'], reminders: ['00:15'], reminderOffset: 30 })], now, {}, 1);
        expect(localDateKey(reminder.date)).toBe('2026-09-16');
        expect(reminder.date.getHours()).toBe(23);
        expect(reminder.date.getMinutes()).toBe(45);
        expect(reminder.scheduledDate).toBe('2026-09-17');
    });
    it('preserves local wall-clock time across daylight saving', () => {
        const plan = buildHabitReminderPlan([makeHabit({ reminders: ['09:30'] })], new Date(2026, 2, 7, 8), {}, 4);
        expect(plan.map(item => item.date.getHours())).toEqual([9, 9, 9, 9]);
        expect(plan.map(item => item.date.getMinutes())).toEqual([30, 30, 30, 30]);
    });
    it('caps the global queue in chronological order and deduplicates identical times', () => {
        const plan = buildHabitReminderPlan([makeHabit({ id: 'later', reminders: ['10:00'] }), makeHabit({ id: 'earlier', reminders: ['09:00', '09:00'] })], now, {}, 3);
        expect(plan.map(item => item.habit.id)).toEqual(['earlier', 'later', 'earlier']);
        expect(plan).toHaveLength(3);
    });
    it('ignores times already passed today', () => {
        expect(dates(makeHabit(), new Date(2026, 8, 16, 10))[0]).toBe('2026-09-17');
    });
});
