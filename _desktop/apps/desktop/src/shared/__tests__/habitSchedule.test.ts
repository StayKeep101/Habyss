import { describe, it, expect } from 'vitest';
import type { Habit } from '../habitsSQLite';
import { isHabitScheduledForDate, localDateKey, parseHabitDate } from '../habitSchedule';

const habit = (overrides: Partial<Habit> = {}): Habit => ({
    id: 'habit', name: 'Read', category: 'mind', createdAt: '2025-01-01', startDate: '2025-01-01',
    type: 'build', color: '#fff', goalPeriod: 'daily', goalValue: 1, unit: 'count',
    taskDays: [], reminders: [], chartType: 'bar', isArchived: false, showMemo: false,
    ...overrides,
});
const date = (value: string) => new Date(`${value}T12:00:00`);

describe('local habit scheduling', () => {
    it('keeps date-only values on the intended local calendar day', () => {
        expect(localDateKey(parseHabitDate('2026-09-16')!)).toBe('2026-09-16');
        expect(isHabitScheduledForDate(habit({ startDate: '2026-09-16' }), new Date(2026, 8, 16, 0, 5))).toBe(true);
        expect(isHabitScheduledForDate(habit({ startDate: '2026-09-17' }), new Date(2026, 8, 16, 23, 55))).toBe(false);
    });

    it('interprets creation timestamps in local time', () => {
        const createdAt = new Date(2026, 8, 16, 22, 30).toISOString();
        expect(localDateKey(parseHabitDate(createdAt)!)).toBe('2026-09-16');
        expect(isHabitScheduledForDate(habit({ startDate: '', createdAt }), date('2026-09-16'))).toBe(true);
    });

    it('respects the inclusive end boundary and the start boundary', () => {
        const bounded = habit({ startDate: '2026-09-10', endDate: '2026-09-16' });
        expect(isHabitScheduledForDate(bounded, date('2026-09-09'))).toBe(false);
        expect(isHabitScheduledForDate(bounded, date('2026-09-10'))).toBe(true);
        expect(isHabitScheduledForDate(bounded, date('2026-09-16'))).toBe(true);
        expect(isHabitScheduledForDate(bounded, date('2026-09-17'))).toBe(false);
        expect(isHabitScheduledForDate({ ...bounded, endDate: '2026-09-14' }, date('2026-09-15'))).toBe(false);
    });

    it('honors chosen weekdays including legacy full day names', () => {
        const weekly = habit({ frequency: 'weekly', taskDays: ['MON', 'Wednesday'] });
        expect(isHabitScheduledForDate(weekly, date('2026-09-14'))).toBe(true);
        expect(isHabitScheduledForDate(weekly, date('2026-09-15'))).toBe(false);
        expect(isHabitScheduledForDate(weekly, date('2026-09-16'))).toBe(true);
    });

    it('continues every-other-week schedules across New Year', () => {
        const weekly = habit({ startDate: '2025-12-22', frequency: 'weekly', taskDays: ['mon'], weekInterval: 2 });
        expect(isHabitScheduledForDate(weekly, date('2025-12-22'))).toBe(true);
        expect(isHabitScheduledForDate(weekly, date('2025-12-29'))).toBe(false);
        expect(isHabitScheduledForDate(weekly, date('2026-01-05'))).toBe(true);
        expect(isHabitScheduledForDate(weekly, date('2026-01-12'))).toBe(false);
    });

    it('uses calendar weeks through daylight saving transitions', () => {
        const weekly = habit({ startDate: '2026-03-02', frequency: 'weekly', taskDays: ['mon'], weekInterval: 2 });
        expect(isHabitScheduledForDate(weekly, date('2026-03-09'))).toBe(false);
        expect(isHabitScheduledForDate(weekly, date('2026-03-16'))).toBe(true);
    });

    it('clamps monthly anniversaries to each month end', () => {
        const monthly = habit({ startDate: '2024-01-31', frequency: 'monthly', taskDays: ['wed'] });
        expect(isHabitScheduledForDate(monthly, date('2024-02-28'))).toBe(false);
        expect(isHabitScheduledForDate(monthly, date('2024-02-29'))).toBe(true);
        expect(isHabitScheduledForDate(monthly, date('2025-02-28'))).toBe(true);
        expect(isHabitScheduledForDate(monthly, date('2025-04-30'))).toBe(true);
        expect(isHabitScheduledForDate(monthly, date('2025-05-30'))).toBe(false);
        expect(isHabitScheduledForDate(monthly, date('2025-05-31'))).toBe(true);
    });

    it('schedules yearly anniversaries once and clamps leap birthdays', () => {
        const yearly = habit({ startDate: '2024-02-29', frequency: 'yearly' });
        expect(isHabitScheduledForDate(yearly, date('2025-02-28'))).toBe(true);
        expect(isHabitScheduledForDate(yearly, date('2025-03-01'))).toBe(false);
        expect(isHabitScheduledForDate(yearly, date('2028-02-28'))).toBe(false);
        expect(isHabitScheduledForDate(yearly, date('2028-02-29'))).toBe(true);
    });

    it('does not throw for missing or invalid dates', () => {
        expect(parseHabitDate('2026-02-31')).toBeNull();
        expect(parseHabitDate('not-a-date')).toBeNull();
        expect(isHabitScheduledForDate(habit({ startDate: 'invalid', createdAt: 'invalid' }), date('2026-09-16'))).toBe(false);
        expect(isHabitScheduledForDate(habit(), new Date('invalid'))).toBe(false);
    });
});
