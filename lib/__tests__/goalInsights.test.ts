import { buildGoalInsights, describeSchedule, friendlyDate, goalProgress, summarizeHabit } from '../goalInsights';
import type { Habit } from '../habitsSQLite';
import type { Task } from '../tasks';

const TODAY = '2026-09-19'; // a Saturday
const EVERY_DAY = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const goal = (over: Partial<Habit> = {}): Habit => ({
    id: 'g', name: 'Run a 10K', isGoal: true, startDate: '2026-09-10', targetDate: '2026-09-29',
    createdAt: '2026-09-10T08:00:00.000Z', taskDays: EVERY_DAY, ...over,
} as Habit);

const habit = (over: Partial<Habit> = {}): Habit => ({
    id: 'h', name: 'Run', goalId: 'g', startDate: '2026-09-10', createdAt: '2026-09-10T08:00:00.000Z',
    taskDays: EVERY_DAY, ...over,
} as Habit);

const task = (over: Partial<Task> = {}): Task => ({
    id: Math.random().toString(36).slice(2), title: 'Task', priority: 2, status: 'open', source: 'app',
    goalId: 'g', createdAt: '2026-09-10T08:00:00.000Z', updatedAt: '2026-09-10T08:00:00.000Z', ...over,
});

/** Every day from the 10th to `until`, done. */
const doneThrough = (until: string, id = 'h') => {
    const history: Record<string, string[]> = {};
    for (let day = 10; `2026-09-${String(day).padStart(2, '0')}` <= until; day++) {
        history[`2026-09-${String(day).padStart(2, '0')}`] = [id];
    }
    return history;
};

describe('goal progress', () => {
    it('is the share of the whole plan done, so it only ever rises', () => {
        // 20 scheduled runs (10th to 29th), 10 done so far.
        const insights = buildGoalInsights({ goal: goal(), habits: [habit()], tasks: [], history: doneThrough('2026-09-19'), today: TODAY });
        expect(insights.progress).toBe(50);
        const actuals = insights.series.map(point => point.actual);
        expect([...actuals].sort((a, b) => a - b)).toEqual(actuals);
    });

    it('matches the quick number every other screen shows', () => {
        const input = {
            goal: goal(), habits: [habit()], history: doneThrough('2026-09-15'), today: TODAY,
            tasks: [task({ status: 'done', completedAt: '2026-09-12T10:00:00.000Z' }), task({ dueDate: '2026-09-25' })],
        };
        expect(buildGoalInsights(input).progress).toBe(goalProgress(input));
    });

    it('weighs each habit and each task the same', () => {
        // Habit 10/20 done = 0.5, plus one of two tasks done: (0.5 + 1) / 3.
        const insights = buildGoalInsights({
            goal: goal(), habits: [habit()], history: doneThrough('2026-09-19'), today: TODAY,
            tasks: [task({ status: 'done', completedAt: '2026-09-15T10:00:00.000Z' }), task()],
        });
        expect(insights.progress).toBe(50);
    });

    it('ignores other goals, archived habits and cancelled tasks', () => {
        const insights = buildGoalInsights({
            goal: goal(), today: TODAY, history: {},
            habits: [habit({ goalId: 'other' }), habit({ id: 'a', isArchived: true })],
            tasks: [task({ goalId: 'other' }), task({ status: 'cancelled' })],
        });
        expect(insights.status).toBe('empty');
        expect(insights.progress).toBe(0);
    });

    it('says "on pace" for someone who has done every check-in so far', () => {
        const insights = buildGoalInsights({ goal: goal(), habits: [habit()], tasks: [], history: doneThrough('2026-09-18'), today: TODAY });
        expect(insights.status).toBe('on_pace');
    });

    it('says "behind" when check-ins were missed', () => {
        const insights = buildGoalInsights({ goal: goal(), habits: [habit()], tasks: [], history: doneThrough('2026-09-12'), today: TODAY });
        expect(insights.status).toBe('behind');
    });

    it('reports the gain over the last week', () => {
        const insights = buildGoalInsights({ goal: goal(), habits: [habit()], tasks: [], history: doneThrough('2026-09-19'), today: TODAY });
        // Seven more of twenty runs: 35 points.
        expect(insights.change7).toBe(35);
    });

    it('counts down the days to the target', () => {
        expect(buildGoalInsights({ goal: goal(), habits: [habit()], tasks: [], history: {}, today: TODAY }).daysLeft).toBe(10);
        expect(buildGoalInsights({ goal: goal({ targetDate: undefined }), habits: [habit()], tasks: [], history: {}, today: TODAY }).daysLeft).toBeNull();
    });
});

