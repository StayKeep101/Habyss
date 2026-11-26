// Copied from Habyss Mobile lib/tasks.ts @f48c4da4. Keep in sync; do not re-derive rules. Pure parts only: storage, sync and notifications stay on mobile.
import type { HabitAnchor } from './habitAnchor';
import type { LocationReminder } from './habitsSQLite';
import { formatDuration } from './habitMeasurement';
import { localDateKey } from './habitSchedule';
/**
 * Tasks.
 *
 * Habits repeat; tasks happen once. A plan written by an assistant is mostly
 * tasks, so they are a first-class row rather than a habit with a due date
 * bolted on.
 *
 * Everything here is local, like the rest of Habyss. Nothing is uploaded.
 */

export type TaskStatus = 'open' | 'done' | 'cancelled';

/** 1 is the most important. Kept numeric so ordering is obvious. */
export type TaskPriority = 1 | 2 | 3;

export type TaskDifficulty = 1 | 2 | 3;

export type TaskSource = 'app' | 'mcp' | 'shortcut';

/**
 * What finishing a task means: ticking it ("Send proposal"), reaching a count
 * ("Call 25 leads") or putting in time ("Study 2 hours", target in minutes).
 */
export type TaskMeasure = 'done' | 'count' | 'time';

export interface Task {
    id: string;
    title: string;
    description?: string;
    /** "YYYY-MM-DD" in the user's local calendar. */
    dueDate?: string;
    /** "HH:MM", 24 hour. */
    dueTime?: string;
    estimatedMinutes?: number;
    priority: TaskPriority;
    status: TaskStatus;
    completedAt?: string;
    source: TaskSource;
    /** Stable id from whatever created it, so re-importing updates in place. */
    externalId?: string;
    /** Absent on a done-or-not task. */
    measure?: TaskMeasure;
    /** The count to reach, or minutes for a time task. */
    target?: number;
    /** What a count task counts ("leads", "words"). */
    unit?: string;
    /** How far it has got; a done task with no amount counts as its target. */
    amount?: number;
    /** 1 easy, 2 medium, 3 hard: the timeline puts hard things in your best hours. Kept on this phone. */
    difficulty?: TaskDifficulty;
    /** The steps it is made of, ticked one by one ("Write", "Edit", "Publish"). */
    subtasks?: Subtask[];
    /**
     * "YYYY-MM-DD": when it must be done by, when that is later than its day
     * (`dueDate`, the day you plan to do it). Kept on this phone.
     */
    deadline?: string;
    /** At its set time: false keeps it exactly there; otherwise the timeline may move it. Kept on this phone. */
    flexible?: boolean;
    /** Its own reminders before it begins, in minutes (lib/itemAlerts.ts). */
    alerts?: number[];
    /** Reminded at this time on its day, "HH:MM", like a habit's reminder. */
    reminder?: string;
    /** Reminded on arriving at or leaving a place, like a habit's (lib/LocationService.ts). */
    locationReminders?: LocationReminder[];
    /** The heading it sits under in its goal's to-do list ("Research"). Kept on this phone. */
    section?: string;
    /** Right before or after something in the day, like a habit's (lib/habitAnchor.ts). Kept on this phone. */
    anchor?: HabitAnchor;
    /** Done early: what its Shards were multiplied by (lib/taskSpeed.ts). Kept on this phone. */
    speed?: number;
    createdAt: string;
    updatedAt: string;
}

/** One step of a task. */
export interface Subtask { id: string; title: string; done: boolean }

/** Steps as stored (JSON text), read defensively: a bad value is no steps. */
export function parseSubtasks(raw: unknown): Subtask[] | undefined {
    try {
        const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(value)) return undefined;
        const steps = value
            .filter(item => item && typeof item.title === 'string' && item.title.trim())
            .map(item => ({ id: String(item.id ?? item.title), title: String(item.title).slice(0, 200), done: !!item.done }));
        return steps.length ? steps : undefined;
    } catch {
        return undefined;
    }
}

/** How far a task has got, 0 to 1: done tasks are whole, open ones their share. */
export function taskShare(task: Task): number {
    if (task.status === 'done') return 1;
    if (!task.measure || !task.target) return 0;
    return Math.max(0, Math.min(1, (task.amount ?? 0) / task.target));
}

