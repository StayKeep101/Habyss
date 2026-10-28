import type { Habit } from './habitsSQLite';
import type { Task } from './tasks';

/** Late: past its deadline, or past its day with no deadline (as lib/tasks isLate, kept here free of storage). */
const isLate = (task: Task, today: string) => task.status === 'open' && !!(task.deadline ?? task.dueDate) && (task.deadline ?? task.dueDate)! < today;
import type { GoalKind } from './goalParser';
import { createHabitRequirement, isHabitScheduledForDate, isQuotaHabit, localDateKey, parseHabitDate } from './habitSchedule';
import { countedHistory, countedTasks } from './sharedGate';

/**
 * Everything the goal screen shows, worked out in one place.
 *
 * A goal is made of habits (recurring) and tasks (one-off). How far along it is
 * depends on its kind, and is always "this much out of that much":
 *
 * - number: the amount delivered so far out of the target (750 / 2000 calls).
 *   Habit check-ins and count tasks linked to the goal add to it.
 * - time: the same, in minutes (timed habits and time tasks add to it).
 * - complete: tasks done out of all its tasks (34 / 73 tasks).
 *
 * Progress only ever rises, which is what makes it chartable like a portfolio:
 * the line is what you have banked, and the dashed pace line is where steady
 * work from the start date would have you on each day.
 *
 * What is left is spread over the days that are left, today included — so a
 * missed day raises tomorrow's figure instead of being quietly forgotten.
 */

export type GoalStatus = 'ahead' | 'on_pace' | 'behind' | 'not_started' | 'empty';
export type DayMark = 'done' | 'missed' | 'pending' | 'off' | 'skipped';

export interface GoalPoint {
    date: string;
    /** Percent done by the end of this day. */
    actual: number;
    /** Percent steady work would have reached. */
    pace: number;
    /** The amount done by this day, in the goal's own unit (calls, minutes, tasks). */
    value?: number;
}

/** A goal read as "this much out of that much", and what it now asks per day. */
export interface GoalMeasure {
    kind: GoalKind;
    done: number;
    total: number;
    /** What is being counted: "calls", "minutes", "tasks". */
    unit: string;
    remaining: number;
    /** Days left including today; null for a goal with no finish date. */
    daysLeft: number | null;
    /**
     * What each remaining day now needs, worked out from the start of today:
     * what was left this morning spread over today and the days after it.
     */
    perDay: number | null;
    perWeek: number | null;
    /** Done so far today, and what today still needs to stay on that pace. */
    today: number;
    leftToday: number | null;
    /** Goals reached in one go: the best single effort counts, and this week's planned step. */
    peak?: { thisWeek: number; nextWeek: number } | null;
}

export interface HabitSummary {
    habit: Habit;
    schedule: string;
    /** Next day it is due and not yet done; null once it has ended. */
    nextDate: string | null;
    scheduledToday: boolean;
    doneToday: boolean;
    /** Oldest first, ending today. */
    last7: DayMark[];
    /** Share of scheduled days done over the last 30 days; null with none scheduled. */
    rate30: number | null;
    streak: number;
}

export interface UpNextItem {
    kind: 'habit' | 'task';
    id: string;
    title: string;
    date: string;
    time?: string;
    overdue: boolean;
}

export interface GoalInsights {
    progress: number;
    /** Where a perfectly consistent plan would be by the end of yesterday. */
    pace: number;
    status: GoalStatus;
    /** Points of progress gained over the last seven days. */
    change7: number;
    series: GoalPoint[];
    startDate: string;
    endDate: string;
    daysLeft: number | null;
    habitRate30: number | null;
    tasks: {
        done: number;
        total: number;
        onTime: number | null;
        overdue: Task[];
        upcoming: Task[];
        undated: Task[];
        completed: Task[];
    };
    habits: HabitSummary[];
    upNext: UpNextItem[];
    measure: GoalMeasure;
}

