import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase } from './database';
import { getSupabase } from './supabase';
import {
    chunk, completionToLocal, completionToRemote, habitToLocal, habitToRemote,
    isUuid, orderForUpload, taskToLocal, taskToRemote,
} from './cloudMapping';
import { emit } from './appEvents';

/**
 * Backup and restore.
 *
 * The phone stays the source of truth while in use; the server is the copy that
 * survives a lost or replaced phone, and the place friends read shared habits
 * from. A sync is two passes:
 *
 * 1. Upload every local row still marked `synced = 0`. A row is only marked
 *    uploaded if it has not changed while the upload was in flight, so an edit
 *    made mid-sync is not lost.
 * 2. Download what changed on the server since the last sync, and write it
 *    locally, except over a local row that has unsent changes. Those win and go
 *    up on the next pass, so nothing typed on this phone is overwritten.
 *
 * The download cursor is the newest updated_at the server returned, not this
 * phone's clock, so a phone with the wrong time cannot skip changes.
 */

type Table = 'habits' | 'completions' | 'tasks';

interface TableSpec {
    local: Table;
    remote: string;
    toRemote: (row: any, userId: string) => any;
    toLocal: (row: any) => any;
    /** Columns the server matches an upload on. */
    onConflict: string;
    /** Local columns an incoming row replaces an existing one on. */
    localConflict: string;
}

const TABLES: TableSpec[] = [
    // Goals are habits, and habits point at goals, so habits go first.
    { local: 'habits', remote: 'habits', toRemote: habitToRemote, toLocal: habitToLocal, onConflict: 'id', localConflict: 'id' },
    // One completion per habit per day, on both sides.
    { local: 'completions', remote: 'habit_completions', toRemote: completionToRemote, toLocal: completionToLocal, onConflict: 'habit_id,date', localConflict: 'habit_id, date' },
    { local: 'tasks', remote: 'tasks', toRemote: taskToRemote, toLocal: taskToLocal, onConflict: 'id', localConflict: 'id' },
];

const BATCH = 200;
const PAGE = 1000;
const cursorKey = (userId: string) => `cloud_pull_cursor_${userId}`;
export const LAST_SYNC_KEY = 'cloud_last_sync_at';

export interface SyncReport {
    ok: boolean;
    uploaded: number;
    downloaded: number;
    /** Rows the server refused, or that can never be uploaded. */
    failed: number;
    /**
     * Tables this server does not have yet, because the migration has not been
     * applied. Their rows stay on the phone, unsent, and go up once it has.
     */
    waiting?: string[];
    error?: string;
    at?: string;
}

let running: Promise<SyncReport> | null = null;

/** Runs a sync, or joins the one already running rather than starting another. */
export function syncNow(): Promise<SyncReport> {
    if (!running) {
        running = runSync().finally(() => { running = null; });
    }
    return running;
}

export async function lastSyncedAt(): Promise<string | null> {
    try {
        return await AsyncStorage.getItem(LAST_SYNC_KEY);
    } catch {
        return null;
    }
}

async function runSync(): Promise<SyncReport> {
    const sb = getSupabase();
    const report: SyncReport = { ok: false, uploaded: 0, downloaded: 0, failed: 0 };
    if (!sb) return { ...report, error: 'Backup is not set up in this build.' };

    const { data: { session } } = await sb.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return { ...report, error: 'Sign in to back up.' };

    const db = await getDatabase();
    if (!db) return { ...report, error: 'Local storage is unavailable.' };

    try {
        for (const spec of TABLES) {
            const pushed = await upload(db, sb, spec, userId);
            report.uploaded += pushed.uploaded;
            report.failed += pushed.failed;
        }
        report.downloaded = await download(db, sb, userId);
        report.downloaded += await pullShared(db, sb, userId).catch(error => {
            console.warn('[Backup] shared goals did not refresh:', error?.message);
            return 0;
        });
        report.failed += skippedOnDownload;

        if (absentTables.size > 0) report.waiting = [...absentTables];
        report.ok = report.failed === 0;
        report.at = new Date().toISOString();
        await AsyncStorage.setItem(LAST_SYNC_KEY, report.at);

        if (report.downloaded > 0) await announceChanges();
        return report;
    } catch (error: any) {
        return { ...report, error: humanError(error) };
    }
}