/** "12 / 25 leads", "40 / 120 min", or null for a done-or-not task. */
export function taskAmountLabel(task: Task): string | null {
    if (!task.measure || !task.target) return null;
    const amount = task.status === 'done' ? Math.max(task.amount ?? 0, task.target) : task.amount ?? 0;
    const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });
    if (task.measure === 'time') return `${formatDuration(amount * 60, true)} / ${formatDuration(task.target * 60, true)}`;
    return `${fmt(amount)} / ${fmt(task.target)}${task.unit ? ` ${task.unit}` : ''}`;
}

/** How urgent a task is, lowest first. Pure, so the ordering is testable. */
export function taskRank(task: Task, today: string): number {
    // Overdue first, then due today, then undated, then future.
    let bucket: number;
    // Late means past its deadline; a day passed before the deadline is still today's work.
    if (isLate({ status: 'open', dueDate: task.dueDate, deadline: task.deadline }, today)) bucket = 0;
    else if (task.dueDate && task.dueDate <= today) bucket = 1;
    else if (!task.dueDate) bucket = 2;
    else bucket = 3;

    // Priority breaks ties inside a bucket, then the shorter task, so a plan
    // opens with something that can actually be finished.
    return bucket * 1000 + task.priority * 100 + Math.min(99, Math.round((task.estimatedMinutes ?? 30) / 10));
}

/**
 * The few things that actually matter today.
 *
 * Returns only open tasks that are overdue, due today, or undated. A task due
 * next week is not "today's most important", and padding the list with future
 * work is how these lists stop being believed.
 */
export function topTasksForToday(tasks: Task[], today: string, limit = 3): Task[] {
    return tasks
        .filter(task => task.status === 'open')
        .filter(task => !task.dueDate || task.dueDate <= today)
        .sort((a, b) => taskRank(a, today) - taskRank(b, today) || a.createdAt.localeCompare(b.createdAt))
        .slice(0, Math.max(0, limit));
}

/**
 * The tasks that belong to a given day, the way Reminders and Todoist decide it.
 *
 * A task appears on the day it was given and on no other: writing "Friday" on
 * something and then seeing it in today's list every day until Friday is how a
 * list stops being trusted. Two exceptions, both from the same principle —
 * today is where work that needs doing now belongs:
 *
 *  - Something open and past its date is still to be done, so it carries into
 *    today (and only today, never into a day being read back as history).
 *  - Something with no date at all is work with no home, so it sits in today
 *    rather than disappearing from the app entirely.
 *
 * A past or future day shows exactly what was due then, including what was
 * finished, so looking back at a day says what that day actually held. What
 * was finished after its day, or with no day, sits on the day it was done
 * (the row says how late: lateBy).
 */
export function tasksForDay(tasks: Task[], day: string, today: string = todayKey()): Task[] {
    const isToday = day === today;
    return tasks.filter(task => {
        if (task.status === 'cancelled') return false;
        // Finished late, or finished with no day: it belongs to the day it was
        // done, never back on the day it was due (as if done on time).
        const finished = doneDay(task);
        if (finished && (!task.dueDate || task.dueDate < finished)) return finished === day;
        if (task.dueDate === day) return true;
        if (!isToday) return false;
        // No day: today's.
        if (!task.dueDate) return task.status === 'open';
        return task.dueDate < day && task.status === 'open';
    });
}

export const todayKey = (date: Date = new Date()): string => localDateKey(date);

/** The day a done task was finished (local), or null while it is not done. */
export function doneDay(task: Pick<Task, 'status' | 'completedAt'>): string | null {
    return task.status === 'done' && task.completedAt ? localDateKey(new Date(task.completedAt)) : null;
}

/** Whole days a done task was finished after its deadline (or its day): 0 when on time or not done. */
export function lateBy(task: Pick<Task, 'status' | 'completedAt' | 'dueDate' | 'deadline'>): number {
    const finished = doneDay(task);
    const by = task.deadline ?? task.dueDate;
    if (!finished || !by || finished <= by) return 0;
    const at = (key: string) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
    return Math.round((at(finished) - at(by)) / 86_400_000);
}

/** Late: past its deadline, or past its day when it has no deadline of its own. */
export function isLate(task: Pick<Task, 'status' | 'dueDate' | 'deadline'>, today: string): boolean {
    if (task.status !== 'open') return false;
    const by = task.deadline ?? task.dueDate;
    return !!by && by < today;
}
