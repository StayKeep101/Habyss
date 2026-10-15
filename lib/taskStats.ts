import type { Task } from './tasks';
import { localDateKey } from './habitSchedule';

/**
 * How tasks sit alongside habits in the numbers.
 *
 * The decision here is that they are never blended into one percentage.
 *
 * A habit is a rhythm, measured by how often it is kept. A task is finished
 * once, measured by whether it got done and whether it was on time. Averaging
 * them lets ten trivial tasks bury a missed habit and report a good day, which
 * is the kind of number that stops being believed the first time it flatters
 * someone. So:
 *
 * - Streak and consistency stay habits only. A streak of one-off tasks is
 *   meaningless, because there is nothing to repeat.
 * - A day shows both, side by side and separately counted.
 * - Tasks get the measure habits cannot have: overdue, and whether work landed
 *   by its due date.
 * - A goal counts both, because a goal is reached through rhythms and one-off
 *   pieces of work alike.
 */

export interface TaskDayStats {
    /** Open tasks due on or before this day, plus any completed that day. */
    due: number;
    done: number;
    /** Still open with a due date in the past. */
    overdue: number;
}

const completedOn = (task: Task, day: string): boolean =>
    task.status === 'done' && !!task.completedAt && localDateKey(new Date(task.completedAt)) === day;

/** What a given day asked of the user in tasks, and what they did. */
export function taskStatsForDay(tasks: Task[], day: string): TaskDayStats {
    let due = 0;
    let done = 0;
    let overdue = 0;

    for (const task of tasks) {
        if (task.status === 'cancelled') continue;

        const wasDoneToday = completedOn(task, day);
        const openAndDue = task.status === 'open' && !!task.dueDate && task.dueDate <= day;

        if (wasDoneToday || openAndDue) due += 1;
        if (wasDoneToday) done += 1;
        if (task.status === 'open' && !!task.dueDate && task.dueDate < day) overdue += 1;
    }

    return { due, done, overdue };
}

/**
 * Share of dated, completed tasks that were finished by their due date.
 *
 * Returns null when nothing dated has been completed yet, rather than 0%,
 * which would read as failure when the real answer is "no data".
 */
export function onTimeRate(tasks: Task[]): number | null {
    const dated = tasks.filter(task => task.status === 'done' && task.dueDate && task.completedAt);
    if (dated.length === 0) return null;
    const onTime = dated.filter(task => localDateKey(new Date(task.completedAt!)) <= task.dueDate!).length;
    return Math.round((onTime / dated.length) * 100);
}

/**
 * A day in one line, with the two kinds kept apart.
 *
 * "3/4 habits · 2/3 tasks", never "5/7", so a good task day cannot hide a
 * missed habit. Either side is omitted when there was nothing of that kind.
 */
export function describeDay(
    habits: { done: number; scheduled: number },
    tasks: TaskDayStats,
): string {
    const parts: string[] = [];
    if (habits.scheduled > 0) parts.push(`${habits.done}/${habits.scheduled} habits`);
    if (tasks.due > 0) parts.push(`${tasks.done}/${tasks.due} tasks`);
    if (parts.length === 0) return 'Nothing scheduled';
    return parts.join(' · ');
}

export interface WeekDone {
    /** The Monday the week starts on. */
    start: string;
    done: number;
}

/**
 * Tasks finished in each of the last `weeks` weeks, oldest first, the current
 * week last (so far). Monday starts a week. This is the line that shows
 * whether you are getting better.
 */
export function weeklyDone(tasks: Task[], today: string, weeks = 8): WeekDone[] {
    const end = new Date(`${today}T12:00:00`);
    const monday = new Date(end);
    monday.setDate(end.getDate() - ((end.getDay() + 6) % 7));
    const starts = Array.from({ length: weeks }, (_, index) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() - (weeks - 1 - index) * 7);
        return localDateKey(date);
    });
    const counts = starts.map(start => ({ start, done: 0 }));
    for (const task of tasks) {
        if (task.status !== 'done' || !task.completedAt) continue;
        const day = localDateKey(new Date(task.completedAt));
        if (day > today) continue;
        for (let index = starts.length - 1; index >= 0; index--) {
            if (day >= starts[index]) { counts[index].done += 1; break; }
        }
    }
    return counts;
}

/** This week against the same days of last week: the honest comparison mid-week. */
export function weekChange(tasks: Task[], today: string): { thisWeek: number; lastWeek: number; change: number } {
    const end = new Date(`${today}T12:00:00`);
    const daysIn = (end.getDay() + 6) % 7; // 0 on Monday
    const monday = new Date(end); monday.setDate(end.getDate() - daysIn);
    const lastMonday = new Date(monday); lastMonday.setDate(monday.getDate() - 7);
    const lastSameDay = new Date(lastMonday); lastSameDay.setDate(lastMonday.getDate() + daysIn);
    const [from, lastFrom, lastTo] = [monday, lastMonday, lastSameDay].map(localDateKey);
    let thisWeek = 0; let lastWeek = 0;
    for (const task of tasks) {
        if (task.status !== 'done' || !task.completedAt) continue;
        const day = localDateKey(new Date(task.completedAt));
        if (day >= from && day <= today) thisWeek += 1;
        else if (day >= lastFrom && day <= lastTo) lastWeek += 1;
    }
    return { thisWeek, lastWeek, change: thisWeek - lastWeek };
}