describe('tasks on a goal', () => {
    it('groups open tasks by overdue, upcoming and undated, each in date order', () => {
        const insights = buildGoalInsights({
            goal: goal(), habits: [], history: {}, today: TODAY,
            tasks: [
                task({ title: 'Later', dueDate: '2026-09-25' }),
                task({ title: 'Late', dueDate: '2026-09-15' }),
                task({ title: 'Soon', dueDate: '2026-09-20' }),
                task({ title: 'Someday' }),
            ],
        });
        expect(insights.tasks.overdue.map(t => t.title)).toEqual(['Late']);
        expect(insights.tasks.upcoming.map(t => t.title)).toEqual(['Soon', 'Later']);
        expect(insights.tasks.undated.map(t => t.title)).toEqual(['Someday']);
    });

    it('puts overdue work first in up next, then by date', () => {
        const insights = buildGoalInsights({
            goal: goal(), habits: [habit()], history: doneThrough('2026-09-19'), today: TODAY,
            tasks: [task({ title: 'Late', dueDate: '2026-09-15' }), task({ title: 'Soon', dueDate: '2026-09-22' })],
        });
        expect(insights.upNext.map(item => item.title)).toEqual(['Late', 'Run', 'Soon']);
        // Run is done today, so its next date is tomorrow.
        expect(insights.upNext[1].date).toBe('2026-09-20');
    });

    it('measures on-time completion from the local day it was done', () => {
        const insights = buildGoalInsights({
            goal: goal(), habits: [], history: {}, today: TODAY,
            tasks: [
                task({ status: 'done', dueDate: '2026-09-15', completedAt: '2026-09-14T10:00:00.000Z' }),
                task({ status: 'done', dueDate: '2026-09-15', completedAt: '2026-09-17T10:00:00.000Z' }),
            ],
        });
        expect(insights.tasks.onTime).toBe(50);
    });
});

describe('a habit on a goal', () => {
    it('shows the last seven days, with today pending until done', () => {
        const summary = summarizeHabit(habit({ taskDays: ['mon', 'wed', 'fri'] }), { '2026-09-14': ['h'], '2026-09-18': ['h'] }, TODAY);
        // 13 Sun .. 19 Sat
        expect(summary.last7).toEqual(['off', 'done', 'off', 'missed', 'off', 'done', 'off']);
        expect(summary.nextDate).toBe('2026-09-21');
        expect(summary.rate30).toBe(50);
    });

    it('does not break the streak for a check-in still due today', () => {
        const summary = summarizeHabit(habit(), doneThrough('2026-09-18'), TODAY);
        expect(summary.streak).toBe(9);
        expect(summary.doneToday).toBe(false);
        expect(summary.nextDate).toBe(TODAY);
    });

    it('describes its schedule in plain words', () => {
        expect(describeSchedule(habit())).toBe('Every day');
        expect(describeSchedule(habit({ taskDays: ['mon', 'tue', 'wed', 'thu', 'fri'], startTime: '07:00' }))).toBe('Weekdays · 07:00');
        expect(describeSchedule(habit({ taskDays: ['sun', 'wed'] }))).toBe('Wed, Sun');
        expect(describeSchedule(habit({ frequency: 'monthly', startDate: '2026-09-03' } as Partial<Habit>))).toBe('Monthly on the 3rd');
    });
});

describe('friendlyDate', () => {
    it('speaks relative to today', () => {
        expect(friendlyDate(TODAY, TODAY)).toBe('Today');
        expect(friendlyDate('2026-09-20', TODAY)).toBe('Tomorrow');
        expect(friendlyDate('2026-09-18', TODAY)).toBe('Yesterday');
    });
});

