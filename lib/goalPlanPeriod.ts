import { addDays } from './goalInsights';
import { isHabitScheduledForDate } from './habitSchedule';
import type { Habit } from './habitsSQLite';
import type { Milestone } from './goalMilestones';
import type { Task } from './tasks';

const dateOf = (key: string) => new Date(`${key}T12:00:00`);
const keyOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** The days a range covers, `offset` steps from the one holding today. */
export function periodOf(range: 'day' | 'week' | 'month', offset: number, today: string, weekStartsMonday: boolean): { from: string; to: string } {
    if (range === 'day') { const day = addDays(today, offset); return { from: day, to: day }; }
    if (range === 'week') {
        const weekday = dateOf(today).getDay();
        const back = weekStartsMonday ? (weekday + 6) % 7 : weekday;
        const from = addDays(today, -back + offset * 7);
        return { from, to: addDays(from, 6) };
    }
    const base = dateOf(today);
    const first = new Date(base.getFullYear(), base.getMonth() + offset, 1, 12);
    return { from: keyOf(first), to: keyOf(new Date(first.getFullYear(), first.getMonth() + 1, 0, 12)) };
}


/** One thing a goal asks of a day, and whether it was done. */
export type GoalDayItem =
    | { kind: 'habit'; id: string; title: string; done: boolean; habit: Habit }
    | { kind: 'task'; id: string; title: string; done: boolean; task: Task }
    | { kind: 'milestone'; id: string; title: string; done: boolean; milestone: Milestone };

export interface GoalDay { day: string; items: GoalDayItem[] }

/**
 * Each day from `from` to `to` with what the goal asks of it: the habits due
 * (done, from the shared history; a skipped one is left out, as it is
 * nowhere a miss), the tasks planned for it and the milestones due on it.
 * Milestones first, then habits, then tasks, so the bigger thing leads.
 */
export function goalDays(from: string, to: string, input: {
    habits: Habit[]; tasks: Task[]; milestones: Milestone[];
    history: Record<string, string[]>; skips?: Record<string, string[]>;
}): GoalDay[] {
    const out: GoalDay[] = [];
    if (from > to) return out;
    for (let day = from; day <= to; day = addDays(day, 1)) {
        const done = new Set(input.history[day] ?? []);
        const skipped = new Set(input.skips?.[day] ?? []);
        const items: GoalDayItem[] = [
            ...input.milestones.filter(milestone => milestone.dueDate === day)
                .map(milestone => ({ kind: 'milestone' as const, id: milestone.id, title: milestone.title, done: !!milestone.doneAt, milestone })),
            // On the calendar that day (a 3-a-week habit shows on every day it
            // could be done), unless it was skipped.
            ...input.habits.filter(habit => !habit.isGoal && !habit.isArchived && !skipped.has(habit.id) && isHabitScheduledForDate(habit, dateOf(day)))
                .map(habit => ({ kind: 'habit' as const, id: habit.id, title: habit.name, done: done.has(habit.id), habit })),
            ...input.tasks.filter(task => task.dueDate === day && task.status !== 'cancelled')
                .map(task => ({ kind: 'task' as const, id: task.id, title: task.title, done: task.status === 'done', task })),
        ];
        out.push({ day, items });
    }
    return out;
}

/** A month as calendar rows of seven, blanks (null) before the 1st and after the last. */
export function monthGrid(month: string, weekStartsMonday: boolean): (string | null)[][] {
    const first = dateOf(month.slice(0, 7) + '-01');
    const lead = weekStartsMonday ? (first.getDay() + 6) % 7 : first.getDay();
    const length = new Date(first.getFullYear(), first.getMonth() + 1, 0, 12).getDate();
    const cells: (string | null)[] = [...Array(lead).fill(null)];
    for (let date = 1; date <= length; date++) cells.push(keyOf(new Date(first.getFullYear(), first.getMonth(), date, 12)));
    while (cells.length % 7) cells.push(null);
    const rows: (string | null)[][] = [];
    for (let at = 0; at < cells.length; at += 7) rows.push(cells.slice(at, at + 7));
    return rows;
}

/** The first day of each month from the one holding `from` to the one holding `to`. */
export function monthsBetween(from: string, to: string): string[] {
    const out: string[] = [];
    const start = dateOf(from);
    const end = to.slice(0, 7);
    for (let at = new Date(start.getFullYear(), start.getMonth(), 1, 12); keyOf(at).slice(0, 7) <= end; at = new Date(at.getFullYear(), at.getMonth() + 1, 1, 12)) {
        out.push(keyOf(at));
    }
    return out;
}
