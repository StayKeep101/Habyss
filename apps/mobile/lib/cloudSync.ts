import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase } from './database';
import { getSupabase } from './supabase';
import {
    chunk, completionToLocal, completionToRemote, habitToLocal, habitToRemote,
    isUuid, orderForUpload, taskToLocal, taskToRemote,
} from './cloudMapping';
import { emit } from './appEvents';
import { syncPersonal } from './personalBackup';
import { cloudPullPage, type PullPosition } from './cloudPullPage';

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

type Table = 'habits' | 'completions' | 'tasks' | 'milestones';

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
    { local: 'habits', remote: 'habits', toRemote: habitToRemote, toLocal: habitToLocal, onConflict: 'id', localConflict: 'id' },
    // One completion per habit per day, on both sides.
    // Matched on what a completion is — one person, one habit, one day — not on
    // its id: local ids are "<habit>_<date>", which the server cannot store.
    { local: 'completions', remote: 'habit_completions', toRemote: completionToRemote, toLocal: completionToLocal, onConflict: 'user_id,habit_id,date', localConflict: 'habit_id, date' },
    { local: 'tasks', remote: 'tasks', toRemote: taskToRemote, toLocal: taskToLocal, onConflict: 'id', localConflict: 'id' },
];

const BATCH = 200;
const PAGE = 1000;
const cursorKey = (userId: string) => `cloud_pull_cursor_${userId}`;
const tableCursorKey = (userId: string, table: string) => `cloud_pull_v2_${userId}_${table}`;
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
let watchingDays: string | null = null;
let stopWatchingDays: (() => void) | null = null;

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
        await requeue(db, sb, userId);
        for (const spec of TABLES) {
            const pushed = await upload(db, sb, spec, userId);
            report.uploaded += pushed.uploaded;
            report.failed += pushed.failed;
        }
        report.downloaded = await download(db, sb, userId);
        report.downloaded += await pullShared(db, sb, userId).catch(error => {
            console.warn('[Backup] shared plans did not refresh:', error?.message);
            return 0;
        });
        report.failed += skippedOnDownload;

        if (absentTables.size > 0) report.waiting = [...absentTables];
        report.ok = report.failed === 0;
        report.at = new Date().toISOString();
        await AsyncStorage.setItem(LAST_SYNC_KEY, report.at);
        // Settings, Echo, focus totals and the rest that are not table rows.
        await syncPersonal(userId).catch(error => console.warn('[Backup] personal stores:', error?.message));
        // The brain dump, thought by thought, so an AI assistant can add to it and read it.
        await (require('./brainDumpSync') as typeof import('./brainDumpSync')).syncBrainDump(sb, userId);
        // The day's settings, one by one, so the desktop builds the same day; and from now on, its changes arrive live.
        const days = require('./dayInputsSync') as typeof import('./dayInputsSync');
        await (require('./calendarEvents') as typeof import('./calendarEvents')).publishWeek().catch(() => undefined);
        await days.syncDayInputs(sb, userId);
        if (watchingDays !== userId) { stopWatchingDays?.(); stopWatchingDays = days.watchDayInputs(sb, userId); watchingDays = userId; }

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

/**
 * Every detail goes up, even one the server could not take at the time.
 *
 * A row uploaded while the server lacked a column (flexible, deadline,
 * subtasks, section…) was still marked uploaded, so that detail never reached
 * the server: a reinstall brought the habit or task back without it (a fixed
 * time came back flexible). So a table that had a column dropped is
 * remembered across launches and sent again whole on the next sync, and once,
 * after this update, everything is sent again with every field.
 */
const DROPPED_KEY = 'cloud_dropped_tables';
const FULL_PUSH_KEY = (userId: string) => `cloud_full_push_${userId}`;
/** Bump when the server gains columns rows already uploaded never carried. */
const FULL_PUSH_VERSION = '1';
const RESENT: Table[] = ['habits', 'tasks', 'milestones'];

async function rememberDropped(table: Table): Promise<void> {
    try {
        const raw = await AsyncStorage.getItem(DROPPED_KEY);
        const tables: string[] = raw ? JSON.parse(raw) : [];
        if (!tables.includes(table)) await AsyncStorage.setItem(DROPPED_KEY, JSON.stringify([...tables, table]));
    } catch {
        // The worst case is one detail sent on a later edit instead.
    }
}

