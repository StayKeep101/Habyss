import type { Habit } from './habitsSQLite';
import type { Task } from './tasks';
import { createHabitSchedule, localDateKey } from './habitSchedule';

/**
 * A month of progress, day by day.
 *
 * Everything the progress screen shows comes from here, so the calendar, the
 * totals, the chart and the day a user taps all tell the same story. Only what
 * was recorded counts: a day with nothing scheduled is not a failure, and a
 * skipped habit is neither done nor missed.
 */

export interface DaySummary {
    date: string;
    /** Habit ids, split by what actually happened. */
    done: string[];
    missed: string[];
    skipped: string[];
    /** Tasks finished on this day. */
    tasks: string[];
    /** Tasks due this day that were not finished on it (done later, or still open). */
    tasksOpen: string[];
    /** Check-ins asked for: scheduled habits, minus the skipped ones. */
    scheduled: number;
    /** Everything logged that day, habits and tasks together, for the chart. */
    total: number;
    /** Every scheduled habit was done, and at least one was asked for. */
    complete: boolean;
    future: boolean;
}

export interface MonthInput {
    habits: Habit[];
    tasks: Task[];
    /** Completed habit ids by date. */
    history: Record<string, string[]>;
    /** Skipped habit ids by date. */
    skips?: Record<string, string[]>;
    /** Any day inside the month to summarise. */
    month: Date;
    today: string;
}

const dayKey = (year: number, month: number, day: number) =>
    localDateKey(new Date(year, month, day, 12));

const taskDoneOn = (task: Task): string | null => {
    if (task.status !== 'done') return null;
    const stamp = task.completedAt ?? task.updatedAt;
    const parsed = stamp ? new Date(stamp) : null;
    return parsed && Number.isFinite(parsed.getTime()) ? localDateKey(parsed) : null;
};

export function monthDays(input: MonthInput): DaySummary[] {
    const { month, today, history, skips } = input;
    const year = month.getFullYear();
    const index = month.getMonth();
    const count = new Date(year, index + 1, 0).getDate();

    const habits = input.habits.filter(habit => !habit.isGoal && !habit.isArchived)
        .map(habit => ({ habit, scheduled: createHabitSchedule(habit) }));
    const firstDay = dayKey(year, index, 1);
    const lastDay = dayKey(year, index, count);
    const tasksByDay = new Map<string, string[]>();
    for (const task of input.tasks) {
        const day = taskDoneOn(task);
        if (!day) continue;
        if (day < firstDay || day > lastDay) continue;
        const bucket = tasksByDay.get(day);
        if (bucket) bucket.push(task.id);
        else tasksByDay.set(day, [task.id]);
    }

    // Due on a day and not finished that day: what the day asked for and did not get.
    const openByDay = new Map<string, string[]>();
    for (const task of input.tasks) {
        if (task.status === 'cancelled' || !task.dueDate) continue;
        if (task.dueDate < firstDay || task.dueDate > lastDay) continue;
        if (taskDoneOn(task) === task.dueDate) continue;
        const bucket = openByDay.get(task.dueDate);
        if (bucket) bucket.push(task.id);
        else openByDay.set(task.dueDate, [task.id]);
    }

    const days: DaySummary[] = [];
    for (let day = 1; day <= count; day++) {
        const date = dayKey(year, index, day);
        const when = new Date(year, index, day, 12);
        const completed = new Set(history[date]);
        const skippedToday = new Set(skips?.[date]);

        const done: string[] = [];
        const missed: string[] = [];
        const skipped: string[] = [];
        for (const { habit, scheduled } of habits) {
            if (!scheduled(when)) continue;
            if (skippedToday.has(habit.id)) { skipped.push(habit.id); continue; }
            if (completed.has(habit.id)) done.push(habit.id);
            else missed.push(habit.id);
        }

        const tasks = tasksByDay.get(date) ?? [];
        const scheduled = done.length + missed.length;
        const future = date > today;

        days.push({
            date,
            done,
            // Nothing is missed until the day is over.
            missed: future ? [] : missed,
            skipped,
            tasks,
            tasksOpen: future ? [] : openByDay.get(date) ?? [],
            scheduled,
            total: done.length + tasks.length,
            complete: !future && scheduled > 0 && missed.length === 0,
            future,
        });
    }
    return days;
}

export interface MonthTotals {
    /** Days with at least one thing logged. */
    activeDays: number;
    /** Days where everything scheduled was done. */
    perfectDays: number;
    checkIns: number;
    tasks: number;
    /** Share of scheduled check-ins done, over days that have happened. */
    rate: number | null;
    /** The most logged in one day, for scaling the chart. */
    busiest: number;
}

export function monthTotals(days: DaySummary[]): MonthTotals {
    const past = days.filter(day => !day.future);
    const scheduled = past.reduce((sum, day) => sum + day.scheduled, 0);
    const checkIns = past.reduce((sum, day) => sum + day.done.length, 0);
    return {
        activeDays: past.filter(day => day.total > 0).length,
        perfectDays: past.filter(day => day.complete).length,
        checkIns,
        tasks: past.reduce((sum, day) => sum + day.tasks.length, 0),
        rate: scheduled ? Math.round((checkIns / scheduled) * 100) : null,
        busiest: days.reduce((most, day) => Math.max(most, day.total), 0),
    };
}

/** How full a day's ring is drawn, 0 to 1. */
/**
 * How much of the day's ring to close, 0 to 1.
 *
 * With `taskTarget` (the day's 3 or 5), everything the day asked for counts:
 * its scheduled habits and its tasks, so finishing half of all of it closes
 * half the ring, and only doing everything closes it — the way Activity's
 * rings work. Without it, habits alone, as before.
 */
export function dayFill(day: DaySummary, taskTarget?: number): number {
    if (taskTarget && taskTarget > 0) {
        const asked = day.scheduled + taskTarget;
        const did = day.done.length + Math.min(day.tasks.length, taskTarget);
        return asked ? Math.min(1, did / asked) : 0;
    }
    if (day.scheduled === 0) return day.tasks.length > 0 ? 1 : 0;
    return day.done.length / day.scheduled;
}
