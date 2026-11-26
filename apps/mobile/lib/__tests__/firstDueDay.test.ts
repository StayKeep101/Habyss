import { createHabitRequirement, createHabitSchedule, firstDueDay, localDateKey } from '../habitSchedule';
import { matches, type Recurrence } from '../recurrence';
import type { Habit } from '../habitsSQLite';

jest.mock('../dataStore', () => ({ getData: () => ({ history: {} }) }));

const habit = (recurrence: Recurrence | null, startDate: string, extra: Partial<Habit> = {}) => ({
    id: 'h', name: 'H', type: 'build', startDate, createdAt: `${startDate}T08:00:00Z`, taskDays: [], frequency: 'daily',
    recurrence: recurrence ? JSON.stringify(recurrence) : undefined, ...extra,
} as unknown as Habit);
const at = (key: string) => new Date(`${key}T12:00:00`);
const dueDays = (h: Habit, from: string, count: number) => {
    const schedule = createHabitSchedule(h);
    const out: string[] = [];
    for (let day = at(from); out.length < count; day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1, 12)) {
        if (schedule(day)) out.push(localDateKey(day));
    }
    return out;
};

describe('a series starts on its first occurrence (RFC 5545 DTSTART)', () => {
    it('"every 4 weeks on Thursday" made on Sunday 22 Nov starts on Thursday 26, then every 4 weeks', () => {
        const rule: Recurrence = { kind: 'weekly', every: 4, weekdays: ['thu'] };
        const first = firstDueDay(habit(rule, '2026-11-22'));
        expect(first).toBe('2026-11-26');
        expect(dueDays(habit(rule, first!), '2026-11-22', 3)).toEqual(['2026-11-26', '2026-12-24', '2027-01-21']);
    });

    it('keeps a start that is already due', () => {
        expect(firstDueDay(habit({ kind: 'weekly', every: 2, weekdays: ['sun'] }, '2026-11-22'))).toBe('2026-11-22');
        expect(firstDueDay(habit({ kind: 'daily', every: 3 }, '2026-11-22'))).toBe('2026-11-22');
    });

    it('"every 2 months on the 15th" made on the 22nd starts on the next 15th', () => {
        const rule: Recurrence = { kind: 'monthly', every: 2, dates: [15] };
        const first = firstDueDay(habit(rule, '2026-11-22'))!;
        expect(first).toBe('2026-12-15');
        expect(dueDays(habit(rule, first), first, 2)).toEqual(['2026-12-15', '2027-02-15']);
    });

    it('works for the older weekday-and-interval habits too', () => {
        const old = habit(null, '2026-11-22', { frequency: 'weekly', taskDays: ['thu'], weekInterval: 4 } as Partial<Habit>);
        expect(firstDueDay(old)).toBe('2026-11-26');
    });
});

describe('weeks start on Monday everywhere', () => {
    it('an older every-2-weeks habit agrees with the rule about which fortnight a Sunday is in', () => {
        const old = habit(null, '2026-11-16', { frequency: 'weekly', taskDays: ['sun'], weekInterval: 2 } as Partial<Habit>);
        const rule = habit({ kind: 'weekly', every: 2, weekdays: ['sun'] }, '2026-11-16');
        expect(dueDays(old, '2026-11-16', 3)).toEqual(dueDays(rule, '2026-11-16', 3));
    });
});

describe('yearly, as RFC 5545 reads it', () => {
    const start = at('2026-03-10');
    it('with no month given, is once a year on the start\'s month and day', () => {
        const rule: Recurrence = { kind: 'yearly', every: 1, months: [] };
        expect(matches(rule, at('2027-03-10'), start)).toBe(true);
        expect(matches(rule, at('2027-04-10'), start)).toBe(false);
    });
    it('"the last Friday" with no month is the last Friday of the year', () => {
        const rule: Recurrence = { kind: 'yearly', every: 1, months: [], ordinal: -1, day: 'fri' };
        expect(matches(rule, at('2026-12-25'), start)).toBe(true);
        expect(matches(rule, at('2026-11-27'), start)).toBe(false);
    });
});

describe('a "3 times a week" habit started part-way through a week', () => {
    it('asks only its share of that first week (started Saturday: once, not three times in two days)', () => {
        const due = createHabitRequirement(habit({ kind: 'quota', every: 1, times: 3, period: 'week' }, '2026-11-21'));
        expect(due('2026-11-21', () => false)).toBe(false);
        expect(due('2026-11-22', () => false)).toBe(true);
        expect(due('2026-11-22', key => key === '2026-11-21')).toBe(false);
    });
});
