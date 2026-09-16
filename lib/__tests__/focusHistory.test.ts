import {
    DEFAULT_DAY_WINDOW,
    formatMinutes,
    groupSessionsByDate,
    minutesLeftInDay,
    parseTimeToMinutes,
    type StoredFocusSession,
} from '../focusHistory';

const at = (hours: number, minutes: number) => new Date(2026, 8, 16, hours, minutes, 0);

describe('parseTimeToMinutes', () => {
    it('parses padded and unpadded hours', () => {
        expect(parseTimeToMinutes('08:30')).toBe(510);
        expect(parseTimeToMinutes('8:30')).toBe(510);
        expect(parseTimeToMinutes('00:00')).toBe(0);
        expect(parseTimeToMinutes('22:00')).toBe(1320);
    });

    it('rejects values that are not a real time', () => {
        expect(parseTimeToMinutes('24:00')).toBeNull();
        expect(parseTimeToMinutes('12:60')).toBeNull();
        expect(parseTimeToMinutes('lunch')).toBeNull();
        expect(parseTimeToMinutes('')).toBeNull();
    });
});

describe('minutesLeftInDay', () => {
    it('counts down inside the active day', () => {
        // 08:30 to 22:00 is 810 minutes.
        expect(minutesLeftInDay(at(21, 0), DEFAULT_DAY_WINDOW)).toBe(60);
        expect(minutesLeftInDay(at(12, 0), DEFAULT_DAY_WINDOW)).toBe(600);
    });

    it('reports the full window before the day opens', () => {
        expect(minutesLeftInDay(at(6, 0), DEFAULT_DAY_WINDOW)).toBe(810);
        expect(minutesLeftInDay(at(8, 30), DEFAULT_DAY_WINDOW)).toBe(810);
    });

    it('never goes negative once the day is over', () => {
        expect(minutesLeftInDay(at(22, 0), DEFAULT_DAY_WINDOW)).toBe(0);
        expect(minutesLeftInDay(at(23, 30), DEFAULT_DAY_WINDOW)).toBe(0);
    });

    it('handles a custom window and refuses an inverted one', () => {
        expect(minutesLeftInDay(at(10, 0), { start: '09:00', end: '17:00' })).toBe(420);
        expect(minutesLeftInDay(at(10, 0), { start: '22:00', end: '08:00' })).toBe(0);
    });

    it('falls back to the default when a bound is unparseable', () => {
        expect(minutesLeftInDay(at(21, 0), { start: 'oops', end: '22:00' })).toBe(60);
    });
});

describe('formatMinutes', () => {
    it('formats hours and minutes compactly', () => {
        expect(formatMinutes(0)).toBe('0m');
        expect(formatMinutes(45)).toBe('45m');
        expect(formatMinutes(60)).toBe('1h');
        expect(formatMinutes(200)).toBe('3h 20m');
    });

    it('clamps negatives instead of rendering them', () => {
        expect(formatMinutes(-15)).toBe('0m');
    });
});

describe('groupSessionsByDate', () => {
    const sessions: StoredFocusSession[] = [
        { date: '2026-09-15', actual_duration: 1500, completed: true },
        { date: '2026-09-15', actual_duration: 600, completed: false },
        { date: '2026-09-16', actual_duration: 3000, completed: true },
        { started_at: '2026-09-14T09:00:00.000Z', actual_duration: 900, completed: true },
    ];

    it('totals sessions per day, newest first', () => {
        const days = groupSessionsByDate(sessions);
        expect(days.map(day => day.date)).toEqual(['2026-09-16', '2026-09-15', '2026-09-14']);
        expect(days[1]).toMatchObject({ seconds: 2100, sessions: 2, completedSessions: 1, bestSeconds: 1500 });
    });

    it('falls back to started_at when date is missing', () => {
        const day = groupSessionsByDate(sessions).find(entry => entry.date === '2026-09-14');
        expect(day?.seconds).toBe(900);
    });

    it('ignores records with no usable date and treats missing durations as zero', () => {
        const days = groupSessionsByDate([
            { actual_duration: 100 },
            { date: '2026-09-16' },
        ]);
        expect(days).toHaveLength(1);
        expect(days[0]).toMatchObject({ date: '2026-09-16', seconds: 0, sessions: 1 });
    });

    it('returns nothing for an empty history', () => {
        expect(groupSessionsByDate([])).toEqual([]);
    });
});
