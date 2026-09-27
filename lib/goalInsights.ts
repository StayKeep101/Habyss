import type { Habit } from './habitsSQLite';
import type { Task } from './tasks';
import { createHabitSchedule, localDateKey, parseHabitDate } from './habitSchedule';

/**
 * Everything the goal screen shows, worked out in one place.
 *
 * A goal is made of habits (recurring) and tasks (one-off, on a date). Its
 * progress is the share of the whole plan that is done: each habit weighs as
 * much as each task, a habit's share is its completed check-ins over every
 * check-in it is scheduled for between the goal's start and target, and a
 * task's share is 1 once it is done. Because the denominator is the whole
 * plan, progress only ever rises, which is what makes it chartable like a
 * portfolio: the line is what you have banked, and the dashed pace line is
 * where a perfectly consistent you would be on each day.
 */

export type GoalStatus = 'ahead' | 'on_pace' | 'behind' | 'not_started' | 'empty';
export type DayMark = 'done' | 'missed' | 'pending' | 'off' | 'skipped';

export interface GoalPoint { date: string; actual: number; pace: number }

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

export function linkedHabits(goal: Habit, habits: Habit[]): Habit[] {
    return habits.filter(habit => habit.goalId === goal.id && !habit.isGoal && !habit.isArchived);
}

export function linkedTasks(goal: Habit, tasks: Task[]): Task[] {
    return tasks.filter(task => task.goalId === goal.id && task.status !== 'cancelled');
}

const wasSkipped = (skips: Record<string, string[]> | undefined, day: string, habitId: string): boolean =>
    !!skips?.[day]?.includes(habitId);

/** Progress today only; the cheap path for lists of goals. */
export function goalProgress(input: GoalInsightInput, rounded = true): number {
    const habits = linkedHabits(input.goal, input.habits);
    const tasks = linkedTasks(input.goal, input.tasks);
    const schedules = habits.map(habit => ({ habit, scheduled: createHabitSchedule(habit) }));
    const units = habits.length + tasks.length;
    if (units === 0) return 0;
    const { start, end } = goalRange(input.goal, input.today);

    const target = goalTarget(input.goal);
    const counted = target ? contributingHabits(habits, target) : [];
    const countedIds = new Set(counted.map(habit => habit.id));

    let expected = 0;
    let completed = 0;
    let delivered = 0;
    for (let day = start; day <= end; day = addDays(day, 1)) {
        const date = dateAt(day);
        const doneIds = new Set(input.history[day]);
        for (const { habit, scheduled } of schedules) {
            if (!scheduled(date)) continue;
            if (wasSkipped(input.skips, day, habit.id)) continue;
            expected++;
            if (day <= input.today && doneIds.has(habit.id)) {
                completed++;
                if (countedIds.has(habit.id)) delivered += contribution(habit);
            }
        }
    }

    // A goal that names a number is measured against it; everything else is
    // measured by how much of its plan has been kept.
    const habitShare = target && counted.length
        ? Math.min(1, delivered / target.amount)
        : expected === 0 ? 0 : completed / expected;
    const tasksDone = tasks.filter(task => task.status === 'done').length;
    const progress = ((habitShare * habits.length + tasksDone) / units) * 100;
    return rounded ? Math.round(progress) : progress;
}

export function buildGoalInsights(input: GoalInsightInput): GoalInsights {
    const { goal, history, today } = input;
    const habits = linkedHabits(goal, input.habits);
    const tasks = linkedTasks(goal, input.tasks);
    const schedules = habits.map(habit => ({ habit, scheduled: createHabitSchedule(habit) }));
    const { start, end } = goalRange(goal, today);
    const units = habits.length + tasks.length;

    // One pass over the plan: what was expected and done on each day.
    const target = goalTarget(goal);
    const counted = target ? contributingHabits(habits, target) : [];
    const countedIds = new Set(counted.map(habit => habit.id));
    const quantified = !!target && counted.length > 0;

    const days: { date: string; expected: number; done: number; delivered: number; owed: number }[] = [];
    let totalExpected = 0;
    for (let day = start; day <= end; day = addDays(day, 1)) {
        const date = dateAt(day);
        const doneIds = new Set(history[day]);
        let expected = 0;
        let done = 0;
        let delivered = 0;
        let owed = 0;
        for (const { habit, scheduled } of schedules) {
            if (!scheduled(date)) continue;
            if (wasSkipped(input.skips, day, habit.id)) continue;
            expected++;
            if (countedIds.has(habit.id)) owed += contribution(habit);
            if (day <= today && doneIds.has(habit.id)) {
                done++;
                if (countedIds.has(habit.id)) delivered += contribution(habit);
            }
        }
        totalExpected += expected;
        days.push({ date: day, expected, done, delivered, owed });
    }

    // Undated tasks are due by the end of the goal.
    const taskDue = tasks.map(task => task.dueDate ?? end).sort();
    const taskDone = tasks.map(doneOn).filter((day): day is string => day !== null).sort();
    let tasksDone = 0;
    let tasksDue = 0;

    const series: GoalPoint[] = [];
    let expectedSoFar = 0;
    let doneSoFar = 0;
    let deliveredSoFar = 0;
    let owedSoFar = 0;
    const lastDay = today < end ? today : end;
    for (const day of days) {
        expectedSoFar += day.expected;
        doneSoFar += day.done;
        deliveredSoFar += day.delivered;
        owedSoFar += day.owed;
        if (day.date > lastDay) break;
        const habitDone = quantified
            ? Math.min(1, deliveredSoFar / target!.amount)
            : totalExpected ? doneSoFar / totalExpected : 0;
        // Pace is where a perfectly consistent plan would stand by this day.
        const habitPace = quantified
            ? Math.min(1, owedSoFar / target!.amount)
            : totalExpected ? expectedSoFar / totalExpected : 0;
        while (tasksDone < taskDone.length && taskDone[tasksDone] <= day.date) tasksDone++;
        while (tasksDue < taskDue.length && taskDue[tasksDue] <= day.date) tasksDue++;
        series.push({
            date: day.date,
            actual: units ? Math.round(((habitDone * habits.length + tasksDone) / units) * 1000) / 10 : 0,
            pace: units ? Math.round(((habitPace * habits.length + tasksDue) / units) * 1000) / 10 : 0,
        });
    }

    // Tasks finished before the goal's start still count; they sit on day one.
    const completedHabits = days.reduce((sum, day) => sum + day.done, 0);
    const habitShare = quantified
        ? Math.min(1, days.reduce((sum, day) => sum + day.delivered, 0) / target!.amount)
        : totalExpected ? completedHabits / totalExpected : 0;
    const progress = units ? Math.round(((habitShare * habits.length + tasks.filter(task => task.status === 'done').length) / units) * 100) : 0;
    if (series.length) series[series.length - 1].actual = progress;

    const pace = series.length >= 2 ? series[series.length - 2].pace : 0;
    const weekAgo = series.length > 7 ? series[series.length - 8].actual : 0;
    const change7 = series.length ? Math.round(progress - weekAgo) : 0;

    let status: GoalStatus;
    if (units === 0) status = 'empty';
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
    const overdue = open.filter(task => task.dueDate && task.dueDate < today).sort(byDue);
    const upcoming = open.filter(task => task.dueDate && task.dueDate >= today).sort(byDue);
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
    const schedule = createHabitSchedule(habit);
    const isScheduled = (day: string) => schedule(dateAt(day)) && !isSkipped(day);

    const scheduledToday = isScheduled(today);
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