async function requeue(db: any, sb: any, userId: string): Promise<void> {
    let tables: Table[] = [];
    let fullPush = false;
    try {
        const raw = await AsyncStorage.getItem(DROPPED_KEY);
        tables = (raw ? JSON.parse(raw) : []).filter((table: string): table is Table => RESENT.includes(table as Table));
        fullPush = (await AsyncStorage.getItem(FULL_PUSH_KEY(userId))) !== FULL_PUSH_VERSION;
    } catch {
        return;
    }
    if (fullPush) {
        // Take in what another phone changed first, so sending everything
        // again never puts an older copy over a newer one.
        await download(db, sb, userId);
        tables = RESENT;
    }
    if (!tables.length) return;
    for (const table of tables) {
        await db.runAsync(`UPDATE ${table} SET synced = 0 WHERE user_id = ? AND synced = 1`, userId);
    }
    await AsyncStorage.removeItem(DROPPED_KEY);
    if (fullPush) await AsyncStorage.setItem(FULL_PUSH_KEY(userId), FULL_PUSH_VERSION);
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
    for (const column of absentColumns) {
        if (column in (payload[0] ?? {})) await rememberDropped(spec.local);
        payload = withoutColumn(payload, column);
    }

    for (let attempt = 0; attempt < 8; attempt++) {
        const result = await sb.from(spec.remote).upsert(payload, { onConflict: spec.onConflict });
        if (!result.error) return { error: null };

        const column = missingColumnFrom(result.error);
        if (!column || !(column in (payload[0] ?? {}))) return { error: result.error };

        console.warn(`[Backup] ${spec.remote}.${column} is missing on the server; backing up without it.`);
        absentColumns.add(column);
        await rememberDropped(spec.local);
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

    // A completion's local id is "<habit>_<date>" and never goes to the server
    // (it gets its own there), so only its habit has to be a real id. Every
    // completion used to be skipped here for not having a UUID, which is why
    // none ever reached the server and friends saw nothing done.
    const isCompletion = spec.local === 'completions';
    const { upload: ordered, skipped } = isCompletion ? { upload: rows, skipped: [] as any[] } : orderForUpload(rows);
    const usable = isCompletion ? ordered.filter(row => isUuid(row.habit_id)) : ordered;
    let failed = skipped.length + (ordered.length - usable.length);
    let uploaded = 0;

    // A task someone shared with you is their row on the server. Edits to the
    // plan go up, but your ticks are yours: its done-state is left out, in
    // batches of their own so a missing column never blanks the owner's.
    const foreign = spec.local === 'tasks' ? await othersTasks(sb, usable, userId) : new Set<string>();
    const toRemote = (row: any) => foreign.has(row.id)
        ? withoutKeys(spec.toRemote(row, userId), PERSONAL_TASK_FIELDS)
        : spec.toRemote(row, userId);
    const batches = [
        ...chunk(usable.filter(row => !foreign.has(row.id)), BATCH),
        ...chunk(usable.filter(row => foreign.has(row.id)), BATCH),
    ];

    for (const batch of batches) {
        const payload = batch.map(toRemote);
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
            const single = await upsertTolerant(sb, spec, [toRemote(row)]);
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

/** Which of these task rows belong to somebody else on the server (shared with you). */
async function othersTasks(sb: any, rows: any[], userId: string): Promise<Set<string>> {
    const ids = rows.map(row => row.id).filter(isUuid);
    const found = new Set<string>();
    for (const part of chunk(ids, BATCH)) {
        const { data } = await sb.from('tasks').select('id').in('id', part).neq('user_id', userId);
        for (const row of data ?? []) found.add(row.id);
    }
    return found;
}

const withoutKeys = (row: Record<string, any>, keys: string[]) =>
    Object.fromEntries(Object.entries(row).filter(([key]) => !keys.includes(key)));

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
    let written = 0;
    skippedOnDownload = 0;

    for (const spec of TABLES) {
        if (absentTables.has(spec.remote)) continue;

        // Independent cursors prevent a later table's timestamp from skipping
        // changes arriving in a table that was already read during this sync.
        const since = await AsyncStorage.getItem(tableCursorKey(userId, spec.remote));
        let newest = since;
        let after: PullPosition | null = null;
        const failuresBefore = skippedOnDownload;
        for (;;) {
            const query = cloudPullPage(sb, spec.remote, userId, since, after, PAGE);
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
            const last = data[data.length - 1];
            after = { updated_at: last.updated_at, id: last.id };
        }
        // Failed local writes must be retried rather than passed by the cursor.
        if (newest && newest !== since && skippedOnDownload === failuresBefore) {
            await AsyncStorage.setItem(tableCursorKey(userId, spec.remote), newest);
        }
    }
    return written;
}

/**
 * Everything you are on with somebody else, brought up to date.
 *
 * The pass above reads only rows whose `user_id` is yours. A shared habit or
 * task is one plan with rows from two people in it: the owner's rows, and a friend's cover photo or reminder change on
 * any of them. Those are read here and kept as your local copy, under your
 * user id, so the rest of the app treats them like anything else on the phone.
 *
 * Read whole rather than from a cursor. A shared plan is tens of rows, and a
 * cursor per friend is far more machinery than re-reading them.
 */
/** On a shared task, what each person keeps for themselves when the plan refreshes. */
const PERSONAL_TASK_FIELDS = ['status', 'completed_at', 'amount'];

async function pullShared(db: any, sb: any, userId: string): Promise<number> {
    // Shares closed by a delete made offline go first, so nothing deleted is pulled back in.
    const ending = require('./shareEnding') as typeof import('./shareEnding');
    await ending.flushShareEndings().catch(() => false);
    const [habits, tasks] = await Promise.all([
        sb.from('shared_habits').select('habit_id').eq('status', 'accepted').is('deleted_at', null).eq('shared_with_id', userId),
        sb.from('shared_tasks').select('task_id').eq('status', 'accepted').is('deleted_at', null).eq('shared_with_id', userId),
    ]);
    const ids = (result: any, column: string): string[] =>
        [...new Set<string>((result?.data ?? []).map((row: any) => row[column]).filter(isUuid))];
    const habitIds = ids(habits, 'habit_id');
    const taskIds = ids(tasks, 'task_id');
    // A share that has ended (the other person deleted it): your copy becomes
    // your own, under an id of its own. Only when the server answered both lists.
    let rekeyed = 0;
    if (!habits?.error && !tasks?.error) {
        const moved = await ending.keepEndedCopies({ habit: habitIds, task: taskIds }, userId).catch(() => ({}));
        rekeyed = Object.keys(moved).length;
        if (rekeyed) {
            const { reloadHabitsFromStorage } = require('./habitsSQLite') as typeof import('./habitsSQLite');
            await reloadHabitsFromStorage().catch(() => undefined);
            const { emit } = require('./appEvents') as typeof import('./appEvents');
            emit('tasks_changed');
        }
    }
    if (!habitIds.length && !taskIds.length) return rekeyed;

    const list = (values: string[]) => `(${values.join(',')})`;
    const habitFilter = habitIds.length ? `id.in.${list(habitIds)}` : '';
    const taskFilter = taskIds.length ? `id.in.${list(taskIds)}` : '';

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
                    // A shared task's done-state is each person's own: the
                    // owner finishing it must not tick it for you, so a new copy
                    // starts open and an existing one keeps your progress.
                    const isTask = spec.local === 'tasks';
                    const local = isTask
                        ? { ...spec.toLocal(remote), user_id: userId, status: 'open', completed_at: null, amount: null }
                        : { ...spec.toLocal(remote), user_id: userId };
                    written += await writeLocal(db, spec, local, isTask ? PERSONAL_TASK_FIELDS : []);
                } catch (error: any) {
                    console.warn(`[Backup] could not refresh shared ${spec.remote} ${remote.id}:`, error?.message);
                }
            }
        }
    });
    return written;
}

