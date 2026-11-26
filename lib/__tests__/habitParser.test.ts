import { describeParsed, parseHabitText, parsedToHabit } from '../habitParser';

describe('quick add parsing', () => {
    it('parses the full example', () => {
        const parsed = parseHabitText('Gym Monday, Wednesday, Friday at 6, 45 minutes');
        expect(parsed.name).toBe('Gym');
        expect(parsed.taskDays).toEqual(['mon', 'wed', 'fri']);
        expect(parsed.startTime).toBe('18:00');
        expect(parsed.durationMinutes).toBe(45);
        expect(parsed.trackingMethod).toBe('numeric');
    });

    it('keeps days in week order regardless of how they were typed', () => {
        expect(parseHabitText('Run Friday Monday Wednesday').taskDays).toEqual(['mon', 'wed', 'fri']);
    });

    it('understands abbreviations and plurals', () => {
        expect(parseHabitText('Swim Mon, Weds, Fri').taskDays).toEqual(['mon', 'wed', 'fri']);
        expect(parseHabitText('Call mum Sundays').taskDays).toEqual(['sun']);
    });

    it('understands weekdays, weekends and daily', () => {
        expect(parseHabitText('Read weekdays').taskDays).toEqual(['mon', 'tue', 'wed', 'thu', 'fri']);
        expect(parseHabitText('Long walk weekends').taskDays).toEqual(['sat', 'sun']);
        expect(parseHabitText('Meditate every day').taskDays).toEqual([]);
        expect(parseHabitText('Meditate daily').matched.days).toBe(true);
    });

    it('treats an empty day list as every day and says so', () => {
        const parsed = parseHabitText('Stretch');
        expect(parsed.taskDays).toEqual([]);
        expect(parsed.assumptions.join(' ')).toContain('every day');
    });
});

describe('times', () => {
    it('reads explicit am and pm', () => {
        expect(parseHabitText('Read at 9pm').startTime).toBe('21:00');
        expect(parseHabitText('Walk at 7am').startTime).toBe('07:00');
        expect(parseHabitText('Journal at 12am').startTime).toBe('00:00');
    });

    it('reads 24 hour and minutes', () => {
        expect(parseHabitText('Gym at 18:30').startTime).toBe('18:30');
        expect(parseHabitText('Standup at 9:15').startTime).toBe('09:15');
    });

    it('reports the assumption it made for a bare hour', () => {
        const evening = parseHabitText('Gym at 6');
        expect(evening.startTime).toBe('18:00');
        expect(evening.assumptions.join(' ')).toContain('18:00');

        const morning = parseHabitText('Meditate at 9');
        expect(morning.startTime).toBe('09:00');
        expect(morning.assumptions.length).toBeGreaterThan(0);
    });

    it('does not invent a time when none was given', () => {
        expect(parseHabitText('Read 10 pages').startTime).toBeUndefined();
        expect(parseHabitText('Stretch').startTime).toBeUndefined();
    });
});

describe('targets and duration', () => {
    it('treats a duration as the target when no count is given', () => {
        const parsed = parseHabitText('Meditate 10 minutes daily');
        expect(parsed.durationMinutes).toBe(10);
        expect(parsed.targetValue).toBe(10);
        expect(parsed.targetUnit).toBe('min');
    });

    it('converts hours to minutes', () => {
        expect(parseHabitText('Study 2 hours').durationMinutes).toBe(120);
        expect(parseHabitText('Deep work 1 hr').durationMinutes).toBe(60);
    });

    it('keeps a counted target in its own unit', () => {
        const parsed = parseHabitText('Read 10 pages every day');
        expect(parsed.targetValue).toBe(10);
        expect(parsed.targetUnit).toBe('pages');
        expect(parsed.durationMinutes).toBeUndefined();
    });

    it('prefers the explicit count when both appear', () => {
        const parsed = parseHabitText('Read 20 pages for 30 minutes');
        expect(parsed.targetValue).toBe(20);
        expect(parsed.targetUnit).toBe('pages');
        expect(parsed.durationMinutes).toBe(30);
    });

    it('falls back to done-or-not-done with no numbers', () => {
        const parsed = parseHabitText('Make the bed every day');
        expect(parsed.trackingMethod).toBe('boolean');
        expect(parsed.targetValue).toBeUndefined();
    });
});