/* -------------------------------------------------------------------------- */
/*  Upload                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The column a server error is complaining about, if that is what it is.
 *
 * A database that has not had the latest migration applied is missing columns
 * the app knows about. Postgres reports that as 42703 and PostgREST as
 * PGRST204; both name the column.
 */
/**
 * Whether the server has no such table at all.
 *
 * A database still waiting for the latest migration has no `tasks` table. That
 * used to abort the whole restore, so a backup that had just put every habit
 * safely on the server reported itself as failed. The table is skipped instead,
 * its rows stay marked unsent, and they go up the first sync after the
 * migration is applied.
 */
export function missingTableFrom(error: any): boolean {
    const code = String(error?.code ?? '');
    const message = String(error?.message ?? '');
    return code === 'PGRST205' || code === '42P01'
        || /could not find the table/i.test(message)
        || /relation "?[a-z_.]+"? does not exist/i.test(message);
}

export function missingColumnFrom(error: any): string | null {
    const message = String(error?.message ?? '');
    const match = message.match(/column "?([a-z_]+)"? of relation/i)
        || message.match(/column [a-z_]+\.([a-z_]+) does not exist/i)
        || message.match(/Could not find the '([a-z_]+)' column/i);
    return match ? match[1] : null;
}

/** Columns this server turned out not to have; not retried again this session. */
const absentColumns = new Set<string>();
/** Tables this server turned out not to have; reported, and not retried. */
const absentTables = new Set<string>();

const withoutColumn = (rows: any[], column: string): any[] =>
    rows.map(row => { const copy = { ...row }; delete copy[column]; return copy; });

/**
 * Upserts, and if the server does not have one of the columns, sends the rows
 * again without it. Everything else is still backed up, which matters more
 * than the one field a database update has not added yet.
 */
async function upsertTolerant(sb: any, spec: TableSpec, rows: any[]): Promise<{ error: any }> {
    let payload = rows;
    for (const column of absentColumns) payload = withoutColumn(payload, column);

    for (let attempt = 0; attempt < 8; attempt++) {
        const result = await sb.from(spec.remote).upsert(payload, { onConflict: spec.onConflict });
        if (!result.error) return { error: null };

        const column = missingColumnFrom(result.error);
        if (!column || !(column in (payload[0] ?? {}))) return { error: result.error };

        console.warn(`[Backup] ${spec.remote}.${column} is missing on the server; backing up without it.`);
        absentColumns.add(column);
        payload = withoutColumn(payload, column);
    }
    return { error: new Error('Too many missing columns') };
}

async function upload(db: any, sb: any, spec: TableSpec, userId: string) {
    if (absentTables.has(spec.remote)) return { uploaded: 0, failed: 0 };

    const rows: any[] = await db.getAllAsync(
        `SELECT * FROM ${spec.local} WHERE synced = 0 AND user_id = ?`, userId,
    );
    if (rows.length === 0) return { uploaded: 0, failed: 0 };

    const { upload: ordered, skipped } = orderForUpload(rows);
    // A completion for a habit the server cannot hold would fail the batch.
    const usable = spec.local === 'completions' ? ordered.filter(row => isUuid(row.habit_id)) : ordered;
    let failed = skipped.length + (ordered.length - usable.length);
    let uploaded = 0;

    for (const batch of chunk(usable, BATCH)) {
        const payload = batch.map(row => spec.toRemote(row, userId));
        const { error } = await upsertTolerant(sb, spec, payload);

        if (!error) {
            uploaded += await markUploaded(db, spec.local, batch);
            continue;
        }

        // Nothing to retry one row at a time if the table itself is not there.
        // The rows stay unsent and go up once the migration has been applied.
        if (missingTableFrom(error)) {
            absentTables.add(spec.remote);
            console.warn(`[Backup] this server has no ${spec.remote} table yet; keeping those changes on the phone.`);
            return { uploaded, failed };
        }

        // One bad row fails the whole batch. Retry one at a time so every other
        // row still gets backed up, and only the bad one is reported.
        for (const row of batch) {
            const single = await upsertTolerant(sb, spec, [spec.toRemote(row, userId)]);
            if (single.error) {
                failed += 1;
                console.warn(`[Backup] ${spec.remote} ${row.id} refused:`, single.error.message);
            } else {
                uploaded += await markUploaded(db, spec.local, [row]);
            }
        }
    }
    return { uploaded, failed };
}

