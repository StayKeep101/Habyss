import { generateId, getDatabase, isSQLiteAvailable, nowISO } from './database';
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
export type TaskSource = 'app' | 'mcp' | 'shortcut';

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
    createdAt: string;
    updatedAt: string;
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
    const rows = await db.getAllAsync(
        `SELECT * FROM tasks WHERE deleted = 0 ${where} ORDER BY due_date IS NULL, due_date ASC, priority ASC`,
    );
    return (rows ?? []).map(rowToTask);
}

export async function createTask(input: TaskInput): Promise<Task | null> {
    if (!isSQLiteAvailable()) return null;
    const db = await getDatabase();
    if (!db) return null;

    const title = input.title?.trim();
    if (!title) return null;

    // An external id means "this already exists somewhere else", so a second
    // import of the same plan updates that row rather than adding another.
    if (input.externalId) {
        const existing = await db.getFirstAsync(
            'SELECT * FROM tasks WHERE external_id = ? AND deleted = 0',
            input.externalId,
        );
        if (existing) {
            await updateTask(existing.id, input);
            const refreshed = await db.getFirstAsync('SELECT * FROM tasks WHERE id = ?', existing.id);
            return refreshed ? rowToTask(refreshed) : null;
        }
    }

    const id = generateId();
    const now = nowISO();
    const uid = await getLocalUserId().catch(() => null);

    await db.runAsync(
        `INSERT INTO tasks (
            id, user_id, title, description, due_date, due_time, estimated_minutes,
            priority, goal_id, status, source, external_id, created_at, updated_at, deleted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, 0)`,
        id, uid, title, input.description ?? null, input.dueDate ?? null, input.dueTime ?? null,
        input.estimatedMinutes ?? null, input.priority ?? 2, input.goalId ?? null,
        input.source ?? 'app', input.externalId ?? null, now, now,
    );

    const row = await db.getFirstAsync('SELECT * FROM tasks WHERE id = ?', id);
    return row ? rowToTask(row) : null;
}

export async function updateTask(id: string, patch: Partial<TaskInput>): Promise<void> {
    if (!isSQLiteAvailable()) return;
    const db = await getDatabase();
    if (!db) return;

    const columns: Record<keyof TaskInput, string> = {
        title: 'title', description: 'description', dueDate: 'due_date', dueTime: 'due_time',
        estimatedMinutes: 'estimated_minutes', priority: 'priority', goalId: 'goal_id',
        source: 'source', externalId: 'external_id',
    };

    const sets: string[] = [];
    const params: any[] = [];
    for (const [key, column] of Object.entries(columns) as [keyof TaskInput, string][]) {
        const value = patch[key];
        if (value !== undefined) { sets.push(`${column} = ?`); params.push(value); }
    }
    if (sets.length === 0) return;

    sets.push('updated_at = ?');
    params.push(nowISO(), id);
    await db.runAsync(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, ...params);
}

/** Marks a task done, or reopens it. Completion time is recorded, never guessed. */
export async function setTaskStatus(id: string, status: TaskStatus): Promise<void> {
    if (!isSQLiteAvailable()) return;
    const db = await getDatabase();
    if (!db) return;
    const now = nowISO();
    await db.runAsync(
        'UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?',
        status, status === 'done' ? now : null, now, id,
    );
}

export async function deleteTask(id: string): Promise<void> {
    if (!isSQLiteAvailable()) return;
    const db = await getDatabase();
    if (!db) return;
    await db.runAsync('UPDATE tasks SET deleted = 1, updated_at = ? WHERE id = ?', nowISO(), id);
}

/* -------------------------------------------------------------------------- */
/*  What matters today                                                         */
/* -------------------------------------------------------------------------- */

/** How urgent a task is, lowest first. Pure, so the ordering is testable. */
export function taskRank(task: Task, today: string): number {
    // Overdue first, then due today, then undated, then future.
    let bucket: number;
    if (task.dueDate && task.dueDate < today) bucket = 0;
    else if (task.dueDate === today) bucket = 1;
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

export const todayKey = (date: Date = new Date()): string => localDateKey(date);
