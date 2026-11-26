import type { Habit } from './habitsSQLite';
import type { Task } from './tasks';
import { habitDays, type HistoryDay } from './habitDays';
import { localDateKey } from './habitSchedule';

/**
 * What is missed right now, and nothing else.
 *
 * A habit is listed while its last due day (or days) went undone, with how
 * many times in a row: once is a slip — fine, as long as it stays once — and
 * twice or more is how a habit is lost, so those come first. Doing it makes
 * it leave the list; it comes back only if it is missed again.
 *
 * A task is listed while it is past its day and still open, and a task the
 * timeline carried over to today (no room before bedtime) says so until done.
 * A day skipped on purpose is not a miss; today is not over, so it never is.
 */
export type MissLevel = 'twice' | 'once' | 'late' | 'moved';
export interface Miss {
    key: string;
    id: string;
    kind: 'habit' | 'task';
    title: string;
    color?: string;
    level: MissLevel;
    /** Times in a row for a habit; days late for a task. */
    count: number;
    /** The first day of this run of misses. */
    since: string;
    /** A habit due again today, still to do: the chance to make it a one-off. */
    dueToday?: boolean;
    /** What it is, in a few words. */
    line: string;
    /** A task's deadline, if it has one (moved along with it to today). */
    deadline?: string;
}
export interface Missed {
    /** Missed twice or more first (most in a row first), then once, then tasks. */
    items: Miss[];
    /** Habits missed twice or more in a row. */
    twice: number;
}
/** A task moved to a later day for you: no room before bedtime, or not done on its day before its deadline. */
export interface TaskMove { id: string; title: string; from: string; to: string; why?: 'room' | 'undone'; deadline?: string }

const weekday = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' });
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86400000);
const RANK: Record<MissLevel, number> = { twice: 0, once: 1, late: 2, moved: 3 };

export function missed(input: {
    habits: Habit[]; history: HistoryDay[]; completions: Record<string, boolean>;
    tasks: Task[]; moves?: TaskMove[]; today?: string;
}): Missed {
    const today = input.today ?? localDateKey(new Date());
    const items: Miss[] = [];

    // Habits: the run of undone due days ending at the last one before today.
    const window = habitDays(input.habits, input.history, input.completions, 60, today, today);
    for (const habit of input.habits.filter(habit => !habit.isArchived)) {
        const due = window.filter(day => day.scheduled.includes(habit.id) && !day.skipped.includes(habit.id));
        const todayDue = due.find(day => day.date === today);
        if (todayDue?.done.includes(habit.id)) continue;
        const past = due.filter(day => day.date < today);
        let count = 0;
        let since = '';
        for (let index = past.length - 1; index >= 0 && !past[index].done.includes(habit.id); index--) { count++; since = past[index].date; }
        if (!count) continue;
        const dueToday = !!todayDue;
        const level: MissLevel = count >= 2 ? 'twice' : 'once';
        const line = level === 'twice'
            ? `Missed ${count} times in a row, since ${weekday(since)}`
            : `Missed ${weekday(since)}. Once is fine, don't make it twice.`;
        items.push({ key: `habit:${habit.id}`, id: habit.id, kind: 'habit', title: habit.name, color: habit.color, level, count, since, dueToday,
            line: dueToday ? `${line}${level === 'twice' ? '.' : ''} Due today.` : line });
    }

    // Tasks past their deadline (or their day, with no deadline) and still open.
    const listed = new Set<string>();
    for (const task of input.tasks) {
        const by = task.deadline ?? task.dueDate;
        if (task.status !== 'open' || !by || by >= today) continue;
        const late = daysBetween(by, today);
        listed.add(task.id);
        items.push({ key: `task:${task.id}`, id: task.id, kind: 'task', title: task.title, level: 'late', count: late, since: by, deadline: task.deadline,
            line: `${late === 1 ? 'A day' : `${late} days`} late, due ${weekday(by)}` });
    }
    // Carried over to today by the timeline, still open.
    for (const move of input.moves ?? []) {
        const task = input.tasks.find(item => item.id === move.id);
        if (!task || task.status !== 'open' || task.dueDate !== today || move.to !== today || listed.has(task.id)) continue;
        listed.add(task.id);
        items.push({ key: `move:${task.id}`, id: task.id, kind: 'task', title: task.title, level: 'moved', count: 1, since: move.from,
            line: move.why === 'undone'
                ? `Not done ${move.from === shiftDayBack(today) ? 'yesterday' : weekday(move.from)}, moved to today${task.deadline ? `. Due ${task.deadline === today ? 'today' : weekday(task.deadline)}` : ''}`
                : `No room ${move.from === shiftDayBack(today) ? 'yesterday' : weekday(move.from)}, moved to today automatically` });
    }

    items.sort((a, b) => RANK[a.level] - RANK[b.level] || b.count - a.count || a.title.localeCompare(b.title));
    return { items, twice: items.filter(item => item.level === 'twice').length };
}

const shiftDayBack = (day: string) => localDateKey(new Date(Date.parse(`${day}T12:00:00`) - 86400000));

/**
 * A late task put on today: its day becomes today, and a deadline already gone
 * by moves with it (one still ahead is kept), so it leaves the missed list.
 */
export function rescheduleToToday(miss: Pick<Miss, 'deadline'>, today: string): { dueDate: string; deadline?: string } {
    return miss.deadline && miss.deadline < today ? { dueDate: today, deadline: today } : { dueDate: today };
}

/** When a late task fell due, as a word: "yesterday", "Monday" this past week, else "Nov 2". */
export function sinceLabel(day: string, today: string): string {
    const gap = daysBetween(day, today);
    if (gap === 1) return 'yesterday';
    if (gap < 7) return weekday(day);
    return new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
