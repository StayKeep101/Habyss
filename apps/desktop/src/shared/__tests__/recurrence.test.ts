import { describe, it, expect } from 'vitest';
import { createHabitSchedule } from '../habitSchedule';
import { describe as say, matches, parseRecurrence, serialiseRecurrence, type Recurrence } from '../recurrence';

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);
const START = at(2026, 1, 1); // Thursday 1 January 2026

describe('every N days', () => {
    const rule: Recurrence = { kind: 'daily', every: 3 };
    it('lands on the start and every third day after', () => {
        expect(matches(rule, at(2026, 1, 1), START)).toBe(true);
        expect(matches(rule, at(2026, 1, 4), START)).toBe(true);
        expect(matches(rule, at(2026, 1, 2), START)).toBe(false);
    });
    it('never asks for a day before it began', () => {
        expect(matches(rule, at(2025, 12, 29), START)).toBe(false);
    });
    it('says what it is', () => {
        expect(say(rule)).toBe('Every 3 days');
        expect(say({ kind: 'daily', every: 1 })).toBe('Every day');
    });
});

describe('every N weeks on chosen days', () => {
    // Starts Thursday 1 Jan 2026; that week's Monday is 29 Dec 2025.
    const fortnightly: Recurrence = { kind: 'weekly', every: 2, weekdays: ['mon', 'wed'] };

    it('keeps to the same fortnight rather than drifting', () => {
        expect(matches(fortnightly, at(2026, 1, 5), START)).toBe(false); // Mon, week 2
        expect(matches(fortnightly, at(2026, 1, 12), START)).toBe(true); // Mon, week 3
        expect(matches(fortnightly, at(2026, 1, 14), START)).toBe(true); // Wed, week 3
    });

    it('ignores days it was not given', () => {
        expect(matches(fortnightly, at(2026, 1, 13), START)).toBe(false); // Tuesday
    });

    it('asks for nothing when no day was chosen', () => {
        expect(matches({ kind: 'weekly', every: 1, weekdays: [] }, at(2026, 1, 5), START)).toBe(false);
        expect(say({ kind: 'weekly', every: 1, weekdays: [] })).toBe('No days chosen');
    });

    it('recognises the everyday shapes by name', () => {
        expect(say({ kind: 'weekly', every: 1, weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'] })).toBe('Weekdays');
        expect(say({ kind: 'weekly', every: 1, weekdays: ['sat', 'sun'] })).toBe('Weekends');
        expect(say({ kind: 'weekly', every: 2, weekdays: ['sat', 'sun'] })).toBe('Weekends, every 2 weeks');
        expect(say(fortnightly)).toBe('Monday and Wednesday, every 2 weeks');
    });
});

describe('monthly on set dates', () => {
    const rule: Recurrence = { kind: 'monthly', every: 1, dates: [1, 27] };
    it('lands on each date given', () => {
        expect(matches(rule, at(2026, 3, 27), START)).toBe(true);
        expect(matches(rule, at(2026, 3, 1), START)).toBe(true);
        expect(matches(rule, at(2026, 3, 15), START)).toBe(false);
    });
    it('puts the 31st on the last day of a short month rather than skipping it', () => {
        const last: Recurrence = { kind: 'monthly', every: 1, dates: [31] };
        expect(matches(last, at(2026, 4, 30), START)).toBe(true); // April has 30
        expect(matches(last, at(2026, 5, 31), START)).toBe(true);
    });
    it('honours the interval', () => {
        const other: Recurrence = { kind: 'monthly', every: 2, dates: [1] };
        expect(matches(other, at(2026, 3, 1), START)).toBe(true);
        expect(matches(other, at(2026, 2, 1), START)).toBe(false);
    });
    it('reads back as dates', () => {
        expect(say(rule)).toBe('Monthly on the 1st and 27th');
        expect(say({ kind: 'monthly', every: 3, dates: [2, 22] })).toBe('Every 3 months on the 2nd and 22nd');
    });
});

describe('monthly on the nth weekday', () => {
    const thirdSunday: Recurrence = { kind: 'monthly', every: 2, ordinal: 3, day: 'sun' };

    it('lands on the third Sunday of every second month', () => {
        // Sundays in March 2026: 1, 8, 15, 22, 29 -> third is the 15th.
        expect(matches(thirdSunday, at(2026, 3, 15), START)).toBe(true);
        expect(matches(thirdSunday, at(2026, 3, 8), START)).toBe(false);
        expect(matches(thirdSunday, at(2026, 2, 15), START)).toBe(false); // wrong month
    });

    it('understands "the last" as the last one there is', () => {
        const lastFriday: Recurrence = { kind: 'monthly', every: 1, ordinal: -1, day: 'fri' };
        // Fridays in May 2026: 1, 8, 15, 22, 29.
        expect(matches(lastFriday, at(2026, 5, 29), START)).toBe(true);
        expect(matches(lastFriday, at(2026, 5, 22), START)).toBe(false);
    });

    it('counts a kind of day, not only a named one', () => {
        const lastWeekend: Recurrence = { kind: 'monthly', every: 1, ordinal: -1, day: 'weekend' };
        // May 2026 ends Sunday the 31st.
        expect(matches(lastWeekend, at(2026, 5, 31), START)).toBe(true);
        expect(matches(lastWeekend, at(2026, 5, 30), START)).toBe(false);

        const firstWeekday: Recurrence = { kind: 'monthly', every: 1, ordinal: 1, day: 'weekday' };
        // 1 Aug 2026 is a Saturday, so the first weekday is Monday the 3rd.
        expect(matches(firstWeekday, at(2026, 8, 3), START)).toBe(true);
        expect(matches(firstWeekday, at(2026, 8, 1), START)).toBe(false);
    });

    it('reads back the way somebody would say it', () => {
        expect(say(thirdSunday)).toBe('Every 2 months on the third Sunday');
        expect(say({ kind: 'monthly', every: 1, ordinal: -1, day: 'weekend' })).toBe('Monthly on the last weekend day');
    });
});

describe('yearly', () => {
    it('keeps to the months it was given', () => {
        const rule: Recurrence = { kind: 'yearly', every: 1, months: [0, 6] };
        expect(matches(rule, at(2026, 1, 1), START)).toBe(true);
        expect(matches(rule, at(2026, 7, 1), START)).toBe(true);
        expect(matches(rule, at(2026, 3, 1), START)).toBe(false);
    });

    it('can take an ordinal weekday too', () => {
        const rule: Recurrence = { kind: 'yearly', every: 1, months: [10], ordinal: 4, day: 'thu' };
        // Thursdays in November 2026: 5, 12, 19, 26 -> fourth is the 26th.
        expect(matches(rule, at(2026, 11, 26), START)).toBe(true);
        expect(matches(rule, at(2026, 11, 19), START)).toBe(false);
    });

    it('reads back as months', () => {
        expect(say({ kind: 'yearly', every: 1, months: [0, 6] })).toBe('Yearly in January and July');
        expect(say({ kind: 'yearly', every: 2, months: [10], ordinal: 4, day: 'thu' }))
            .toBe('Every 2 years in November on the fourth Thursday');
    });
});

describe('storing a rule', () => {
    it('survives a round trip', () => {
        const rule: Recurrence = { kind: 'monthly', every: 2, ordinal: 3, day: 'sun' };
        expect(parseRecurrence(serialiseRecurrence(rule))).toEqual(rule);
    });

    it('refuses nonsense rather than crashing a schedule', () => {
        expect(parseRecurrence(null)).toBeNull();
        expect(parseRecurrence('not json')).toBeNull();
        expect(parseRecurrence('{"kind":"weekly","every":1,"weekdays":[]}')).toBeNull();
        expect(parseRecurrence('{"kind":"nonsense","every":1}')).toBeNull();
        expect(parseRecurrence('{"kind":"daily","every":0}')).toBeNull();
        expect(parseRecurrence('{"kind":"daily","every":99999}')).toBeNull();
    });

    it('drops the parts of a rule that are not real', () => {
        expect(parseRecurrence('{"kind":"weekly","every":1,"weekdays":["mon","funday"]}'))
            .toEqual({ kind: 'weekly', every: 1, weekdays: ['mon'] });
        expect(parseRecurrence('{"kind":"monthly","every":1,"dates":[1,99]}'))
            .toEqual({ kind: 'monthly', every: 1, dates: [1] });
    });
});

describe('a habit that carries a rule', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
        // eslint-disable-next-line @typescript-eslint/no-require-imports
    type Habit = import('../habitsSQLite').Habit;

    const habit = (over: Partial<Habit> = {}): Habit => ({
        id: 'h', name: 'Deep clean', startDate: '2026-01-01', createdAt: '2026-01-01',
        taskDays: [], isArchived: false, ...over,
    } as Habit);

    it('schedules by the rule instead of the weekday list', () => {
        const rule: Recurrence = { kind: 'monthly', every: 2, ordinal: 3, day: 'sun' };
        // taskDays says every day; the rule must win.
        const scheduled = createHabitSchedule(habit({
            recurrence: serialiseRecurrence(rule),
            taskDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
        }));
        expect(scheduled(at(2026, 3, 15))).toBe(true);  // third Sunday of March
        expect(scheduled(at(2026, 3, 16))).toBe(false); // the Monday after
        expect(scheduled(at(2026, 2, 15))).toBe(false); // wrong month
    });

    it('still stops at the habit’s end date', () => {
        const scheduled = createHabitSchedule(habit({
            recurrence: serialiseRecurrence({ kind: 'daily', every: 1 }),
            endDate: '2026-01-10',
        }));
        expect(scheduled(at(2026, 1, 10))).toBe(true);
        expect(scheduled(at(2026, 1, 11))).toBe(false);
    });

    it('falls back to the old reading when the rule will not parse', () => {
        // A hand-edited or out-of-date value must not cost the habit its
        // schedule entirely.
        const scheduled = createHabitSchedule(habit({
            recurrence: '{"kind":"nonsense"}',
            taskDays: ['thu'],
        }));
        expect(scheduled(at(2026, 1, 1))).toBe(true);  // a Thursday
        expect(scheduled(at(2026, 1, 2))).toBe(false);
    });

    it('leaves a habit with no rule exactly as it was', () => {
        const scheduled = createHabitSchedule(habit({ taskDays: ['mon'] }));
        expect(scheduled(at(2026, 1, 5))).toBe(true);
        expect(scheduled(at(2026, 1, 6))).toBe(false);
    });
});
