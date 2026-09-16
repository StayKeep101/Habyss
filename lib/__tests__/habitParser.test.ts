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