describe('the leftover text becomes the name', () => {
    it('strips the parts it understood', () => {
        expect(parseHabitText('Gym Monday, Wednesday, Friday at 6, 45 minutes').name).toBe('Gym');
        expect(parseHabitText('Read 10 pages every day at 9pm').name).toBe('Read');
        expect(parseHabitText('Drink 8 glasses of water daily').name.toLowerCase()).toContain('water');
    });

    it('capitalises the first word only', () => {
        expect(parseHabitText('gym weekdays').name).toBe('Gym');
        expect(parseHabitText('HIIT weekdays').name).toBe('HIIT');
    });

    it('survives an empty or nonsense input without throwing', () => {
        expect(parseHabitText('').name).toBe('');
        expect(parseHabitText('   ').name).toBe('');
        expect(() => parseHabitText('!!!')).not.toThrow();
    });
});

describe('handing the result to the store', () => {
    it('maps onto the habit fields the store expects', () => {
        const parsed = parseHabitText('Gym Monday, Wednesday, Friday at 6, 45 minutes');
        const habit = parsedToHabit(parsed, '2026-09-16');
        expect(habit).toMatchObject({
            name: 'Gym',
            taskDays: ['mon', 'wed', 'fri'],
            startTime: '18:00',
            durationMinutes: 45,
            goalValue: 45,
            unit: 'min',
            trackingMethod: 'numeric',
            startDate: '2026-09-16',
            type: 'build',
        });
    });

    it('never schedules a reminder from quick add', () => {
        expect(parsedToHabit(parseHabitText('Gym at 6'), '2026-09-16').reminders).toEqual([]);
    });

    it('summarises what will be created', () => {
        const summary = describeParsed(parseHabitText('Read 10 pages weekdays at 9pm'));
        expect(summary).toContain('10 pages');
        expect(summary).toContain('Mon');
        expect(summary).toContain('21:00');
    });
});

describe('a clean name: when it begins and the part of the day are settings', () => {
    const today = new Date(2026, 9, 26, 10);
    it('reads "starting January 1, 2027" as the start date and "each morning" as a time', () => {
        const parsed = parseHabitText('meditate 10 minutes each morning starting january 1, 2027', today);
        expect(parsed.name).toBe('Meditate');
        expect(parsed.startDate).toBe('2027-01-01');
        expect(parsed.startTime).toBe('08:00');
        expect(parsed.matched.days).toBe(true);
    });
    it('keeps "every night" out of the name, and a said hour wins', () => {
        const parsed = parseHabitText('journal every night at 10pm', today);
        expect(parsed.name).toBe('Journal');
        expect(parsed.startTime).toBe('22:00');
    });
});

describe('habits as people write them (the 400-case pass)', () => {
    const today = new Date(2026, 9, 26, 10);
    const read = (text: string) => parseHabitText(text, today);
    it('reads so many times a week or a month, on any days', () => {
        expect(read('Go to the gym four times a week')).toMatchObject({ name: 'Go to the gym', recurrence: { kind: 'quota', times: 4, period: 'week' } });
        expect(read('Cycle to work twice per week').recurrence).toEqual({ kind: 'quota', every: 1, times: 2, period: 'week' });
        expect(read('Prepare lunch at home five days a week').recurrence).toMatchObject({ times: 5 });
        expect(read('Attend a community event once a month').recurrence).toMatchObject({ times: 1, period: 'month' });
    });
    it('keeps an amount per week as a weekly habit with its amount', () => {
        expect(read('Read 100 pages per week rather than daily')).toMatchObject({ name: 'Read 100 pages', recurrence: { kind: 'quota', times: 1, period: 'week' }, trackingMethod: 'boolean' });
    });
    it('reads the schedules the app already knows', () => {
        expect(read('Take vitamins every other day').recurrence).toEqual({ kind: 'daily', every: 2 });
        expect(read('Work out every second Tuesday').recurrence).toEqual({ kind: 'weekly', every: 2, weekdays: ['tue'] });
        expect(read('Do a digital detox on the last Sunday of each month').recurrence).toEqual({ kind: 'monthly', every: 1, ordinal: -1, day: 'sun' });
        expect(read('Review subscriptions on the first of every month').recurrence).toEqual({ kind: 'monthly', every: 1, dates: [1] });
    });
    it('counts several times a day', () => {
        expect(read('Drink water eight times a day')).toMatchObject({ name: 'Drink water', targetValue: 8, targetUnit: 'times' });
        expect(read('Perform a habit twice daily, morning and night')).toMatchObject({ targetValue: 2, targetUnit: 'times' });
    });
    it('makes "avoid…" a quit habit and never a timer', () => {
        expect(read('Avoid my phone for the first 30 minutes')).toMatchObject({ name: 'Avoid my phone for the first 30 minutes', habitType: 'quit', trackingMethod: 'boolean' });
        expect(read('Avoid smoking entirely, with zero as the daily target')).toMatchObject({ name: 'Avoid smoking entirely', habitType: 'quit' });
        expect(read('Avoid late-night snacking after 9 PM').name).toBe('Avoid late-night snacking after 9 PM');
    });
    it('reads numbers in words and thousands, and keeps names whole', () => {
        expect(read('Walk at least 8,000 steps daily')).toMatchObject({ targetValue: 8000, targetUnit: 'steps' });
        expect(read('Meditate for five minutes')).toMatchObject({ name: 'Meditate', targetValue: 5, targetUnit: 'min' });
        expect(read('Drink a glass of water after waking up').name).toBe('Drink a glass of water after waking up');
        expect(read('Track every purchase daily').name).toBe('Track every purchase');
        expect(read('Do 10 minutes of stretching').name).toBe('Do stretching');
        expect(read('Do 30 push-ups every day').name).toBe('Do push-ups');
    });
    it('keeps "before 9 AM" and "by 11 PM" as part of what it is, and reads weeknights', () => {
        expect(read('Eat breakfast before 9 AM')).toMatchObject({ name: 'Eat breakfast before 9 AM', startTime: undefined });
        expect(read('Go to bed by 11 PM on weeknights')).toMatchObject({ name: 'Go to bed by 11 PM', taskDays: ['mon', 'tue', 'wed', 'thu', 'fri'] });
    });
    it('turns a quota into the habit the store keeps', () => {
        const habit = parsedToHabit(read('Practice guitar four evenings a week'), '2026-10-26');
        expect(JSON.parse(habit.recurrence!)).toEqual({ kind: 'quota', every: 1, times: 4, period: 'week' });
        expect(parsedToHabit(read('Avoid sugary drinks on weekdays'), '2026-10-26').type).toBe('quit');
    });
});

