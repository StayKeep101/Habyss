import { focusDuration, focusSummary, hourLabel, parseRecord, type FocusRecord } from '../focusStats';

jest.mock('@react-native-async-storage/async-storage', () => ({ getAllKeys: jest.fn(async () => []), multiGet: jest.fn(async () => []) }));

const at = (day: string, hour: number) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`);
const session = (day: string, hour: number, minutes: number, itemId = 'read', completed = true): FocusRecord => ({
    itemId, startedAt: at(day, hour).toISOString(), date: day, seconds: minutes * 60, completed, mode: 'deep_focus',
});

describe('reading a saved session', () => {
    it('keeps sessions with time, skips empty or broken ones', () => {
        const raw = JSON.stringify({ habit_id: 'h', started_at: at('2026-10-18', 9).toISOString(), actual_duration: 1500, completed: true, mode: 'flow' });
        expect(parseRecord(raw)).toMatchObject({ itemId: 'h', date: '2026-10-18', seconds: 1500, completed: true, mode: 'flow' });
        expect(parseRecord(JSON.stringify({ habit_id: 'h', started_at: at('2026-10-18', 9).toISOString(), actual_duration: 0 }))).toBeNull();
        expect(parseRecord('{nope')).toBeNull();
        expect(parseRecord(null)).toBeNull();
    });
});

describe('the focus summary', () => {
    const today = '2026-10-18';
    const all = [
        session('2026-10-18', 9, 30),
        session('2026-10-17', 9, 60, 'essay'),
        session('2026-10-16', 10, 20, 'read', false),
        session('2026-10-10', 9, 25),
    ];
    const summary = focusSummary(all, today);

    it('totals today, this week and the week before', () => {
        expect(summary.today).toBe(30 * 60);
        expect(summary.week).toBe(110 * 60);
        expect(summary.lastWeek).toBe(25 * 60);
        expect(summary.change).toBe(85 * 60);
        expect(summary.days).toHaveLength(7);
        expect(summary.days[6]).toEqual({ date: today, seconds: 30 * 60 });
    });

    it('counts days in a row, the longest, and how often sessions are finished', () => {
        expect(summary.streak).toBe(3);
        expect(summary.longest).toBe(60 * 60);
        expect(summary.finishedRate).toBe(75);
        expect(summary.bestHour).toBe(9);
    });

    it('keeps a streak alive until the end of today', () => {
        expect(focusSummary(all, '2026-10-19').streak).toBe(3);
        expect(focusSummary(all, '2026-10-20').streak).toBe(0);
    });

    it('ranks what took the time within the range', () => {
        expect(summary.items.map(item => item.itemId)).toEqual(['essay', 'read']);
        expect(summary.items[1]).toMatchObject({ seconds: 50 * 60, sessions: 2 });
        expect(focusSummary(all, today, 30).items.find(item => item.itemId === 'read')?.sessions).toBe(3);
    });

    it('is empty and quiet with no sessions', () => {
        const none = focusSummary([], today);
        expect(none).toMatchObject({ today: 0, week: 0, streak: 0, longest: 0, finishedRate: null, bestHour: null, items: [] });
    });
});

describe('labels', () => {
    it('reads durations and hours plainly', () => {
        expect(focusDuration(85 * 60)).toBe('1h 25m');
        expect(focusDuration(3600)).toBe('1h');
        expect(focusDuration(25 * 60)).toBe('25m');
        expect(focusDuration(40)).toBe('40s');
        expect(focusDuration(0)).toBe('0m');
        expect(hourLabel(9)).toBe('9 am');
        expect(hourLabel(0)).toBe('12 am');
        expect(hourLabel(14)).toBe('2 pm');
    });
});

describe('weekSoFar', () => {
    const { weekSoFar } = require('../focusStats') as typeof import('../focusStats');
    const row = (date: string, seconds: number) => ({ itemId: 'a', startedAt: `${date}T09:00:00`, date, seconds, completed: true, mode: 'flow' });
    it('compares the week so far with the same days of last week', () => {
        // Wednesday Oct 28, weeks from Monday.
        const all = [row('2026-10-26', 600), row('2026-10-28', 300), row('2026-10-19', 200), row('2026-10-22', 900), row('2026-10-25', 50)];
        expect(weekSoFar(all, '2026-10-28', '2026-10-26')).toEqual({ week: 900, lastWeek: 200, change: 700 });
    });
    it('starts on Sunday when the week does', () => {
        const all = [row('2026-10-25', 50), row('2026-10-26', 600)];
        expect(weekSoFar(all, '2026-10-26', '2026-10-25').week).toBe(650);
    });
});
