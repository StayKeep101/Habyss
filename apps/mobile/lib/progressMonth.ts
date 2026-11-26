import type { Habit } from './habitsSQLite';
import type { Task } from './tasks';
import { createHabitSchedule, localDateKey } from './habitSchedule';
import { countedHistory, countedTasks } from './sharedGate';

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
    /** Show every tick as made, even shared ones the others have not finished (the day card). */
    raw?: boolean;
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
    // The Streak page counts a shared item once everybody on it has done it.
    if (!input.raw) input = { ...input, history: countedHistory(input.history), tasks: countedTasks(input.tasks) };
    const { month, today, history, skips } = input;
    const year = month.getFullYear();
    const index = month.getMonth();
    const count = new Date(year, index + 1, 0).getDate();

    const habits = input.habits.filter(habit => !habit.isArchived)
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

/**
 * How much of the day's ring to close, 0 to 1: the share of its scheduled
 * habits done. The same rule as a perfect day (`complete`), the Perfect
 * count and Habits kept, so a perfect day is always a closed ring. It used to
 * add the day's task target (Today's 3) as well, and one habit done on a day
 * with no tasks read as Perfect beside a quarter ring.
 */
export function dayFill(day: DaySummary): number {
    if (day.complete) return 1;
    if (day.scheduled === 0) return day.tasks.length > 0 ? 1 : 0;
    return day.done.length / day.scheduled;
}

/**
 * The last year, day by day, for the profile's heatmap: how much of each day
 * was kept (`dayFill`), from the same summary the Streak page uses. Future
 * days are left out.
 */
export function yearDays(input: Omit<MonthInput, 'month'>): { date: string; fill: number }[] {
    const end = new Date(`${input.today}T12:00:00`);
    const out: { date: string; fill: number }[] = [];
    for (let back = 12; back >= 0; back--) {
        const month = new Date(end.getFullYear(), end.getMonth() - back, 15, 12);
        for (const day of monthDays({ ...input, month })) if (!day.future) out.push({ date: day.date, fill: dayFill(day) });
    }
    return out;
}