describe('"now"', () => {
    it('starts at this minute, kept there', () => {
        const { parseHabitText } = require('../habitParser');
        const parsed = parseHabitText('Meditate right now', new Date(2026, 10, 21, 9, 5));
        expect(parsed.name).toBe('Meditate');
        expect(parsed.startTime).toBe('09:05');
        expect(parsed.flexible).toBe(false);
    });
});

describe('every setting, said the way people say it', () => {
    const { parseHabitText } = require('../habitParser');
    const day = new Date(2026, 10, 21, 10, 0);
    const read = (text: string) => parseHabitText(text, day, { known: ['Lunch', 'Accounting'] });
    it('links it right before or right after something', () => {
        expect(read('Gym right after work 45 min')).toMatchObject({ name: 'Gym', anchor: { to: 'Work', side: 'after' }, durationMinutes: 45 });
        expect(read('Walk after lunch')).toMatchObject({ name: 'Walk', anchor: { to: 'Lunch', side: 'after' } });
        expect(read('Review notes just before Accounting')).toMatchObject({ name: 'Review notes', anchor: { to: 'Accounting', side: 'before' } });
    });
    it('reads a reminder without mistaking it for a length or a time', () => {
        expect(read('Run 5k, remind me 10 min before')).toMatchObject({ name: 'Run 5k', reminder: { alerts: [10] } });
        expect(read('Run 5k, remind me 10 min before').durationMinutes).toBeUndefined();
        expect(read('Pills every day, remind me at 9pm')).toMatchObject({ name: 'Pills', reminder: { at: '21:00' } });
        expect(read('Pills every day, remind me at 9pm').startTime).toBeUndefined();
    });
    it('reads "every 2 hours" as times a day', () => {
        expect(read('Remind me to drink water every 2 hours')).toMatchObject({ name: 'Drink water', targetValue: 8, targetUnit: 'times' });
    });
    it('reads how it tracks itself', () => {
        expect(read('Read on Libby 30 min')).toMatchObject({ name: 'Read', tracking: { kind: 'app', app: 'Libby' }, targetValue: 30 });
        expect(read('Lift at the gym')).toMatchObject({ name: 'Lift', tracking: { kind: 'place' } });
        expect(read('Run 30 min from Apple Health')).toMatchObject({ name: 'Run', tracking: { kind: 'health' } });
    });
    it('reads anytime words as Anytime', () => {
        expect(read('Journal whenever')).toMatchObject({ name: 'Journal', flexible: true });
        expect(read('Stretch any time of day')).toMatchObject({ name: 'Stretch', flexible: true });
    });
});