describe('combineSeries', () => {
    const { combineSeries } = require('../goalInsights');
    it('counts every goal on every day, 0 before it starts and its last value after it ends', () => {
        const a = [{ date: '2026-09-01', actual: 10, pace: 10 }, { date: '2026-09-02', actual: 20, pace: 20 }, { date: '2026-09-03', actual: 30, pace: 30 }];
        const b = [{ date: '2026-09-02', actual: 50, pace: 40 }];
        expect(combineSeries([a, b])).toEqual([
            { date: '2026-09-01', actual: 5, pace: 5 },
            { date: '2026-09-02', actual: 35, pace: 30 },
            { date: '2026-09-03', actual: 40, pace: 35 },
        ]);
    });

    it('never drops when a new goal starts', () => {
        const old = [{ date: '2026-09-01', actual: 60, pace: 60 }, { date: '2026-09-02', actual: 70, pace: 70 }];
        const fresh = [{ date: '2026-09-02', actual: 0, pace: 0 }];
        const line = combineSeries([old, fresh]).map((point: { actual: number }) => point.actual);
        expect(line).toEqual([30, 35]);
    });

    it('is empty with nothing to combine', () => {
        expect(combineSeries([[], []])).toEqual([]);
    });
});

describe('skipping a day on purpose', () => {
    const habitDaily = habit();
    const skipOn = (days: string[]) => Object.fromEntries(days.map(day => [day, ['h']]));

    it('does not count as a miss on the week strip', () => {
        const summary = summarizeHabit(habitDaily, doneThrough('2026-09-17'), TODAY, skipOn(['2026-09-18']));
        // 13th to 19th: done through the 17th, skipped on the 18th, today pending.
        expect(summary.last7).toEqual(['done', 'done', 'done', 'done', 'done', 'skipped', 'pending']);
    });

    it('does not break a streak', () => {
        const withSkip = summarizeHabit(habitDaily, doneThrough('2026-09-17'), TODAY, skipOn(['2026-09-18']));
        const withMiss = summarizeHabit(habitDaily, doneThrough('2026-09-17'), TODAY);
        expect(withSkip.streak).toBe(8);
        // The same history with no skip recorded is a broken streak.
        expect(withMiss.streak).toBe(0);
    });

    it('is left out of the last 30 days rate, rather than counted against it', () => {
        const rated = summarizeHabit(habitDaily, doneThrough('2026-09-17'), TODAY, skipOn(['2026-09-18']));
        expect(rated.rate30).toBe(100);
    });

    it('is not part of what a goal asks of you', () => {
        // 20 days of runs, two of them skipped: 10 done out of the 18 that count.
        const input = {
            goal: goal(), habits: [habitDaily], tasks: [], today: TODAY,
            history: doneThrough('2026-09-19'),
            skips: skipOn(['2026-09-27', '2026-09-28']),
        };
        expect(goalProgress(input)).toBe(56);
        expect(buildGoalInsights(input).progress).toBe(56);
    });

    it('moves the next due day along', () => {
        const summary = summarizeHabit(habitDaily, {}, TODAY, skipOn([TODAY]));
        expect(summary.nextDate).toBe('2026-09-20');
        expect(summary.scheduledToday).toBe(false);
    });
});

describe('a goal that names a number', () => {
    const spec = (target: number, unit = 'books') =>
        JSON.stringify({ title: 'Read 4 books', target, metric_unit: unit });

    /** Read 4 books, with one habit worth 2 books, due once on the 10th. */
    const books = (over: Partial<Habit> = {}) => goal({
        name: 'Read 4 books', goalSpec: spec(4), unit: 'books', ...over,
    });
    const reading = (over: Partial<Habit> = {}) => habit({
        name: 'Read 2 books', goalValue: 2, unit: 'books', taskDays: ['thu'], ...over,
    });

    it('is half done when a habit worth two of its four is completed', () => {
        // The reported bug: perfect adherence to the schedule was reported as
        // a finished goal, though only two of the four books were read.
        const progress = goalProgress({
            goal: books(), habits: [reading()], tasks: [],
            history: { '2026-09-10': ['h'] }, today: TODAY,
        });
        expect(progress).toBe(50);
    });

    it('reaches a hundred only once the number is actually met', () => {
        const twice = { '2026-09-10': ['h'], '2026-09-17': ['h'] };
        expect(goalProgress({
            goal: books(), habits: [reading()], tasks: [], history: twice, today: TODAY,
        })).toBe(100);
    });

    it('never exceeds a hundred when the habits overshoot', () => {
        const thrice = { '2026-09-10': ['h'], '2026-09-17': ['h'], '2026-09-24': ['h'] };
        expect(goalProgress({
            goal: books(), habits: [reading()], tasks: [], history: thrice, today: TODAY,
        })).toBeLessThanOrEqual(100);
    });

    it('ignores a habit measured in a unit that cannot add up to the goal', () => {
        // Twenty minutes of reading does not make twenty of four books. A number
        // goal reads "this much of that much", so it stays at 0 of 4 books
        // rather than borrowing a percentage from how often you read.
        const minutes = reading({ goalValue: 20, unit: 'minutes' });
        const progress = goalProgress({
            goal: books(), habits: [minutes], tasks: [],
            history: { '2026-09-10': ['h'] }, today: TODAY,
        });
        expect(progress).toBe(0);
    });

    it('still measures adherence for a goal that names no number', () => {
        // Every day kept so far, half way through the plan — progress is what
        // has been banked against the whole plan, so it reads 50.
        const daily = goal({ name: 'Meditate daily' });
        expect(goalProgress({
            goal: daily, habits: [habit()], tasks: [],
            history: doneThrough(TODAY), today: TODAY,
        })).toBe(50);
    });

    it('lets the chart agree with the headline', () => {
        const insights = buildGoalInsights({
            goal: books(), habits: [reading()], tasks: [],
            history: { '2026-09-10': ['h'] }, today: TODAY,
        });
        expect(insights.progress).toBe(50);
        expect(insights.series[insights.series.length - 1].actual).toBe(50);
    });
});