export interface GoalInsightInput {
    goal: Habit;
    habits: Habit[];
    tasks: Task[];
    /** Completed habit ids by local date, today included. */
    history: Record<string, string[]>;
    /**
     * Habit ids deliberately skipped, by date. A skipped day counts as if the
     * habit had not been scheduled: never a miss, never part of the total.
     */
    skips?: Record<string, string[]>;
    /** Progress written straight onto this goal (lib/goalLogs.ts). */
    logs?: { date: string; amount: number }[];
    today: string;
}

/** Keeps the status honest without flapping over a single missed check-in. */
const PACE_TOLERANCE = 5;
const NEXT_DATE_HORIZON = 400;

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function dateAt(key: string): Date {
    return new Date(`${key}T12:00:00`);
}

export function addDays(key: string, days: number): string {
    const date = dateAt(key);
    date.setDate(date.getDate() + days);
    return localDateKey(date);
}

export function daysBetween(from: string, to: string): number {
    return Math.round((dateAt(to).getTime() - dateAt(from).getTime()) / 86_400_000);
}

const doneOn = (task: Task): string | null => {
    if (task.status !== 'done') return null;
    const stamp = task.completedAt ?? task.updatedAt;
    const parsed = stamp ? new Date(stamp) : null;
    return parsed && Number.isFinite(parsed.getTime()) ? localDateKey(parsed) : null;
};

export function goalRange(goal: Habit, today: string): { start: string; end: string } {
    const start = parseHabitDate(goal.startDate) ?? parseHabitDate(goal.createdAt) ?? dateAt(today);
    const target = parseHabitDate(goal.targetDate);
    return { start: localDateKey(start), end: target ? localDateKey(target) : today };
}

/**
 * The number a goal names, when it names one.
 *
 * "Read 4 books" wants four books; how faithfully you kept to a reading
 * schedule is a different question. Adherence is the right measure for "meditate
 * daily", and the wrong one here — a habit worth two books, completed once and
 * on time, is perfect adherence and half the goal.
 */
export function goalTarget(goal: Habit): { amount: number; unit: string } | null {
    try {
        const spec = goal.goalSpec ? JSON.parse(goal.goalSpec) : null;
        const amount = Number(spec?.target);
        if (Number.isFinite(amount) && amount > 0) {
            return { amount, unit: String(spec?.metric_unit ?? goal.unit ?? '').trim().toLowerCase() };
        }
    } catch {
        // A goal whose spec will not parse simply has no target.
    }
    return null;
}

/**
 * The habits whose measurements can be added up against that number.
 *
 * Units have to agree, or the sum is nonsense — twenty minutes of reading does
 * not make twenty of four books. An unstated unit on either side is taken as
 * agreement, since that is the common case for a goal and its own habit.
 */
export function contributingHabits(habits: Habit[], target: { unit: string }): Habit[] {
    return habits.filter(habit => {
        if (!(Number(habit.goalValue) > 0)) return false;
        const unit = String(habit.unit ?? '').trim().toLowerCase();
        return !unit || !target.unit || unit === target.unit;
    });
}

/** What one check-in of this habit delivers toward the goal's number. */
export function contribution(habit: Habit): number {
    const value = Number(habit.goalValue);
    return Number.isFinite(value) && value > 0 ? value : 1;
}

const readSpec = (goal: Habit): Record<string, any> => {
    try { return goal.goalSpec ? JSON.parse(goal.goalSpec) ?? {} : {}; } catch { return {}; }
};

const MINUTES_PER: Record<string, number> = {
    second: 1 / 60, seconds: 1 / 60, sec: 1 / 60, secs: 1 / 60,
    minute: 1, minutes: 1, min: 1, mins: 1,
    hour: 60, hours: 60, hr: 60, hrs: 60, h: 60,
};

/** Units that only say "how many", which any count can be added to. */
const GENERIC_UNITS = new Set(['', 'count', 'times', 'time', 'x', 'sessions', 'session']);

