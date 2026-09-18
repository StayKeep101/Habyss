import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { getDatabase } from './database';
import { getSupabase } from './supabase';
import {
    chunk, completionToLocal, completionToRemote, habitToLocal, habitToRemote,
    isUuid, orderForUpload, taskToLocal, taskToRemote,
} from './cloudMapping';

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
        report.failed += skippedOnDownload;

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

async function upload(db: any, sb: any, spec: TableSpec, userId: string) {
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
        const { error } = await sb.from(spec.remote).upsert(payload, { onConflict: spec.onConflict });

        if (!error) {
            uploaded += await markUploaded(db, spec.local, batch);
            continue;
        }

        // One bad row fails the whole batch. Retry one at a time so every other
        // row still gets backed up, and only the bad one is reported.
        for (const row of batch) {
            const single = await sb.from(spec.remote).upsert([spec.toRemote(row, userId)], { onConflict: spec.onConflict });
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
        for (let from = 0; ; from += PAGE) {
            let query = sb.from(spec.remote).select('*').eq('user_id', userId)
                .order('updated_at', { ascending: true }).range(from, from + PAGE - 1);
            // gte rather than gt: a row sharing the cursor's timestamp is applied
            // twice rather than missed, and applying it twice is harmless.
            if (since) query = query.gte('updated_at', since);

            const { data, error } = await query;
            if (error) throw error;
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
    DeviceEventEmitter.emit('tasks_changed');
    DeviceEventEmitter.emit('habit_completion_updated', {});
    DeviceEventEmitter.emit('cloud_restored');
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
