import { evidenceToday, readsHealth, timedToday } from '../evidence';
import type { Habit } from '../habitsSQLite';

const store: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
    getAllKeys: jest.fn(async () => Object.keys(store)),
    multiGet: jest.fn(async (keys: string[]) => keys.map(key => [key, store[key] ?? null])),
}));

const habit = (over: Partial<Habit> = {}): Habit => ({ id: 'h', name: 'Run', ...over } as Habit);
const session = (habitId: string, date: string, over: object = {}) =>
    JSON.stringify({ habit_id: habitId, date, completed: true, ...over });

beforeEach(() => { for (const key of Object.keys(store)) delete store[key]; });

describe('which habits the timer vouches for', () => {
    it('finds a session from today', async () => {
        store['focus_session_1'] = session('h1', '2026-09-27');
        expect([...await timedToday('2026-09-27')]).toEqual(['h1']);
    });

    it('ignores yesterday, because evidence is about the day', async () => {
        store['focus_session_1'] = session('h1', '2026-09-26');
        expect([...await timedToday('2026-09-27')]).toEqual([]);
    });

    it('does not count a session that was abandoned', async () => {
        store['focus_session_1'] = session('h1', '2026-09-27', { completed: false });
        expect([...await timedToday('2026-09-27')]).toEqual([]);
    });

    it('lets one unreadable session spoil none of the others', async () => {
        store['focus_session_1'] = 'not json at all';
        store['focus_session_2'] = session('h2', '2026-09-27');
        expect([...await timedToday('2026-09-27')]).toEqual(['h2']);
    });

    it('ignores storage keys that are not sessions', async () => {
        store['profile_nickname'] = 'Erwan';
        expect([...await timedToday('2026-09-27')]).toEqual([]);
    });
});

describe('what evidence each completion carries', () => {
    it('calls a Health-backed habit verified', async () => {
        const habits = [habit({ id: 'h1', healthKitMetric: 'steps' })];
        expect(await evidenceToday(habits, ['h1'], '2026-09-27')).toEqual({ h1: 'verified' });
    });

    it('calls a timed habit backed', async () => {
        store['focus_session_1'] = session('h1', '2026-09-27');
        expect(await evidenceToday([habit({ id: 'h1' })], ['h1'], '2026-09-27')).toEqual({ h1: 'context' });
    });

    it('takes a plain tick on trust', async () => {
        expect(await evidenceToday([habit({ id: 'h1' })], ['h1'], '2026-09-27')).toEqual({ h1: 'self' });
    });

    it('prefers Health over the timer when both apply', async () => {
        store['focus_session_1'] = session('h1', '2026-09-27');
        const habits = [habit({ id: 'h1', healthKitMetric: 'workout' })];
        expect(await evidenceToday(habits, ['h1'], '2026-09-27')).toEqual({ h1: 'verified' });
    });

    it('says nothing about a completion whose habit is gone', async () => {
        expect(await evidenceToday([], ['ghost'], '2026-09-27')).toEqual({});
    });

    it('knows which habits read from Health', () => {
        expect(readsHealth(habit({ healthKitMetric: 'sleep' }))).toBe(true);
        expect(readsHealth(habit())).toBe(false);
    });
});