/** Which kind of goal this is; older goals are read from their target. */
export function goalKind(goal: Habit): GoalKind {
    const kind = readSpec(goal).kind;
    if (kind === 'number' || kind === 'complete' || kind === 'time') return kind;
    const target = goalTarget(goal);
    if (!target) return 'complete';
    return MINUTES_PER[target.unit] ? 'time' : 'number';
}

/** What one check-in of a habit delivers toward a time goal, in minutes. */
export function minutesPerCheckIn(habit: Habit): number {
    const factor = MINUTES_PER[String(habit.unit ?? '').trim().toLowerCase()];
    if (factor) return contribution(habit) * factor;
    return Number(habit.durationMinutes) > 0 ? Number(habit.durationMinutes) : 0;
}

/** How much a task has delivered toward a number or time goal. */
function taskAmount(task: Task, kind: GoalKind, unit: string): number {
    if (!task.measure || !task.target) return 0;
    const amount = task.status === 'done' ? Math.max(task.amount ?? 0, task.target) : (task.amount ?? 0);
    if (kind === 'time') return task.measure === 'time' ? amount : 0;
    if (kind !== 'number' || task.measure !== 'count') return 0;
    const own = String(task.unit ?? '').trim().toLowerCase();
    return GENERIC_UNITS.has(own) || GENERIC_UNITS.has(unit) || own === unit || own.replace(/s$/, '') === unit.replace(/s$/, '') ? amount : 0;
}

/** The day a task's amount landed: when it was finished, or last moved. */
const taskDay = (task: Task): string | null => {
    const stamp = task.status === 'done' ? (task.completedAt ?? task.updatedAt) : task.updatedAt;
    const parsed = stamp ? new Date(stamp) : null;
    return parsed && Number.isFinite(parsed.getTime()) ? localDateKey(parsed) : null;
};

/**
 * The goal as one cumulative number by day, from its start to today.
 *
 * Returned per day so the chart and the headline come from the same place and
 * cannot disagree.
 */
