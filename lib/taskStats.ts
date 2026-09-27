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
