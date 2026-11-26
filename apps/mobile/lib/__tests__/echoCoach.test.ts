import { computeInsights, weekdayPattern } from '../echoInsights';
import { buildWeeklyReview } from '../weeklyReview';
import { evaluate, proposeExperiment, type Experiment } from '../echoExperiments';
import { helpRanking, resolveHelps, type HelpTried } from '../echoMemory';
import { acceptStep, firstStepFor, tipFor } from '../firstStep';
import { soundsLikeCrisis } from '../echoSafety';
import { habitDays, shiftDay, type HistoryDay } from '../habitDays';
import type { Habit } from '../habitsSQLite';
import type { Task } from '../tasks';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) }));

const TODAY = '2026-10-16'; // a Friday
const EVERY_DAY = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const habit = (over: Partial<Habit> = {}): Habit => ({
    id: 'h', name: 'Read', startDate: '2026-08-01', createdAt: '2026-08-01T09:00:00', taskDays: EVERY_DAY, ...over,
} as Habit);
const task = (over: Partial<Task> = {}): Task => ({
    id: 't', title: 'Write the report', priority: 2, status: 'open', source: 'app', createdAt: '2026-10-01', updatedAt: '2026-10-01', ...over,
} as Task);

/** History with the habit done on the days `done` says, for `days` days ending yesterday. */
const historyOf = (id: string, days: number, done: (index: number, date: string) => boolean): HistoryDay[] =>
    Array.from({ length: days }, (_, index) => {
        const date = shiftDay(TODAY, -(days - index));
        return { date, completedIds: done(index, date) ? [id] : [] };
    });

const base = { tasks: [] as Task[], completions: {}, today: TODAY, voice: 'normal' as const };

describe('Echo only says what the record shows', () => {
    it('says nothing at all with no data', () => {
        expect(computeInsights({ ...base, habits: [], history: [] })).toEqual([]);
    });

    it('flags a habit missed last time and due again today (never miss twice)', () => {
        const history = historyOf('h', 10, index => index < 9); // done every day but yesterday
        const insights = computeInsights({ ...base, habits: [habit()], history });
        const top = insights[0];
        expect(top.kind).toBe('missed_twice');
        expect(top.action).toEqual({ type: 'start', item: 'habit:h', title: 'Read' });
        expect(top.evidence).toContain(shiftDay(TODAY, -1));
    });

    it('offers a two-minute start for a task stuck for days, with the real number of days', () => {
        const insights = computeInsights({ ...base, habits: [], history: [], tasks: [task({ dueDate: shiftDay(TODAY, -4) })] });
        const stuck = insights.find(item => item.kind === 'stuck_task')!;
        expect(stuck.text).toContain('4 days');
        expect(stuck.action).toMatchObject({ type: 'start', item: 'task:t' });
    });

    it('does not call a task stuck when it is only a day late', () => {
        const insights = computeInsights({ ...base, habits: [], history: [], tasks: [task({ dueDate: shiftDay(TODAY, -1) })] });
        expect(insights.some(item => item.kind === 'stuck_task')).toBe(false);
    });

    it('warns about a heavy day against what this person usually finishes', () => {
        const habits = [habit()];
        const history = historyOf('h', 14, () => true); // usually finishes 1 a day
        const tasks = Array.from({ length: 7 }, (_, index) => task({ id: `t${index}`, title: `Task ${index}`, dueDate: TODAY }));
        const heavy = computeInsights({ ...base, habits, history, tasks }).find(item => item.kind === 'heavy_day')!;
        expect(heavy.evidence).toMatch(/8 due today; about 1 done/);
    });

    it('keeps a dismissed insight away until the day it was dismissed to', () => {
        const tasks = [task({ dueDate: shiftDay(TODAY, -4) })];
        const insights = computeInsights({ ...base, habits: [], history: [], tasks, dismissed: { 'stuck_task:t': shiftDay(TODAY, 3) } });
        expect(insights.some(item => item.id === 'stuck_task:t')).toBe(false);
    });

    it('speaks in the chosen voice without changing the facts', () => {
        const tasks = [task({ dueDate: shiftDay(TODAY, -4) })];
        const gentle = computeInsights({ ...base, voice: 'friendly', habits: [], history: [], tasks })[0];
        const firm = computeInsights({ ...base, voice: 'dad_mode', habits: [], history: [], tasks })[0];
        expect(gentle.text).not.toEqual(firm.text);
        expect(gentle.evidence).toEqual(firm.evidence);
        expect(firm.text).not.toMatch(/lazy|stupid|pathetic|loser/i);
    });

    it('only names a weekday pattern with enough weekdays and weekends to be fair', () => {
        const history = historyOf('h', 56, (_index, date) => {
            const [y, m, d] = date.split('-').map(Number);
            const dow = new Date(y, m - 1, d).getDay();
            return dow !== 0 && dow !== 6; // only on weekdays
        });
        const days = habitDays([habit()], history, {}, 56, shiftDay(TODAY, -1), TODAY);
        expect(weekdayPattern(days, 'h')?.better).toBe('weekdays');
        expect(weekdayPattern(days.slice(-6), 'h')).toBeNull(); // too few days
    });
});