/** Refreshes shared habits and tasks now, without a whole backup — for right after accepting one. */
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
async function writeLocal(db: any, spec: TableSpec, row: Record<string, any>, keep: string[] = []): Promise<number> {
    const columns = Object.keys(row);
    const placeholders = columns.map(() => '?').join(', ');
    const updates = columns
        .filter(column => column !== 'id' || spec.localConflict !== 'id')
        .filter(column => !keep.includes(column))
        .map(column => `${column} = excluded.${column}`)
        .join(', ');

    const result = await db.runAsync(
        `INSERT INTO ${spec.local} (${columns.join(', ')}) VALUES (${placeholders})
         ON CONFLICT(${spec.localConflict}) DO UPDATE SET ${updates}
         WHERE ${spec.local}.synced = 1
           AND ${spec.local}.updated_at IS NOT excluded.updated_at`,
        ...columns.map(column => row[column]),
    );
    return result?.changes ?? 0;
}

/** Every screen reading habits, completions or tasks refreshes after a restore. */
/**
 * True while changes that came from the server are being announced, so
 * listeners that send local changes out (lib/livePulse.ts) can tell them apart.
 * Without it, every restore announced a change, the change started a backup,
 * and the backup restored again — a loop every few seconds that kept the
 * phone busy and hot.
 */
let applyingRemote = false;
export const isApplyingRemote = () => applyingRemote;

async function announceChanges(): Promise<void> {
    applyingRemote = true;
    try {
        await announceRemote();
    } finally {
        applyingRemote = false;
    }
}

async function announceRemote(): Promise<void> {
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
        await AsyncStorage.multiRemove([cursorKey(userId), ...TABLES.map(spec => tableCursorKey(userId, spec.remote))]);
    } catch {
        // Nothing to do.
    }
}
