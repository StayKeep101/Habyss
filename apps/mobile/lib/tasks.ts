import { parsePlaces, parseReminderTime, storePlaces } from './places';
import { parseAnchor, storeAnchor, type HabitAnchor } from './habitAnchor';
import { speedForTask } from './taskSpeed';
import type { LocationReminder } from './habitsSQLite';
import { parseAlerts, storeAlerts } from './itemAlerts';
import { generateId, getDatabase, isSQLiteAvailable, nowISO } from './database';
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

// What a task is: one definition for both apps (packages/core/src/types.ts).
import type { Subtask, Task, TaskDifficulty, TaskMeasure, TaskPriority, TaskSource, TaskStatus } from '@habyss/core/types';
// Shared with the Mac: packages/core/src/tasks.ts (the rules). What stays here is the phone's own part.
import { parseSubtasks, todayKey } from '@habyss/core/tasks';
export * from '@habyss/core/tasks';

export type { Subtask, Task, TaskDifficulty, TaskMeasure, TaskPriority, TaskSource, TaskStatus } from '@habyss/core/types';

export interface TaskInput {
    title: string;
    description?: string;
    dueDate?: string;
    dueTime?: string;
    estimatedMinutes?: number;
    priority?: TaskPriority;
    source?: TaskSource;
    externalId?: string;
    measure?: TaskMeasure;
    target?: number;
    unit?: string;
    amount?: number;
    difficulty?: TaskDifficulty;
    deadline?: string;
    flexible?: boolean;
    /** Its own reminders before it begins, in minutes (lib/itemAlerts.ts). */
    alerts?: number[];
    reminder?: string;
    locationReminders?: LocationReminder[];
    subtasks?: Subtask[];
    section?: string;
    anchor?: HabitAnchor | null;
}

const rowToTask = (row: any): Task => ({
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    dueDate: row.due_date ?? undefined,
    dueTime: row.due_time ?? undefined,
    estimatedMinutes: row.estimated_minutes ?? undefined,
    priority: (row.priority ?? 2) as TaskPriority,
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
    difficulty: row.difficulty === 1 || row.difficulty === 2 || row.difficulty === 3 ? row.difficulty : undefined,
    deadline: typeof row.deadline === 'string' && row.deadline ? row.deadline : undefined,
    flexible: row.flexible === 0 ? false : row.flexible === 1 ? true : undefined,
    subtasks: parseSubtasks(row.subtasks),
    section: typeof row.section === 'string' && row.section ? row.section : undefined,
    anchor: parseAnchor(row.anchor),
    speed: Number.isFinite(row.speed) && row.speed > 1 ? row.speed : undefined,
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
        ['priority', 'priority'], ['source', 'source'],
        ['measure', 'measure'], ['target', 'target'], ['unit', 'unit'],
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
            priority, status, source, external_id, measure, target, unit, difficulty, deadline, flexible, subtasks, section, alerts, reminder, location_reminders, anchor,
            created_at, updated_at, deleted, synced
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0) ${conflict}`,
        id, uid, title, input.description ?? null, input.dueDate ?? null, input.dueTime ?? null,
        input.estimatedMinutes ?? null, input.priority ?? 2,
        input.source ?? 'app', input.externalId ?? null,
        input.measure && input.measure !== 'done' ? input.measure : null,
        input.measure && input.measure !== 'done' ? input.target ?? null : null,
        input.unit?.trim() || null, input.difficulty ?? null, input.deadline ?? null, input.flexible === undefined ? null : input.flexible ? 1 : 0,
        input.subtasks?.length ? JSON.stringify(input.subtasks) : null, input.section?.trim() || null, storeAlerts(input.alerts), parseReminderTime(input.reminder) ?? null, storePlaces(input.locationReminders), storeAnchor(input.anchor), now, now,
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
        estimatedMinutes: 'estimated_minutes', priority: 'priority',
        source: 'source', externalId: 'external_id',
        measure: 'measure', target: 'target', unit: 'unit', amount: 'amount',
        difficulty: 'difficulty', deadline: 'deadline', flexible: 'flexible', subtasks: 'subtasks', section: 'section', alerts: 'alerts',
        reminder: 'reminder', locationReminders: 'location_reminders', anchor: 'anchor',
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
            : key === 'anchor' ? storeAnchor(raw as HabitAnchor | null)
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
    // Finished just now: how early (lib/taskSpeed.ts); already done keeps its own; reopened has none.
    const speed = done ? (task.status === 'done' ? task.speed ?? null : speedForTask(task)) : null;
    await db.runAsync(
        `UPDATE tasks SET amount = ?, status = ?, completed_at = ?, speed = ?, updated_at = ?, synced = 0 WHERE id = ?`,
        value, done ? 'done' : 'open', done ? (task.status === 'done' ? task.completedAt ?? now : now) : null, speed && speed > 1 ? speed : null, now, task.id,
    );
    if (done !== (task.status === 'done')) void publishIfShared(task.id, done);
}

/** Marks a task done, or reopens it. Completion time is recorded, never guessed. */
export async function setTaskStatus(id: string, status: TaskStatus, completedAt?: string): Promise<void> {
    const db = await getDatabase();
    if (!db) throw new Error('Task storage is unavailable. Your changes were not saved.');
    const now = nowISO();
    // Done early pays more (lib/taskSpeed.ts): worked out as it is ticked, and kept with it.
    let speed = 1;
    if (status === 'done') {
        const row: any = await db.getFirstAsync('SELECT id, estimated_minutes, due_time, measure, target FROM tasks WHERE id = ?', id);
        if (row) speed = speedForTask({ id, estimatedMinutes: row.estimated_minutes ?? undefined, dueTime: row.due_time ?? undefined, measure: row.measure ?? undefined, target: row.target ?? undefined }, completedAt ? new Date(completedAt) : new Date());
    }
    await db.runAsync(
        'UPDATE tasks SET status = ?, completed_at = ?, speed = ?, updated_at = ?, synced = 0 WHERE id = ?',
        status, status === 'done' ? completedAt ?? now : null, speed > 1 ? speed : null, now, id,
    );
    // Not awaited: the task is already saved, and somebody else's view of it is
    // not worth holding a tick behind a network call.
    void publishIfShared(id, status === 'done');
    const { emit } = require('./appEvents') as typeof import('./appEvents');
    if (status === 'done') emit('task_completed', { taskId: id, speed });
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
