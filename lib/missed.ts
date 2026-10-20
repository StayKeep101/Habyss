import type { Habit } from './habitsSQLite';
import type { Task } from './tasks';
import { habitDays, shiftDay, type HistoryDay } from './habitDays';
import { localDateKey } from './habitSchedule';

/**
 * Everything you did not get to, day by day: each habit that was due and not
 * kept, each task that was due and not done, and what became of it — done the
 * next time, missed again, moved to the next day automatically, still waiting.
 *
 * Read from what is already recorded: habit history, task due dates and when
 * they were finished, and the log of tasks the timeline carried to the next
 * day because there was no room before bedtime (lib/movedTasks.ts). Today is
 * not counted (it is not over), and a habit skipped on purpose is not a miss.
 */
export type MissTone = 'recovered' | 'again' | 'pending' | 'moved' | 'late';
export interface Miss {
    key: string;
    id: string;
    kind: 'habit' | 'task';
    title: string;
    color?: string;
    /** The day it was missed. */
    day: string;
    /** What became of it, in a few words. */
    outcome: string;
    tone: MissTone;
}
export interface MissedDay { day: string; items: Miss[] }
export interface Missed {
    /** Most recent first; only days something was missed. */
    days: MissedDay[];
    /** Missed in the last 7 days, and in the 7 before. */
    thisWeek: number;
    lastWeek: number;
    /** Missed and still not caught up: open tasks, habits missed again. */
    behind: number;
}
export interface TaskMove { id: string; title: string; from: string; to: string }

const weekday = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' });
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86400000);

export function missed(input: {
    habits: Habit[]; history: HistoryDay[]; completions: Record<string, boolean>;
    tasks: Task[]; moves?: TaskMove[]; today?: string; days?: number;
}): Missed {
    const today = input.today ?? localDateKey(new Date());
    const span = input.days ?? 14;
    const first = shiftDay(today, -span);
    const items: Miss[] = [];

    // Habits: every due day not kept, and whether the next time answered it.
    const window = habitDays(input.habits, input.history, input.completions, span + 30, today, today);
    for (const habit of input.habits.filter(habit => !habit.isGoal && !habit.isArchived)) {
        const due = window.filter(day => day.scheduled.includes(habit.id) && !day.skipped.includes(habit.id))
            .map(day => ({ date: day.date, done: day.done.includes(habit.id) }));
        due.forEach((here, index) => {
            if (here.done || here.date >= today || here.date < first) return;
            const next = due[index + 1];
            const outcome: [string, MissTone] = !next ? ['Not due again yet', 'pending']
                : next.done ? [next.date === today ? 'Done today' : `Done ${weekday(next.date)}`, 'recovered']
                : next.date === today ? ['Due again today', 'pending']
                : [`Missed again ${weekday(next.date)}`, 'again'];
            items.push({ key: `habit:${habit.id}:${here.date}`, id: habit.id, kind: 'habit', title: habit.name, color: habit.color, day: here.date, outcome: outcome[0], tone: outcome[1] });
        });
    }

    // Tasks the timeline moved to the next day: missed on the day they left.
    const moved = new Set<string>();
    for (const move of input.moves ?? []) {
        if (move.from < first || move.from >= today) continue;
        moved.add(`${move.id}:${move.from}`);
        items.push({ key: `move:${move.id}:${move.from}`, id: move.id, kind: 'task', title: move.title, day: move.from,
            outcome: `No room before bedtime, moved to ${move.to === today ? 'today' : weekday(move.to)} automatically`, tone: 'moved' });
    }
    // Tasks still open past their day, or done after it.
    for (const task of input.tasks) {
        if (task.status === 'cancelled' || !task.dueDate || task.dueDate >= today || task.dueDate < first || moved.has(`${task.id}:${task.dueDate}`)) continue;
        const doneOn = task.status === 'done' && task.completedAt ? localDateKey(new Date(task.completedAt)) : null;
        if (doneOn && doneOn <= task.dueDate) continue;
        const late = daysBetween(task.dueDate, doneOn ?? today);
        const outcome: [string, MissTone] = doneOn ? [`Done ${late === 1 ? 'a day' : `${late} days`} late`, 'late'] : [`Still to do, ${late === 1 ? 'a day' : `${late} days`} late`, 'pending'];
        items.push({ key: `task:${task.id}:${task.dueDate}`, id: task.id, kind: 'task', title: task.title, day: task.dueDate, outcome: outcome[0], tone: outcome[1] });
    }

    const byDay = new Map<string, Miss[]>();
    for (const item of items) byDay.set(item.day, [...(byDay.get(item.day) ?? []), item]);
    const days = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]))
        .map(([day, list]) => ({ day, items: list.sort((a, b) => a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title)) }));
    const weekStart = shiftDay(today, -7);
    const thisWeek = items.filter(item => item.day >= weekStart).length;
    const lastWeek = items.filter(item => item.day < weekStart && item.day >= shiftDay(today, -14)).length;
    // Still behind: a task not done yet, or a habit missed again.
    const openTasks = new Set(items.filter(item => item.kind === 'task' && item.tone === 'pending').map(item => item.id));
    const behind = openTasks.size + items.filter(item => item.kind === 'habit' && item.tone === 'again').length;
    return { days, thisWeek, lastWeek, behind };
}

/** "Monday", "Yesterday", "Mon 12 Oct" for the day headings. */
export function missedDayLabel(day: string, today: string): string {
    const back = daysBetween(day, today);
    if (back === 1) return 'Yesterday';
    if (back < 7) return weekday(day);
    return new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