/**
 * Marks rows uploaded only if they have not changed since they were read, so
 * an edit made while the upload was in flight still goes up next time.
 */
async function markUploaded(db: any, table: Table, rows: any[]): Promise<number> {
    for (const row of rows) {
        await db.runAsync(
            `UPDATE ${table} SET synced = 1 WHERE id = ? AND updated_at IS ?`,
            row.id, row.updated_at ?? null,
        );
    }
    // The server accepted every row in the batch, whether or not one changed again since.
    return rows.length;
}

/* -------------------------------------------------------------------------- */
/*  Download                                                                   */
/* -------------------------------------------------------------------------- */

let skippedOnDownload = 0;

async function download(db: any, sb: any, userId: string): Promise<number> {
    const since = await AsyncStorage.getItem(cursorKey(userId));
    let newest = since;
    let written = 0;
    skippedOnDownload = 0;

    for (const spec of TABLES) {
        if (absentTables.has(spec.remote)) continue;

        for (let from = 0; ; from += PAGE) {
            let query = sb.from(spec.remote).select('*').eq('user_id', userId)
                .order('updated_at', { ascending: true }).range(from, from + PAGE - 1);
            // gte rather than gt: a row sharing the cursor's timestamp is applied
            // twice rather than missed, and applying it twice is harmless.
            if (since) query = query.gte('updated_at', since);

            const { data, error } = await query;
            if (error) {
                // A table the server does not have is not a failed restore.
                if (missingTableFrom(error)) {
                    absentTables.add(spec.remote);
                    console.warn(`[Backup] this server has no ${spec.remote} table yet; nothing to restore from it.`);
                    break;
                }
                throw error;
            }
            if (!data?.length) break;

            await db.withTransactionAsync(async () => {
                for (const remote of data) {
                    // One row that cannot be written locally is skipped and
                    // reported, rather than aborting the whole restore.
                    try {
                        written += await writeLocal(db, spec, spec.toLocal(remote));
                    } catch (error: any) {
                        skippedOnDownload += 1;
                        console.warn(`[Backup] could not restore ${spec.remote} ${remote.id}:`, error?.message);
                    }
                    if (remote.updated_at && (!newest || remote.updated_at > newest)) newest = remote.updated_at;
                }
            });
            if (data.length < PAGE) break;
        }
    }

    if (newest && newest !== since) await AsyncStorage.setItem(cursorKey(userId), newest);
    return written;
}

/**
 * Everything you are on with somebody else, brought up to date.
 *
 * The pass above reads only rows whose `user_id` is yours. A shared goal is
 * one plan with rows from two people in it: the owner's goal and habits, the
 * tasks either of you added, and a friend's cover photo or reminder change on
 * any of them. Those are read here and kept as your local copy, under your
 * user id, so the rest of the app treats them like anything else on the phone.
 *
 * Read whole rather than from a cursor. A shared plan is tens of rows, and a
 * cursor per friend is far more machinery than re-reading them.
 */