describe('goal kinds', () => {
    const spec = (value: object) => JSON.stringify(value);

    it('spreads what is left over the days left, so a missed day raises the daily figure', () => {
        // 2000 calls in 30 days (Sept 1-30). 133 done over the first two days,
        // nothing on the third: on the fourth, 1867 are left for 27 days.
        const calls = goal({
            name: 'Make 2000 calls', startDate: '2026-09-01', targetDate: '2026-09-30',
            goalSpec: spec({ kind: 'number', target: 2000, metric_unit: 'calls' }),
        });
        const log = (id: string, amount: number, day: string): Task => task({
            id, measure: 'count', target: amount, unit: 'calls', status: 'done',
            completedAt: `${day}T15:00:00`, updatedAt: `${day}T15:00:00`,
        });
        const insights = buildGoalInsights({
            goal: calls, habits: [], tasks: [log('a', 67, '2026-09-01'), log('b', 66, '2026-09-02')],
            history: {}, today: '2026-09-04',
        });
        expect(insights.measure.done).toBe(133);
        expect(insights.measure.total).toBe(2000);
        expect(insights.measure.daysLeft).toBe(27);
        expect(insights.measure.perDay).toBeCloseTo(69.1, 1);
        expect(insights.measure.leftToday).toBeCloseTo(69.1, 1);
        // The chart can say "133 / 2000", not only a percentage.
        expect(insights.series[insights.series.length - 1].value).toBe(133);
    });

    it('counts a complete goal as tasks done out of all its tasks', () => {
        const launch = goal({ name: 'Launch Habyss', goalSpec: spec({ kind: 'complete', milestones: [{ id: 'm1', title: 'Onboarding' }, { id: 'm2', title: 'Dashboard' }] }) });
        const tasks = [
            task({ milestoneId: 'm1', status: 'done', completedAt: '2026-09-12T10:00:00' }),
            task({ milestoneId: 'm1', status: 'done', completedAt: '2026-09-13T10:00:00' }),
            task({ milestoneId: 'm2' }),
            task({ milestoneId: 'm2' }),
        ];
        const insights = buildGoalInsights({ goal: launch, habits: [habit()], tasks, history: doneThrough(TODAY), today: TODAY });
        expect(insights.measure).toMatchObject({ kind: 'complete', done: 2, total: 4, unit: 'tasks' });
        expect(insights.progress).toBe(50);
        expect(insights.milestones.map(step => [step.milestone.title, step.done, step.total, step.complete]))
            .toEqual([['Onboarding', 2, 2, true], ['Dashboard', 0, 2, false]]);
    });

    it('measures a time goal in minutes, from timed habits and time tasks', () => {
        const piano = goal({ goalSpec: spec({ kind: 'time', target: 600, metric_unit: 'minutes' }) });
        const practice = habit({ goalValue: 30, unit: 'minutes' });
        const lesson = task({ measure: 'time', target: 90, amount: 45, updatedAt: '2026-09-18T10:00:00' });
        const insights = buildGoalInsights({
            goal: piano, habits: [practice], tasks: [lesson],
            history: { '2026-09-10': ['h'], '2026-09-11': ['h'] }, today: TODAY,
        });
        expect(insights.measure).toMatchObject({ kind: 'time', done: 105, total: 600, unit: 'minutes' });
    });
});
