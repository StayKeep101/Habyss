import { pickQuestion, todays, type CheckInState } from '../checkIns';
import { dayScores, moodEnergy } from '../moodEnergy';
import { eggLine, pickEgg, tryWord, VAULT } from '../echoEggs';
import { streakFrom } from '../dayComplete';
import type { Habit } from '../habitsSQLite';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) }));
jest.mock('../supabase', () => ({ getSupabase: () => null }));

const stats = () => ({ asked: 0, answered: 0, hours: Array(24).fill(0) as number[] });
const empty = (): CheckInState => ({ entries: [], stats: { mood: stats(), energy: stats() } });
const at = (day: string, hour: number) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`);

describe('when Echo asks', () => {
    it('asks sometimes, never twice within a few hours, and not again once answered today', () => {
        const now = at('2026-10-18', 10);
        expect(pickQuestion(empty(), now, () => 0)).not.toBeNull();
        expect(pickQuestion(empty(), now, () => 0.99)).toBeNull();

        const justAsked = empty();
        justAsked.stats.mood.lastAsked = at('2026-10-18', 9).toISOString();
        justAsked.stats.energy.lastAsked = at('2026-10-18', 9).toISOString();
        expect(pickQuestion(justAsked, now, () => 0)).toBeNull();

        const answered = empty();
        answered.entries = [{ at: at('2026-10-18', 8).toISOString(), kind: 'mood', value: 4 }, { at: at('2026-10-18', 8).toISOString(), kind: 'energy', value: 3 }];
        expect(pickQuestion(answered, now, () => 0)).toBeNull();
        expect(todays(answered, 'mood', now)).toBe(4);
    });

    it('learns: asks more where it gets answered, less where it is waved away', () => {
        const keen = empty();
        keen.stats.mood = { asked: 10, answered: 10, hours: Object.assign(Array(24).fill(0), { 10: 10 }) };
        keen.stats.energy = { ...keen.stats.mood };
        const ignored = empty();
        ignored.stats.mood = { asked: 10, answered: 0, hours: Array(24).fill(0) };
        ignored.stats.energy = { ...ignored.stats.mood };
        const now = at('2026-10-18', 10);
        // At a roll of 0.5: the keen one is asked, the ignored one is not.
        expect(pickQuestion(keen, now, () => 0.5)).not.toBeNull();
        expect(pickQuestion(ignored, now, () => 0.5)).toBeNull();
    });
});

describe('mood and energy', () => {
    it('averages each day and compares the week with the one before', () => {
        const entries = [
            { at: at('2026-10-17', 9).toISOString(), kind: 'mood' as const, value: 4 as const },
            { at: at('2026-10-17', 20).toISOString(), kind: 'mood' as const, value: 2 as const },
            { at: at('2026-10-09', 9).toISOString(), kind: 'mood' as const, value: 2 as const },
        ];
        expect(dayScores(entries).find(day => day.date === '2026-10-17')?.mood).toBe(3);
        const summary = moodEnergy(entries, '2026-10-18');
        expect(summary.week.mood).toBe(3);
        expect(summary.lastWeek.mood).toBe(2);
        expect(summary.energyEffect).toBeNull();
    });

    it('only says how habits go on high and low energy days with enough of both', () => {
        const habit = { id: 'h', name: 'Read', startDate: '2026-09-01', createdAt: '2026-09-01T09:00:00', taskDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] } as Habit;
        const entries = [];
        const history = [];
        for (let i = 1; i <= 8; i++) {
            const day = `2026-10-${String(i).padStart(2, '0')}`;
            const high = i % 2 === 0;
            entries.push({ at: at(day, 9).toISOString(), kind: 'energy' as const, value: (high ? 5 : 1) as 5 | 1 });
            history.push({ date: day, completedIds: high ? ['h'] : [] });
        }
        const summary = moodEnergy(entries, '2026-10-18', [habit], history);
        expect(summary.energyEffect).toMatchObject({ high: 100, low: 0, highDays: 4, lowDays: 4 });
    });
});

describe('easter eggs', () => {
    it('are rare, at most once a day, and never the same twice in a row', () => {
        const context = { today: '2026-10-18', hasFriends: true, hasMemory: true };
        expect(pickEgg({ found: [], words: [] }, context, () => 0.5)).toBeNull();
        expect(pickEgg({ found: [], words: [] }, context, () => 0.01)).not.toBeNull();
        expect(pickEgg({ found: [], words: [], lastDay: '2026-10-18' }, context, () => 0.01)).toBeNull();
        const next = pickEgg({ found: [], words: [], lastDay: '2026-10-17', lastEgg: 'help_friend' }, context, () => 0.01);
        expect(next).not.toBe('help_friend');
        expect(pickEgg({ found: [], words: [] }, { ...context, hasFriends: false, hasMemory: false }, () => 0.01)).toBe('vault');
        expect(typeof eggLine('vault', () => 0)).toBe('string');
    });

    it('opens the vault only for the right words, whatever the case', async () => {
        expect(await tryWord('  ABYSS ')).toBe(VAULT.abyss);
        expect(await tryWord('nope')).toBeNull();
    });
});

describe('streak freezes', () => {
    it('keep the streak going over a covered day', () => {
        const habit = { id: 'h', name: 'Read', startDate: '2026-10-01', createdAt: '2026-10-01T09:00:00', taskDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] } as Habit;
        const history = { '2026-10-15': ['h'], '2026-10-16': ['h'], '2026-10-18': ['h'] };
        expect(streakFrom([habit], [], history, {}, '2026-10-18', undefined, 3, new Set()).streak).toBe(1);
        expect(streakFrom([habit], [], history, {}, '2026-10-18', undefined, 3, new Set(['2026-10-17'])).streak).toBe(3);
    });
});