async function pullShared(db: any, sb: any, userId: string): Promise<number> {
    const mine = `owner_id.eq.${userId},shared_with_id.eq.${userId}`;
    const [goals, habits, tasks] = await Promise.all([
        sb.from('shared_goals').select('goal_id').eq('status', 'accepted').is('deleted_at', null).or(mine),
        sb.from('shared_habits').select('habit_id').eq('status', 'accepted').is('deleted_at', null).eq('shared_with_id', userId),
        sb.from('shared_tasks').select('task_id').eq('status', 'accepted').is('deleted_at', null).eq('shared_with_id', userId),
    ]);
    const ids = (result: any, column: string): string[] =>
        [...new Set<string>((result?.data ?? []).map((row: any) => row[column]).filter(isUuid))];
    const goalIds = ids(goals, 'goal_id');
    const habitIds = ids(habits, 'habit_id');
    const taskIds = ids(tasks, 'task_id');
    if (!goalIds.length && !habitIds.length && !taskIds.length) return 0;

    const list = (values: string[]) => `(${values.join(',')})`;
    const habitFilter = [
        goalIds.length ? `id.in.${list(goalIds)}` : '',
        goalIds.length ? `goal_id.in.${list(goalIds)}` : '',
        habitIds.length ? `id.in.${list(habitIds)}` : '',
    ].filter(Boolean).join(',');
    const taskFilter = [
        goalIds.length ? `goal_id.in.${list(goalIds)}` : '',
        taskIds.length ? `id.in.${list(taskIds)}` : '',
    ].filter(Boolean).join(',');

    const [habitRows, taskRows] = await Promise.all([
        habitFilter ? sb.from('habits').select('*').neq('user_id', userId).or(habitFilter) : { data: [] },
        taskFilter && !absentTables.has('tasks') ? sb.from('tasks').select('*').neq('user_id', userId).or(taskFilter) : { data: [] },
    ]);

    let written = 0;
    await db.withTransactionAsync(async () => {
        for (const [spec, rows] of [[TABLES[0], habitRows.data], [TABLES[2], taskRows.data]] as const) {
            for (const remote of rows ?? []) {
                try {
                    // Your copy of the row, so it is yours to tick, sync and see.
                    written += await writeLocal(db, spec, { ...spec.toLocal(remote), user_id: userId });
                } catch (error: any) {
                    console.warn(`[Backup] could not refresh shared ${spec.remote} ${remote.id}:`, error?.message);
                }
            }
        }
    });
    return written;
}

/** Refreshes shared goals now, without a whole backup — for right after accepting one. */
export async function refreshShared(): Promise<number> {
    const sb = getSupabase();
    const db = await getDatabase();
    if (!sb || !db) return 0;
    const { data: { session } } = await sb.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return 0;
    const written = await pullShared(db, sb, userId).catch(() => 0);
    if (written > 0) await announceChanges();
    return written;
}

/**
 * Inserts or replaces a local row from the server, except where the local row
 * has unsent changes: those win and are uploaded on the next pass.
 */
async function writeLocal(db: any, spec: TableSpec, row: Record<string, any>): Promise<number> {
    const columns = Object.keys(row);
    const placeholders = columns.map(() => '?').join(', ');
    const updates = columns
        .filter(column => column !== 'id' || spec.localConflict !== 'id')
        .map(column => `${column} = excluded.${column}`)
        .join(', ');

    const result = await db.runAsync(
        `INSERT INTO ${spec.local} (${columns.join(', ')}) VALUES (${placeholders})
         ON CONFLICT(${spec.localConflict}) DO UPDATE SET ${updates}
         WHERE ${spec.local}.synced = 1`,
        ...columns.map(column => row[column]),
    );
    return result?.changes ?? 0;
}

/** Every screen reading habits, completions or tasks refreshes after a restore. */
async function announceChanges(): Promise<void> {
    try {
        const { reloadHabitsFromStorage } = require('./habitsSQLite');
        await reloadHabitsFromStorage();
    } catch {
        // Screens still refresh on their next focus.
    }
    emit('tasks_changed');
    emit('habit_completion_updated', {});
    emit('cloud_restored');
}

function humanError(error: any): string {
    const message = String(error?.message ?? error ?? '');
    if (/network|fetch|timed out|offline/i.test(message)) return 'No connection. Your data is safe on this phone and will back up when you are online.';
    if (/jwt|token|auth/i.test(message)) return 'Your session expired. Sign in again to keep backing up.';
    return 'Backup did not finish. Your data is safe on this phone.';
}

/** Forgets where downloads left off, so the next sync fetches everything. */
export async function resetSyncCursor(userId: string): Promise<void> {
    try {
        await AsyncStorage.removeItem(cursorKey(userId));
    } catch {
        // Nothing to do.
    }
}
