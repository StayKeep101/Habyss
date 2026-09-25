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
