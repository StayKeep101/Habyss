// Copied from Habyss Mobile lib/tasks.ts @0fcd218. Keep in sync; do not re-derive rules.
// Extract: the types and the pure ordering rules. Storage (SQLite reads and writes) stays on mobile.
import { localDateKey } from './habitSchedule';

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
    goalId?: string;
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
    /** The step of its goal's plan it belongs to. */
    milestoneId?: string;
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
    /** The heading it sits under in its goal's to-do list ("Research"). Kept on this phone. */
    section?: string;
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

export interface TaskInput {
    title: string;
    description?: string;
    dueDate?: string;
    dueTime?: string;
    estimatedMinutes?: number;
    priority?: TaskPriority;
    goalId?: string;
    source?: TaskSource;
    externalId?: string;
    measure?: TaskMeasure;
    target?: number;
    unit?: string;
    amount?: number;
    milestoneId?: string;
    difficulty?: TaskDifficulty;
    deadline?: string;
    flexible?: boolean;
    subtasks?: Subtask[];
    section?: string;
}

/* -------------------------------------------------------------------------- */
/*  What matters today                                                         */
/* -------------------------------------------------------------------------- */

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
        // A goal's to-do with no day waits in its list, as in tasksForDay.
        .filter(task => (!task.dueDate && !task.goalId) || (!!task.dueDate && task.dueDate <= today))
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
 * finished, so looking back at a day says what that day actually held.
 */
export function tasksForDay(tasks: Task[], day: string, today: string = todayKey()): Task[] {
    const isToday = day === today;
    return tasks.filter(task => {
        if (task.status === 'cancelled') return false;
        if (task.dueDate === day) return true;
        if (!isToday) return false;
        // No day: today's, unless it belongs to a goal. Then it is one of the
        // goal's to-dos, waiting in its list to be planned on a day.
        if (!task.dueDate) return task.status === 'open' && !task.goalId;
        return task.dueDate < day && task.status === 'open';
    });
}

export const todayKey = (date: Date = new Date()): string => localDateKey(date);

/** Late: past its deadline, or past its day when it has no deadline of its own. */
export function isLate(task: Pick<Task, 'status' | 'dueDate' | 'deadline'>, today: string): boolean {
    if (task.status !== 'open') return false;
    const by = task.deadline ?? task.dueDate;
    return !!by && by < today;
}
