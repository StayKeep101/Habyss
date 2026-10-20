import type { Task } from './tasks';
import { localDateKey } from './habitSchedule';

export interface TaskReminder { task: Task; date: Date }

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * When to remind someone about each task they have not finished.
 *
 * At the time they set, on the day it is due. A task with a date but no time
 * uses the default (their morning), and one whose time has already gone today
 * is left alone rather than firing the moment the app opens. Done, cancelled
 * and undated tasks are never scheduled, and nor is anything overdue: a
 * notification cannot be delivered in the past, and nagging about it on an
 * arbitrary day is not the same as the reminder the user asked for.
 */
export function buildTaskReminderPlan(
    tasks: Task[],
    now = new Date(),
    defaultTime = '09:00',
    limit = 16,
    /** Today's timeline: a task on it is reminded when it starts there. */
    todayStarts: Record<string, { start: number }> = {},
): TaskReminder[] {
    const fallback = TIME.test(defaultTime) ? defaultTime : '09:00';
    const plan: TaskReminder[] = [];

    for (const task of tasks) {
        if (task.status !== 'open' || !task.dueDate) continue;
        const [year, month, day] = task.dueDate.split('-').map(Number);
        if (!year || !month || !day) continue;

        const placed = task.dueDate === localDateKey(now) ? todayStarts[task.id] : undefined;
        const time = task.dueTime && TIME.test(task.dueTime) ? task.dueTime : fallback;
        const [hour, minute] = time.split(':').map(Number);
        const date = placed ? new Date(year, month - 1, day, 0, placed.start, 0, 0) : new Date(year, month - 1, day, hour, minute, 0, 0);
        if (localDateKey(date) !== task.dueDate) continue;
        if (date.getTime() <= now.getTime()) continue;

        plan.push({ task, date });
    }

    return plan
        .sort((a, b) => a.date.getTime() - b.date.getTime() || a.task.id.localeCompare(b.task.id))
        .slice(0, Math.max(0, limit));
}
