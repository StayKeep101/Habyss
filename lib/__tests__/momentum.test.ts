import { habitDays, keptRate, shiftDay } from '../habitDays';
import { momentum, habitMomentum } from '../momentum';
import type { Habit } from '../habitsSQLite';

const habit = (over: Partial<Habit> = {}): Habit => ({
    id: 'h1', name: 'Read', category: 'mind', createdAt: '2026-01-01', type: 'build',
    color: '#fff', goalPeriod: 'daily', goalValue: 1, unit: 'time', taskDays: [],
    reminders: [], chartType: 'bar', startDate: '2026-01-01', isArchived: false,
    showMemo: false, frequency: 'daily', trackingMethod: 'boolean', ...over,
} as Habit);

const TODAY = '2026-09-25';
const PAST = '2026-09-20';

/** `days` consecutive records ending on `end`, ticking whatever `on` returns. */
const history = (days: number, on: (date: string, back: number) => string[], end = TODAY) =>
    Array.from({ length: days }, (_, index) => {
        const back = days - 1 - index;
        const date = shiftDay(end, -back);
        return { date, completedIds: on(date, back), skippedIds: [] as string[] };
    });

describe('the window every statistic is read from', () => {
    it('counts a day with no record at all as a day missed', () => {
        // The old reading walked the rows that existed, so a day nothing was
        // written on simply vanished and flattered the score.
        const days = habitDays([habit()], [], {}, 3, TODAY, TODAY);
        expect(days).toHaveLength(3);
        expect(days.every(day => day.scheduled.length === 1 && day.done.length === 0)).toBe(true);
        expect(keptRate(days).rate).toBe(0);
    });

    it('scores four of five as four, not as nothing', () => {
        const habits = ['a', 'b', 'c', 'd', 'e'].map(id => habit({ id, name: id }));
        const days = habitDays(habits, [{ date: PAST, completedIds: ['a', 'b', 'c', 'd'], skippedIds: [] }], {}, 1, PAST, TODAY);
        expect(keptRate(days)).toEqual({ kept: 4, countable: 5, rate: 80 });
    });

    it('takes a deliberate skip off both sides rather than counting it against you', () => {
        const habits = [habit({ id: 'a' }), habit({ id: 'b' })];
        const days = habitDays(habits, [{ date: PAST, completedIds: ['a'], skippedIds: ['b'] }], {}, 1, PAST, TODAY);
        expect(keptRate(days)).toEqual({ kept: 1, countable: 1, rate: 100 });
    });

    it("lets today's live record win over whatever history says about today", () => {
        // History is written behind the live record, so on the current day the
        // record in hand is the truth — otherwise a tick made a moment ago
        // would not show until the next reload.
        const stale = [{ date: TODAY, completedIds: ['h1'], skippedIds: [] }];
        const days = habitDays([habit()], stale, {}, 1, TODAY, TODAY);
        expect(days[0].done).toEqual([]);
        expect(habitDays([habit()], [], { h1: true }, 1, TODAY, TODAY)[0].done).toEqual(['h1']);
    });

    it("never lets today's live ticks leak onto an earlier day", () => {
        // momentum() reads a window ending yesterday; if the live record were
        // written at the window's end instead of at the real today, yesterday
        // would inherit today's ticks.
        const yesterday = shiftDay(TODAY, -1);
        const days = habitDays([habit()], [], { h1: true }, 1, yesterday, TODAY);
        expect(days[0].date).toBe(yesterday);
        expect(days[0].done).toEqual([]);
    });
});

describe('momentum', () => {
    it('reads direction from the window before it, not from perfection', () => {
        // Kept on every one of the recent 30 days, on none of the 30 before.
        const days = history(61, (_date, back) => (back >= 1 && back <= 30 ? ['h1'] : []));
        const result = momentum([habit()], days, {}, 30, TODAY);
        expect(result.rate).toBe(100);
        expect(result.previous).toBe(0);
        expect(result.delta).toBe(100);
        expect(result.direction).toBe('up');
    });

    it('falls when the recent window is worse than the one before', () => {
        const days = history(61, (_date, back) => (back > 30 ? ['h1'] : []));
        const result = momentum([habit()], days, {}, 30, TODAY);
        expect(result.direction).toBe('down');
        expect(result.delta).toBeLessThan(0);
    });

    it('leaves today out, so the number does not sag every morning', () => {
        const days = history(61, (_date, back) => (back === 0 ? [] : ['h1']));
        const result = momentum([habit()], days, {}, 30, TODAY);
        expect(result.window.some(day => day.date === TODAY)).toBe(false);
        expect(result.rate).toBe(100);
    });

    it('does not claim a trend before there is anything to compare with', () => {
        const fresh = habit({ startDate: shiftDay(TODAY, -3) });
        const result = momentum([fresh], history(4, () => ['h1']), {}, 30, TODAY);
        expect(result.comparable).toBe(false);
        expect(result.delta).toBe(0);
        expect(result.direction).toBe('flat');
    });

    it('does not punish adding a habit the way a raw ratio would', () => {
        // Both habits are kept whenever they are due; the newer one only
        // started recently. A rate over a growing denominator would dip.
        const older = habit({ id: 'a', startDate: '2026-01-01' });
        const newer = habit({ id: 'b', startDate: shiftDay(TODAY, -10) });
        const days = history(61, () => ['a', 'b']);
        const result = momentum([older, newer], days, {}, 30, TODAY);
        expect(result.rate).toBe(100);
        expect(result.delta).toBeGreaterThanOrEqual(0);
    });
});

describe('per-habit momentum', () => {
    it('puts the habit that is dragging the rest down first', () => {
        const habits = [habit({ id: 'good', name: 'Good' }), habit({ id: 'bad', name: 'Bad' })];
        const days = history(61, () => ['good']);
        const [worst, best] = habitMomentum(habits, days, {}, 30, TODAY);
        expect(worst.name).toBe('Bad');
        expect(worst.rate).toBe(0);
        expect(best.name).toBe('Good');
        expect(best.rate).toBe(100);
    });

    it('leaves out habits that were never due in the window', () => {
        const future = habit({ id: 'later', startDate: shiftDay(TODAY, 30) });
        expect(habitMomentum([future], [], {}, 30, TODAY)).toEqual([]);
    });
});