function measureByDay(input: GoalInsightInput): {
    kind: GoalKind; unit: string; total: number; byDay: Map<string, number>; peak?: boolean; latest?: boolean;
} {
    const { goal, today } = input;
    const habits = linkedHabits(goal, input.habits);
    const tasks = linkedTasks(goal, input.tasks);
    const { start, end } = goalRange(goal, today);
    const last = today < end ? today : end;
    const byDay = new Map<string, number>();
    const add = (day: string | null, amount: number) => {
        if (!day || !amount) return;
        byDay.set(day, (byDay.get(day) ?? 0) + amount);
    };
    let kind = goalKind(goal);
    const target = goalTarget(goal);
    // Reached in one go ("run 21 km"): each day's best effort, never a sum.
    const peak = readSpec(goal).aggregation === 'max';
    const best = (day: string | null, amount: number) => {
        if (!day || !amount) return;
        byDay.set(day, Math.max(byDay.get(day) ?? 0, amount));
    };
    const { targetOn } = require('./peakPlan') as typeof import('./peakPlan');
    const logs = (input.logs ?? []).filter(log => log.date <= today);

    // A level you reach (a GPA, a weight, a net worth): only the latest value
    // logged counts, never a sum, and habits do not add to it. Going up with no
    // starting point given, it counts from zero (5.6 of a 7 GPA is 80%); going
    // down, from the first value logged. Done once a log reaches the target.
    const spec = readSpec(goal);
    if (spec.aggregation === 'latest') {
        const delta = Number(spec.delta_from_baseline);
        const given = Number.isFinite(Number(spec.baseline)) && spec.baseline !== null && spec.baseline !== undefined ? Number(spec.baseline) : null;
        const first = logs[0]?.amount;
        // Down only when the goal says so: "lose 5 kg", a start above the
        // target, at most, or a body weight logged above it. Otherwise up from zero.
        const weight = /^(kg|kgs|lb|lbs|pounds?|kilos?)$/.test(String(spec.metric_unit ?? target?.unit ?? '').trim().toLowerCase());
        const downward = Number.isFinite(delta) || (given !== null && target !== null && given > target.amount)
            || spec.direction === 'at_most' || (weight && target !== null && first !== undefined && first > target.amount);
        const baseline = given ?? (downward ? first ?? 0 : 0);
        const goalValue = target?.amount ?? (Number.isFinite(delta) ? baseline - delta : null);
        if (!logs.length) return { kind: 'number', unit: target?.unit || String(spec.metric_unit ?? ''), total: goalValue === null ? 1 : Math.abs(goalValue - baseline) || 1, byDay, latest: true };
        if (goalValue !== null && goalValue !== baseline) {
            const towards = Math.sign(goalValue - baseline);
            const total = Math.abs(goalValue - baseline);
            for (const log of logs) byDay.set(log.date, Math.max(0, Math.min(total, (log.amount - baseline) * towards)));
            return { kind: 'number', unit: target?.unit || String(spec.metric_unit ?? ''), total, byDay, latest: true };
        }
    }

    if (kind !== 'complete' && target) {
        const unit = kind === 'time' ? 'minutes' : target.unit;
        const total = kind === 'time' ? target.amount * (MINUTES_PER[target.unit] ?? 1) : target.amount;
        const counted = kind === 'time'
            ? habits.filter(habit => minutesPerCheckIn(habit) > 0)
            : habits.filter(habit => {
                if (!(Number(habit.goalValue) > 0)) return false;
                const own = String(habit.unit ?? '').trim().toLowerCase();
                return GENERIC_UNITS.has(own) || GENERIC_UNITS.has(unit) || own === unit;
            });
        for (let day = start; day <= last; day = addDays(day, 1)) {
            const doneIds = new Set(input.history[day]);
            for (const habit of counted) {
                if (!doneIds.has(habit.id)) continue;
                // A one-go goal counts the run at the distance it was that day.
                if (peak) best(day, targetOn(habit.id, day, contribution(habit)));
                else add(day, kind === 'time' ? minutesPerCheckIn(habit) : contribution(habit));
            }
        }
        for (const task of tasks) (peak ? best : add)(taskDay(task), taskAmount(task, kind, unit));
        // Written straight onto the goal: added up, or the best for a one-go goal.
        for (const log of logs) (peak ? best : add)(log.date, kind === 'time' ? log.amount * (MINUTES_PER[target.unit] ?? 1) : log.amount);
        return { kind, unit, total, byDay, peak };
    }

    // A complete goal, or one with no number: tasks done out of all of them.
    kind = 'complete';
    if (tasks.length > 0) {
        for (const task of tasks) if (task.status === 'done') add(doneOn(task), 1);
        return { kind, unit: 'tasks', total: tasks.length, byDay };
    }

    // Only habits so far: check-ins kept out of all those scheduled.
    const schedules = habits.map(habit => ({ habit, due: createHabitRequirement(habit), quota: isQuotaHabit(habit) }));
    let total = 0;
    for (let day = start; day <= end; day = addDays(day, 1)) {
        const doneIds = new Set(input.history[day]);
        for (const { habit, due, quota } of schedules) {
            const doneOn = (key: string) => !!input.history[key]?.includes(habit.id);
            if (!(due(day, doneOn) || (quota && doneOn(day))) || wasSkipped(input.skips, day, habit.id)) continue;
            total++;
            if (day <= today && doneIds.has(habit.id)) add(day, 1);
        }
    }
    return { kind, unit: 'check-ins', total, byDay };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** "this much out of that much", and what every remaining day now needs. */
export function goalMeasure(input: GoalInsightInput, measured = measureByDay(input)): GoalMeasure {
    const { kind, unit, total, byDay } = measured;
    const { start, end } = goalRange(input.goal, input.today);
    let done = 0;
    let beforeToday = 0;
    if (measured.latest) {
        // A level: where the latest value stands, not a sum.
        const days = [...byDay.keys()].filter(day => day <= input.today).sort();
        const last = days[days.length - 1];
        const lastBefore = days.filter(day => day < input.today).pop();
        done = last ? byDay.get(last)! : 0;
        beforeToday = lastBefore ? byDay.get(lastBefore)! : 0;
        const dated = !!input.goal.targetDate;
        return {
            kind, done: round1(done), total: round1(total), unit, remaining: round1(Math.max(0, total - done)),
            daysLeft: dated ? Math.max(0, daysBetween(input.today < start ? start : input.today, end) + 1) : null,
            perDay: null, perWeek: null, today: round1(done - beforeToday), leftToday: null,
        };
    }
    for (const [day, amount] of byDay) {
        // Finished before the goal started still counts, as day one.
        if (day > input.today) continue;
        // One go: the best effort so far. Otherwise the running total.
        done = measured.peak ? Math.max(done, amount) : done + amount;
        if (day < input.today) beforeToday = measured.peak ? Math.max(beforeToday, amount) : beforeToday + amount;
    }
    if (measured.peak) {
        const spec = readSpec(input.goal);
        const { plannedFor, defaultBaseline, stepFor } = require('./peakPlan') as typeof import('./peakPlan');
        const baseline = Number(spec.baseline) || defaultBaseline(total);
        const plan = (day: string) => plannedFor(day, start, end, baseline, total, stepFor(unit));
        return {
            kind, done: round1(done), total: round1(total), unit,
            remaining: round1(Math.max(0, total - done)),
            daysLeft: input.goal.targetDate ? Math.max(0, daysBetween(input.today < start ? start : input.today, end) + 1) : null,
            perDay: null, perWeek: null, today: round1(done - beforeToday), leftToday: null,
            peak: input.goal.targetDate ? { thisWeek: plan(input.today), nextWeek: plan(addDays(input.today, 7)) } : null,
        };
    }
    const remaining = Math.max(0, total - done);
    const dated = !!input.goal.targetDate;
    const daysLeft = dated ? Math.max(0, daysBetween(input.today < start ? start : input.today, end) + 1) : null;
    const leftThisMorning = Math.max(0, total - beforeToday);
    const perDay = daysLeft ? leftThisMorning / daysLeft : null;
    const todayAmount = done - beforeToday;
    return {
        kind, done: round1(done), total: round1(total), unit,
        remaining: round1(remaining),
        daysLeft,
        perDay: perDay === null ? null : round1(perDay),
        perWeek: perDay === null || daysLeft === null ? null : round1(daysLeft >= 7 ? perDay * 7 : leftThisMorning),
        today: round1(todayAmount),
        leftToday: perDay === null ? null : round1(Math.max(0, perDay - todayAmount)),
    };
}

export function linkedHabits(goal: Habit, habits: Habit[]): Habit[] {
    return habits.filter(habit => habit.goalId === goal.id && !habit.isGoal && !habit.isArchived);
}

export function linkedTasks(goal: Habit, tasks: Task[]): Task[] {
    return tasks.filter(task => task.goalId === goal.id && task.status !== 'cancelled');
}

const wasSkipped = (skips: Record<string, string[]> | undefined, day: string, habitId: string): boolean =>
    !!skips?.[day]?.includes(habitId);

/** Progress today only; the cheap path for lists of goals. */
/**
 * The day a goal first reached its target, or null if it has not. A goal is
 * done from that day on: off the active lists, a trophy on the profile.
 * Once reached it is written onto the goal (completed_on, see goalCompletedOn),
 * so moving its habits elsewhere later never undoes it.
 */
export function goalDoneOn(insights: GoalInsights | undefined, goal?: Habit): string | null {
    const saved = goal ? goalCompletedOn(goal) : null;
    if (saved) return saved;
    if (!insights) return null;
    // A level with a deadline (a 7 CGPA by December): judged on the deadline,
    // by the latest number logged by then. Reaching 7 in November and falling
    // to 6 is not reaching it. A best effort or a total is reached once reached.
    if (goal && readSpec(goal).aggregation === 'latest' && goal.targetDate) {
        const end = insights.endDate;
        const last = insights.series.filter(point => point.date <= end).pop();
        return last && last.date === end && last.actual >= 100 ? end : null;
    }
    return insights.series.find(point => point.actual >= 100)?.date ?? null;
}

/** The day this goal was reached, as saved on it; null while it is still open. */
export function goalCompletedOn(goal: Habit): string | null {
    const on = readSpec(goal).completed_on;
    return typeof on === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(on) ? on : null;
}

/** The goal's spec with the day it was reached written in, to save onto it. */
export function withCompletedOn(goal: Habit, day: string): string {
    return JSON.stringify({ ...readSpec(goal), completed_on: day });
}

export function goalProgress(input: GoalInsightInput, rounded = true): number {
    const { done, total } = goalMeasure(input);
    const progress = total > 0 ? Math.min(100, (done / total) * 100) : 0;
    return rounded ? Math.round(progress) : progress;
}

export function buildGoalInsights(input: GoalInsightInput): GoalInsights {
    // Shared work moves a goal once everybody on it has done their part.
    input = { ...input, history: countedHistory(input.history), tasks: countedTasks(input.tasks) };
    const { goal, history, today } = input;
    const habits = linkedHabits(goal, input.habits);
    const tasks = linkedTasks(goal, input.tasks);
    const { start, end } = goalRange(goal, today);
    const units = habits.length + tasks.length;
    const measured = measureByDay(input);
    const { byDay } = measured;
    const measure = goalMeasure(input, measured);

    // Banked by each day against steady work from the start: the two lines.
    const series: GoalPoint[] = [];
    const lastDay = today < end ? today : end;
    const span = Math.max(1, daysBetween(start, end) + 1);
    const total = measure.total;
    let soFar = 0;
    // One-go goals chart the best so far; others the running total.
    // A level charts the latest value written, carried forward between entries.
    const step = (from: number, amount: number) => measured.latest ? amount : measured.peak ? Math.max(from, amount) : from + amount;
    for (const [day, amount] of [...byDay].sort(([a], [b]) => a.localeCompare(b))) if (day < start) soFar = step(soFar, amount);
    for (let day = start, index = 1; day <= lastDay; day = addDays(day, 1), index++) {
        if (!measured.latest || byDay.has(day)) soFar = step(soFar, byDay.get(day) ?? 0);
        series.push({
            date: day,
            actual: total ? Math.round(Math.min(1, soFar / total) * 1000) / 10 : 0,
            pace: Math.round(Math.min(1, index / span) * 1000) / 10,
            value: round1(soFar),
        });
    }

    const progress = total ? Math.min(100, Math.round((measure.done / total) * 100)) : 0;
    if (series.length) series[series.length - 1].actual = progress;

    const pace = series.length >= 2 ? series[series.length - 2].pace : 0;
    const weekAgo = series.length > 7 ? series[series.length - 8].actual : 0;
    const change7 = series.length ? Math.round(progress - weekAgo) : 0;

    let status: GoalStatus;
    if (units === 0 && measure.done === 0) status = 'empty';
    else if (today < start) status = 'not_started';
    else if (progress >= pace + PACE_TOLERANCE) status = 'ahead';
    else if (progress <= pace - PACE_TOLERANCE) status = 'behind';
    else status = 'on_pace';

    const summaries = habits.map(habit => summarizeHabit(habit, history, today, input.skips));
    const rated = summaries.filter(summary => summary.rate30 !== null);
    const habitRate30 = rated.length
        ? Math.round(rated.reduce((sum, summary) => sum + summary.rate30!, 0) / rated.length)
        : null;

    const open = tasks.filter(task => task.status !== 'done');
    const byDue = (a: Task, b: Task) =>
        (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || (a.dueTime ?? '99').localeCompare(b.dueTime ?? '99') || a.priority - b.priority;
    const overdue = open.filter(task => isLate(task, today)).sort(byDue);
    const upcoming = open.filter(task => task.dueDate && !isLate(task, today)).sort(byDue);
    const undated = open.filter(task => !task.dueDate).sort((a, b) => a.priority - b.priority);
    const completed = tasks.filter(task => task.status === 'done')
        .sort((a, b) => (doneOn(b) ?? '').localeCompare(doneOn(a) ?? ''));

    const datedDone = completed.filter(task => task.dueDate && doneOn(task));
    const onTime = datedDone.length
        ? Math.round((datedDone.filter(task => doneOn(task)! <= task.dueDate!).length / datedDone.length) * 100)
        : null;

    const upNext: UpNextItem[] = [
        ...overdue.map(task => ({ kind: 'task' as const, id: task.id, title: task.title, date: task.dueDate!, time: task.dueTime, overdue: true })),
        ...upcoming.map(task => ({ kind: 'task' as const, id: task.id, title: task.title, date: task.dueDate!, time: task.dueTime, overdue: false })),
        ...summaries
            .filter(summary => summary.nextDate)
            .map(summary => ({
                kind: 'habit' as const, id: summary.habit.id, title: summary.habit.name,
                date: summary.nextDate!, time: summary.habit.startTime, overdue: false,
            })),
    ]
        .sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.date.localeCompare(b.date) || (a.time ?? '99').localeCompare(b.time ?? '99'))
        .slice(0, 4);

    return {
        progress,
        pace: Math.round(pace),
        status,
        change7,
        series,
        startDate: start,
        endDate: end,
        daysLeft: goal.targetDate ? Math.max(0, daysBetween(today, end)) : null,
        habitRate30,
        tasks: {
            done: completed.length,
            total: tasks.length,
            onTime,
            overdue,
            upcoming,
            undated,
            completed,
        },
        habits: summaries,
        upNext,
        measure,
    };
}

export function summarizeHabit(
    habit: Habit,
    history: Record<string, string[]>,
    today: string,
    skips?: Record<string, string[]>,
): HabitSummary {
    const isDone = (day: string) => !!history[day]?.includes(habit.id);
    const isSkipped = (day: string) => wasSkipped(skips, day, habit.id);
    // Due that day, or (a "3 times a week" one) done on a day it was free.
    const required = createHabitRequirement(habit);
    const quota = isQuotaHabit(habit);
    const isScheduled = (day: string) => (required(day, isDone) || (quota && isDone(day))) && !isSkipped(day);

    // A "3 times a week" habit can be done any day the week still needs it.
    const scheduledToday = isScheduled(today) || (quota && !isSkipped(today) && isHabitScheduledForDate(habit, dateAt(today)));
    const doneToday = isDone(today);

    const last7: DayMark[] = [];
    for (let offset = 6; offset >= 0; offset--) {
        const day = addDays(today, -offset);
        if (isDone(day)) last7.push('done');
        else if (isSkipped(day)) last7.push('skipped');
        else if (!isScheduled(day)) last7.push('off');
        else last7.push(day === today ? 'pending' : 'missed');
    }

    // Today counts once it is done; until then it is not a miss.
    let scheduled = 0;
    let done = 0;
    for (let offset = 0; offset < 30; offset++) {
        const day = addDays(today, -offset);
        if (!isScheduled(day)) continue;
        if (day === today && !isDone(day)) continue;
        scheduled++;
        if (isDone(day)) done++;
    }

    let streak = 0;
    const start = parseHabitDate(habit.startDate) ?? parseHabitDate(habit.createdAt) ?? dateAt(today);
    const trackedDays = Math.max(0, daysBetween(localDateKey(start), today) + 1);
    for (let offset = 0; offset < trackedDays; offset++) {
        const day = addDays(today, -offset);
        if (!isScheduled(day)) continue;
        if (isDone(day)) streak++;
        else if (day === today) continue;
        else break;
    }

    let nextDate: string | null = null;
    for (let offset = doneToday || isSkipped(today) ? 1 : 0; offset < NEXT_DATE_HORIZON; offset++) {
        const day = addDays(today, offset);
        if (isScheduled(day)) { nextDate = day; break; }
    }

    return {
        habit,
        schedule: describeSchedule(habit),
        nextDate,
        scheduledToday,
        doneToday,
        last7,
        rate30: scheduled ? Math.round((done / scheduled) * 100) : null,
        streak,
    };
}

export function describeSchedule(habit: Habit): string {
    const time = habit.startTime ? ` · ${habit.startTime}` : '';
    const start = parseHabitDate(habit.startDate) ?? parseHabitDate(habit.createdAt);
    if (habit.frequency === 'monthly') {
        return `Monthly${start ? ` on the ${ordinal(start.getDate())}` : ''}${time}`;
    }
    if (habit.frequency === 'yearly') {
        return `Yearly${start ? ` on ${start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}${time}`;
    }

    const days = (habit.taskDays ?? []).map(day => day.toLowerCase().slice(0, 3));
    const indexes = DAY_NAMES.map(name => name.toLowerCase()).map((name, index) => (days.includes(name) ? index : -1)).filter(i => i >= 0);
    let label: string;
    if (indexes.length === 0 || indexes.length === 7) label = 'Every day';
    else if (indexes.length === 5 && [1, 2, 3, 4, 5].every(i => indexes.includes(i))) label = 'Weekdays';
    else if (indexes.length === 2 && indexes.includes(0) && indexes.includes(6)) label = 'Weekends';
    else label = [...indexes.filter(i => i > 0), ...indexes.filter(i => i === 0)].map(i => DAY_NAMES[i]).join(', ');

    const interval = Math.max(1, Math.floor(habit.weekInterval || 1));
    if (interval > 1) label += `, every ${interval} weeks`;
    return label + time;
}

const ordinal = (n: number): string => {
    const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
    return `${n}${suffix}`;
};

/** "Today", "Tomorrow", "Fri", or "12 Oct", relative to today. */
export function friendlyDate(day: string, today: string): string {
    const diff = daysBetween(today, day);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff > 1 && diff < 7) return dateAt(day).toLocaleDateString(undefined, { weekday: 'short' });
    return dateAt(day).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * Several goals' lines as one, like a portfolio: on each day, the average of
 * every goal, counting a goal as 0 before it started and at its final value
 * after it ended. The set of goals never changes along the line, so adding a
 * new goal lowers the whole history evenly instead of making today crash, and
 * the last point is exactly the headline average.
 */
export function combineSeries(all: GoalPoint[][]): GoalPoint[] {
    if (all.length === 0) return [];
    const series = all.filter(points => points.length > 0);
    if (series.length === 0) return [];
    const first = series.map(points => points[0].date).sort()[0];
    const last = series.map(points => points[points.length - 1].date).sort().reverse()[0];

    const cursors = series.map(() => -1);
    const out: GoalPoint[] = [];
    for (let day = first; day <= last; day = addDays(day, 1)) {
        let actual = 0;
        let pace = 0;
        series.forEach((points, index) => {
            while (cursors[index] + 1 < points.length && points[cursors[index] + 1].date <= day) cursors[index]++;
            if (cursors[index] < 0) return;
            actual += points[cursors[index]].actual;
            pace += points[cursors[index]].pace;
        });
        // Goals with no line yet still count, as 0.
        out.push({ date: day, actual: Math.round((actual / all.length) * 10) / 10, pace: Math.round((pace / all.length) * 10) / 10 });
    }
    return out;
}
