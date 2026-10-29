import { createHabitRequirement, isQuotaHabit } from '../habitSchedule';
import { describe as describeRule, parseRecurrence } from '../recurrence';
import { computeMarks } from '../marks';
import type { Habit } from '../habitsSQLite';

jest.mock('../dataStore', () => ({ getData: () => ({ history: {} }) }));

const gym = {
    id: 'gym', name: 'Gym', type: 'build', startDate: '2026-10-19', createdAt: '2026-10-19T08:00:00Z', taskDays: [],
    recurrence: JSON.stringify({ kind: 'quota', every: 1, times: 3, period: 'week' }),
} as unknown as Habit;
// The week of Monday 26 October to Sunday 1 November 2026.
const days = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];

describe('a "3 times a week" habit', () => {
    it('reads and describes itself', () => {
        expect(isQuotaHabit(gym)).toBe(true);
        expect(describeRule(parseRecurrence(gym.recurrence)!)).toBe('3 times a week');
    });

    it('is not due Monday to Thursday with nothing done, and due each of the last three days', () => {
        const due = createHabitRequirement(gym);
        const none = () => false;
        expect(days.map(day => due(day, none))).toEqual([false, false, false, false, true, true, true]);
    });

    it('is never due again once the week has its three', () => {
        const due = createHabitRequirement(gym);
        const done = new Set(['2026-10-26', '2026-10-28', '2026-10-29']);
        expect(days.map(day => due(day, key => done.has(key)))).toEqual([false, false, false, false, false, false, false]);
    });

    it('is missed (costing Shards) only for the times the week could not fit', () => {
        // Two done (Monday, Tuesday): one more was needed, so Sunday alone was due, and missed.
        const marks = computeMarks({ habits: [gym], tasks: [], history: { '2026-10-26': ['gym'], '2026-10-27': ['gym'] }, today: '2026-11-02' });
        const misses = marks.ledger.filter(event => event.kind === 'miss' && event.date >= '2026-10-26');
        expect(misses.map(event => event.date)).toEqual(['2026-11-01']);
    });
});