describe('the weekly review', () => {
    it('counts what held, what got harder, and the bounce-backs', () => {
        const habits = [habit({ id: 'a', name: 'Run' }), habit({ id: 'b', name: 'Read' })];
        const weekStart = '2026-10-05';
        const history: HistoryDay[] = [];
        for (let i = 0; i < 14; i++) {
            const date = shiftDay('2026-09-28', i);
            const thisWeek = date >= weekStart;
            const ids = ['a'];
            // Read: every day last week; this week only on alternate days.
            if (!thisWeek || i % 2 === 0) ids.push('b');
            history.push({ date, completedIds: ids });
        }
        const review = buildWeeklyReview({ habits, tasks: [], history, completions: {}, today: TODAY, weekStart });
        expect(review.soFar).toBe(false);
        expect(review.held.map(item => item.name)).toEqual(['Run']);
        expect(review.harder.map(item => item.name)).toEqual(['Read']);
        expect(review.bouncedBack).toBeGreaterThan(0);
        expect(review.tryNext[0]).toContain('Read');
    });
});

describe('experiments', () => {
    it('proposes the morning for a habit set late, and a smaller version for a big target', () => {
        expect(proposeExperiment(habit({ startTime: '20:00' }))?.type).toBe('morning');
        expect(proposeExperiment(habit({ unit: 'pages', goalValue: 30 }))).toMatchObject({ type: 'smaller', after: { goalValue: 15 } });
        expect(proposeExperiment(habit())).toBeNull();
    });

    it('compares the test week with the baseline and says how sure it is', () => {
        const experiment: Experiment = {
            id: 'x', habitId: 'h', habitName: 'Read', type: 'morning', before: { startTime: '20:00' }, after: { startTime: '08:00' },
            startedOn: shiftDay(TODAY, -7), days: 7, baseline: { kept: 4, countable: 14, rate: 29 }, status: 'running',
        };
        const history = historyOf('h', 7, () => true);
        const verdict = evaluate(experiment, [habit()], history, {}, TODAY);
        expect(verdict.done).toBe(true);
        expect(verdict.call).toBe('better');
        expect(verdict.text).toMatch(/hint/);
    });

    it('will not judge after too few days', () => {
        const experiment: Experiment = {
            id: 'x', habitId: 'h', habitName: 'Read', type: 'morning', before: {}, after: { startTime: '08:00' },
            startedOn: shiftDay(TODAY, -1), days: 7, baseline: { kept: 4, countable: 14, rate: 29 }, status: 'running',
        };
        expect(evaluate(experiment, [habit()], historyOf('h', 1, () => true), {}, TODAY).call).toBe('too_early');
    });
});

describe('learning which help works', () => {
    it('marks help done when the thing was finished that day or the next, and not only once the next day is over', () => {
        const helps: HelpTried[] = [
            { id: '1', type: 'two_minute', item: 'task:a', day: '2026-10-10' },
            { id: '2', type: 'five_minute', item: 'task:b', day: '2026-10-10' },
            { id: '3', type: 'plan', item: 'task:c', day: '2026-10-15' },
        ];
        const resolved = resolveHelps(helps, item => item === 'task:a', TODAY);
        expect(resolved.map(help => help.outcome)).toEqual(['done', 'not', undefined]);
    });

    it('ranks the help that actually worked first, without one try deciding it', () => {
        const helps: HelpTried[] = [
            ...Array.from({ length: 4 }, (_, i) => ({ id: `a${i}`, type: 'five_minute' as const, item: 'x', day: 'd', outcome: 'done' as const })),
            { id: 'b', type: 'two_minute', item: 'x', day: 'd', outcome: 'not' },
        ];
        expect(helpRanking(helps)[0].type).toBe('five_minute');
        expect(helpRanking([])[0].score).toBe(0.5);
    });
});

describe('getting started', () => {
    it('gives a concrete first step for common tasks and a safe default otherwise', () => {
        expect(firstStepFor('Write the essay')).toMatch(/one rough sentence/);
        expect(firstStepFor('Go to the gym')).toMatch(/shoes/);
        expect(firstStepFor('Plan the trip')).toContain('Plan the trip');
        expect(tipFor('distracted')).toMatch(/Phone/);
    });

    it('rejects a model answer that invents numbers or rambles', () => {
        expect(acceptStep('Open the doc and write the title.')).toBe('Open the doc and write the title.');
        expect(acceptStep('Write 500 words now.')).toBeNull();
        expect(acceptStep('Set a 2-minute timer and open the doc.')).not.toBeNull();
        expect(acceptStep('x'.repeat(200))).toBeNull();
    });
});

describe('safety', () => {
    it('recognises clear statements of crisis and not ordinary bad days', () => {
        expect(soundsLikeCrisis('I want to die')).toBe(true);
        expect(soundsLikeCrisis('thinking about hurting myself')).toBe(true);
        expect(soundsLikeCrisis('I might hurt myself')).toBe(true);
        expect(soundsLikeCrisis('this task is killing me lol')).toBe(false);
        expect(soundsLikeCrisis('so tired today')).toBe(false);
    });
});
