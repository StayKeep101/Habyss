import { parsePlaces, parseReminderTime, storePlaces } from './places';
import type { LocationReminder } from './habitsSQLite';
import { parseAlerts, storeAlerts } from './itemAlerts';
import { generateId, getDatabase, isSQLiteAvailable, nowISO } from './database';
import { formatDuration } from './habitMeasurement';
import { localDateKey } from './habitSchedule';
import { getLocalUserId } from './localUser';

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
    /** Its own reminders before it begins, in minutes (lib/itemAlerts.ts). */
    alerts?: number[];
    /** Reminded at this time on its day, "HH:MM", like a habit's reminder. */
    reminder?: string;
    /** Reminded on arriving at or leaving a place, like a habit's (lib/LocationService.ts). */
    locationReminders?: LocationReminder[];
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
    /** Its own reminders before it begins, in minutes (lib/itemAlerts.ts). */
    alerts?: number[];
    reminder?: string;
    locationReminders?: LocationReminder[];
    subtasks?: Subtask[];
    section?: string;
}

const rowToTask = (row: any): Task => ({
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    dueDate: row.due_date ?? undefined,
    dueTime: row.due_time ?? undefined,
    estimatedMinutes: row.estimated_minutes ?? undefined,
    priority: (row.priority ?? 2) as TaskPriority,
    goalId: row.goal_id ?? undefined,
    status: (row.status ?? 'open') as TaskStatus,
    completedAt: row.completed_at ?? undefined,
    source: (row.source ?? 'app') as TaskSource,
    externalId: row.external_id ?? undefined,
    measure: row.measure === 'count' || row.measure === 'time' ? row.measure : undefined,
    target: Number.isFinite(row.target) && row.target > 0 ? row.target : undefined,
    unit: row.unit ?? undefined,
    alerts: parseAlerts(row.alerts),
    reminder: parseReminderTime(row.reminder),
    locationReminders: (() => { const places = parsePlaces(row.location_reminders); return places.length ? places : undefined; })(),
    amount: Number.isFinite(row.amount) ? row.amount : undefined,
    milestoneId: row.milestone_id ?? undefined,
    difficulty: row.difficulty === 1 || row.difficulty === 2 || row.difficulty === 3 ? row.difficulty : undefined,
    deadline: typeof row.deadline === 'string' && row.deadline ? row.deadline : undefined,
    flexible: row.flexible === 0 ? false : row.flexible === 1 ? true : undefined,
    subtasks: parseSubtasks(row.subtasks),
    section: typeof row.section === 'string' && row.section ? row.section : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

/* -------------------------------------------------------------------------- */
/*  Reading and writing                                                        */
/* -------------------------------------------------------------------------- */

export async function getTasks(options?: { includeDone?: boolean }): Promise<Task[]> {
    if (!isSQLiteAvailable()) return [];
    const db = await getDatabase();
    if (!db) return [];

    const where = options?.includeDone ? '' : "AND status = 'open'";
    // Only this person's: a phone can still hold another account's rows (see
    // linkThisPhone). A task saved before any id existed has none and is theirs.
    const uid = await getLocalUserId();
    const rows = await db.getAllAsync(
        `SELECT * FROM tasks WHERE deleted = 0 AND (user_id = ? OR user_id IS NULL) ${where} ORDER BY due_date IS NULL, due_date ASC, priority ASC`,
        uid,
    );
    return (rows ?? []).map(rowToTask);
}

export async function createTask(input: TaskInput): Promise<Task | null> {
    if (!isSQLiteAvailable()) return null;
    const db = await getDatabase();
    if (!db) return null;

    const title = input.title?.trim();
    if (!title) return null;

    const id = generateId();
    const now = nowISO();
    const uid = await getLocalUserId().catch(() => null);

    const importedColumns: [keyof TaskInput, string][] = [
        ['title', 'title'], ['description', 'description'], ['dueDate', 'due_date'],
        ['dueTime', 'due_time'], ['estimatedMinutes', 'estimated_minutes'],
        ['priority', 'priority'], ['goalId', 'goal_id'], ['source', 'source'],
        ['measure', 'measure'], ['target', 'target'], ['unit', 'unit'], ['milestoneId', 'milestone_id'],
        ['difficulty', 'difficulty'], ['deadline', 'deadline'], ['flexible', 'flexible'], ['subtasks', 'subtasks'], ['section', 'section'], ['alerts', 'alerts'],
    ];
    const updates = importedColumns.filter(([key]) => Object.prototype.hasOwnProperty.call(input, key))
        .map(([, column]) => `${column} = excluded.${column}`);
    const conflict = input.externalId
        ? `ON CONFLICT(external_id) WHERE external_id IS NOT NULL DO UPDATE SET ${[...updates, 'deleted = 0', 'synced = 0', 'updated_at = excluded.updated_at'].join(', ')}`
        : '';
    await db.runAsync(
        `INSERT INTO tasks (
            id, user_id, title, description, due_date, due_time, estimated_minutes,
            priority, goal_id, status, source, external_id, measure, target, unit, milestone_id, difficulty, deadline, flexible, subtasks, section, alerts, reminder, location_reminders,
            created_at, updated_at, deleted, synced
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0) ${conflict}`,
        id, uid, title, input.description ?? null, input.dueDate ?? null, input.dueTime ?? null,
        input.estimatedMinutes ?? null, input.priority ?? 2, input.goalId ?? null,
        input.source ?? 'app', input.externalId ?? null,
        input.measure && input.measure !== 'done' ? input.measure : null,
        input.measure && input.measure !== 'done' ? input.target ?? null : null,
        input.unit?.trim() || null, input.milestoneId ?? null, input.difficulty ?? null, input.deadline ?? null, input.flexible === undefined ? null : input.flexible ? 1 : 0,
        input.subtasks?.length ? JSON.stringify(input.subtasks) : null, input.section?.trim() || null, storeAlerts(input.alerts), parseReminderTime(input.reminder) ?? null, storePlaces(input.locationReminders), now, now,
    );

    const row = input.externalId
        ? await db.getFirstAsync('SELECT * FROM tasks WHERE external_id = ?', input.externalId)
        : await db.getFirstAsync('SELECT * FROM tasks WHERE id = ?', id);
    return row ? rowToTask(row) : null;
}

/** A field set to undefined or null is cleared; a field left out is kept. */
export type TaskPatch = { [K in keyof TaskInput]?: TaskInput[K] | null };

const REQUIRED: (keyof TaskInput)[] = ['title', 'priority'];

export async function updateTask(id: string, patch: TaskPatch): Promise<void> {
    const db = await getDatabase();
    if (!db) throw new Error('Task storage is unavailable. Your changes were not saved.');

    const columns: Record<keyof TaskInput, string> = {
        title: 'title', description: 'description', dueDate: 'due_date', dueTime: 'due_time',
        estimatedMinutes: 'estimated_minutes', priority: 'priority', goalId: 'goal_id',
        source: 'source', externalId: 'external_id',
        measure: 'measure', target: 'target', unit: 'unit', amount: 'amount', milestoneId: 'milestone_id',
        difficulty: 'difficulty', deadline: 'deadline', flexible: 'flexible', subtasks: 'subtasks', section: 'section', alerts: 'alerts',
        reminder: 'reminder', locationReminders: 'location_reminders',
    };

    const sets: string[] = [];
    const params: any[] = [];
    for (const [key, column] of Object.entries(columns) as [keyof TaskInput, string][]) {
        if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
        const raw = patch[key] ?? null;
        const value = key === 'subtasks'
            ? (Array.isArray(raw) && raw.length ? JSON.stringify(raw) : null)
            : key === 'alerts' ? storeAlerts(raw as number[] | null)
            : key === 'locationReminders' ? storePlaces(raw as LocationReminder[] | null)
            : key === 'reminder' ? parseReminderTime(raw) ?? null
            : typeof raw === 'boolean' ? (raw ? 1 : 0) : raw;
        // Clearing a due date or notes must stick; clearing the title cannot.
        if (value === null && REQUIRED.includes(key)) continue;
        sets.push(`${column} = ?`);
        params.push(value);
    }
    if (sets.length === 0) return;

    sets.push('updated_at = ?', 'synced = 0');
    params.push(nowISO(), id);
    await db.runAsync(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, ...params);
}

/**
 * Records how far a count or time task has got, finishing it once the target
 * is reached and reopening it if the amount is taken back below.
 */
export async function setTaskAmount(task: Task, amount: number): Promise<void> {
    const db = await getDatabase();
    if (!db) throw new Error('Task storage is unavailable. Your changes were not saved.');
    const value = Math.max(0, Math.round(amount * 100) / 100);
    const done = !!task.target && value >= task.target;
    const now = nowISO();
    await db.runAsync(
        `UPDATE tasks SET amount = ?, status = ?, completed_at = ?, updated_at = ?, synced = 0 WHERE id = ?`,
        value, done ? 'done' : 'open', done ? (task.status === 'done' ? task.completedAt ?? now : now) : null, now, task.id,
    );
    if (done !== (task.status === 'done')) void publishIfShared(task.id, done);
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

/** Marks a task done, or reopens it. Completion time is recorded, never guessed. */
export async function setTaskStatus(id: string, status: TaskStatus, completedAt?: string): Promise<void> {
    const db = await getDatabase();
    if (!db) throw new Error('Task storage is unavailable. Your changes were not saved.');
    const now = nowISO();
    await db.runAsync(
        'UPDATE tasks SET status = ?, completed_at = ?, updated_at = ?, synced = 0 WHERE id = ?',
        status, status === 'done' ? completedAt ?? now : null, now, id,
    );
    // Not awaited: the task is already saved, and somebody else's view of it is
    // not worth holding a tick behind a network call.
    void publishIfShared(id, status === 'done');
    const { emit } = require('./appEvents') as typeof import('./appEvents');
    if (status === 'done') emit('task_completed', { taskId: id });
    else emit('task_reopened', { taskId: id });
}

/**
 * Tells whoever is sharing this task that it is done, or no longer is.
 *
 * The same contract as a shared habit (`publishIfShared` in habitsSQLite), and
 * for the same reason: a shared row is not complete until everyone on it is,
 * so the other person's screen has to be told rather than left to a sync.
 *
 * Guarded by the locally cached list of shared ids, so ticking an ordinary
 * task — which is nearly all of them — costs nothing.
 */
async function publishIfShared(taskId: string, done: boolean): Promise<void> {
    try {
        const { FriendsService } = require('./friendsService') as typeof import('./friendsService');
        if (!(await FriendsService.sharedIds()).has(taskId)) return;
        const day = todayKey();
        if (!done) { await FriendsService.withdrawCompletion(taskId, day); return; }

        // A task carries no evidence: there is no timer to have run and no
        // place to have arrived at, so it is self-logged and says so.
        await FriendsService.publishCompletion(taskId, 'task', day, null);
        const { sharedDoneAlerts } = require('./notificationPrefs') as typeof import('./notificationPrefs');
        if (!(await sharedDoneAlerts())) return;
        // A whole-list read, but only ever on the shared path, which is a
        // handful of tasks rather than all of them.
        const row = (await getTasks({ includeDone: true }).catch(() => []))
            .find(task => task.id === taskId);
        await FriendsService.announceCompletion(taskId, row?.title ?? 'a shared task', 'task');
    } catch {
        // The task is saved; only the other person's view of it is late.
    }
}

export async function deleteTask(id: string): Promise<void> {
    const db = await getDatabase();
    if (!db) throw new Error('Task storage is unavailable. Your changes were not saved.');
    // What it cost in misses stays on the record (lib/marksLedger.ts).
    await (require('./marksLedger') as typeof import('./marksLedger')).keepPenaltiesOf({ tasks: [id] });
    // Shared: deleting it ends the share for both of you; shared with you, the
    // delete stays on this phone so the owner's task is untouched (lib/shareEnding.ts).
    const ending = require('./shareEnding') as typeof import('./shareEnding');
    const guest = await ending.isAdopted('task', id);
    await db.runAsync('UPDATE tasks SET deleted = 1, updated_at = ?, synced = ? WHERE id = ?', nowISO(), guest ? 1 : 0, id);
    const { FriendsService } = require('./friendsService') as typeof import('./friendsService');
    if (guest || (await FriendsService.sharedIds().catch(() => new Set<string>())).has(id)) void ending.endShares('task', id);
}

/** A goal's tasks go with it, the same way its habits do. */
export async function deleteTasksForGoal(goalId: string): Promise<void> {
    const db = await getDatabase();
    if (!db) throw new Error('Task storage is unavailable. Your changes were not saved.');
    const ids = ((await db.getAllAsync('SELECT id FROM tasks WHERE goal_id = ? AND deleted = 0', goalId)) ?? []).map((row: { id: string }) => row.id);
    await (require('./marksLedger') as typeof import('./marksLedger')).keepPenaltiesOf({ tasks: ids });
    await db.runAsync(
        'UPDATE tasks SET deleted = 1, updated_at = ?, synced = 0 WHERE goal_id = ? AND deleted = 0',
        nowISO(), goalId,
    );
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
        if (finished && (!task.dueDate ? !task.goalId : task.dueDate < finished)) return finished === day;
        if (task.dueDate === day) return true;
        if (!isToday) return false;
        // No day: today's, unless it belongs to a goal. Then it is one of the
        // goal's to-dos, waiting in its list to be planned on a day.
        if (!task.dueDate) return task.status === 'open' && !task.goalId;
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
