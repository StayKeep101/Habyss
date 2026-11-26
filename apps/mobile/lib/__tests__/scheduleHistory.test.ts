import type { Habit } from '../habitsSQLite';
import { createHabitRequirement, isHabitScheduledForDate } from '../habitSchedule';
import { changesSchedule, historyAfterChange, parseScheduleHistory, storeScheduleHistory, versionOn } from '../scheduleHistory';

const habit = (overrides: Partial<Habit> = {}): Habit => ({
    id: 'habit', name: 'Read', category: 'mind', createdAt: '2026-01-01', startDate: '2026-01-01',
    type: 'build', color: '#fff', goalPeriod: 'daily', goalValue: 1, unit: 'count',
    taskDays: [], reminders: [], chartType: 'bar', isArchived: false, showMemo: false,
    ...overrides,
});
const date = (value: string) => new Date(`${value}T12:00:00`);
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];

describe('schedule history', () => {
    it('only counts a change to what days it falls on', () => {
        const before = habit({ frequency: 'daily' });
        expect(changesSchedule(before, { name: 'Read more' })).toBe(false);
        expect(changesSchedule(before, { frequency: 'daily' })).toBe(false);
        expect(changesSchedule(before, { frequency: 'weekly', taskDays: WEEKDAYS })).toBe(true);
    });

    it('keeps the old schedule up to yesterday', () => {
        const before = habit({ frequency: 'daily' });
        const eras = historyAfterChange(before, { frequency: 'weekly', taskDays: WEEKDAYS }, '2026-11-24');
        expect(eras).toEqual([{ until: '2026-11-23', recurrence: null, frequency: 'daily', taskDays: [], weekInterval: null }]);
    });

    it('keeps nothing for a habit with no past days, or a second change the same day', () => {
        expect(historyAfterChange(habit({ startDate: '2026-11-24' }), { frequency: 'weekly' }, '2026-11-24')).toBeNull();
        const once = habit({ frequency: 'daily', scheduleHistory: [{ until: '2026-11-23', frequency: 'daily', taskDays: [] }] });
        expect(historyAfterChange(once, { frequency: 'monthly' }, '2026-11-24')).toBeNull();
    });

    it('judges each past day by the schedule it had then', () => {
        // Daily until the 23rd (a Monday), weekdays from the 24th.
        const now = habit({
            frequency: 'weekly', taskDays: WEEKDAYS,
            scheduleHistory: [{ until: '2026-11-23', frequency: 'daily', taskDays: [] }],
        });
        expect(isHabitScheduledForDate(now, date('2026-11-22'))).toBe(true);   // a Sunday, under "daily"
        expect(isHabitScheduledForDate(now, date('2026-11-29'))).toBe(false);  // a Sunday, under "weekdays"
        expect(isHabitScheduledForDate(now, date('2026-11-30'))).toBe(true);
        expect(createHabitRequirement(now)('2026-11-22')).toBe(true);
        expect(createHabitRequirement(now)('2026-11-29')).toBe(false);
        expect(versionOn(now, '2026-11-23').frequency).toBe('daily');
        expect(versionOn(now, '2026-11-24').frequency).toBe('weekly');
    });

    it('round-trips through storage and drops anything malformed', () => {
        const eras = [{ until: '2026-11-23', recurrence: null, frequency: 'daily' as const, taskDays: [], weekInterval: null }];
        expect(parseScheduleHistory(storeScheduleHistory(eras))).toEqual(eras);
        expect(parseScheduleHistory('not json')).toBeUndefined();
        expect(parseScheduleHistory([{ until: 'soon' }])).toBeUndefined();
        expect(storeScheduleHistory(undefined)).toBeNull();
    });
});
