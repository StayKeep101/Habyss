/**
 * Database Layer - Expo SQLite with Expo Go Fallback
 * Provides offline-first data persistence for habits and completions
 * Falls back to Supabase-only mode if SQLite is unavailable (Expo Go)
 */

let SQLite: any = null;
let sqliteAvailable = false;

// Try to import SQLite - will fail gracefully in Expo Go
try {
    SQLite = require('expo-sqlite');
    sqliteAvailable = true;
} catch (error) {
    console.log('[Database] SQLite not available (Expo Go), using Supabase-only mode');
    sqliteAvailable = false;
}

const DATABASE_NAME = 'habyss.db';
const SCHEMA_VERSION = 27;

let dbInstance: any = null;
/**
 * The in-flight open, shared by every caller.
 *
 * getDatabase is called from many places at startup. Because it only assigned
 * dbInstance after awaiting, each concurrent caller opened the database and ran
 * the migrations at the same time, and their version writes interleaved into
 * "UNIQUE constraint failed: schema_version.version".
 */
let openPromise: Promise<any | null> | null = null;

/**
 * Check if SQLite is available
 */
export function isSQLiteAvailable(): boolean {
    return sqliteAvailable;
}

/**
 * Get or create the database instance
 */
export async function getDatabase(): Promise<any | null> {
    if (!sqliteAvailable) return null;
    if (dbInstance) return dbInstance;
    // Everyone waits on the same open, so migrations run exactly once.
    if (!openPromise) openPromise = openDatabase();
    return openPromise;
}

async function openDatabase(): Promise<any | null> {
    let connection: any = null;
    try {
        connection = await SQLite.openDatabaseAsync(DATABASE_NAME);

        // Enable WAL mode for better concurrent read/write performance
        await connection.execAsync('PRAGMA journal_mode = WAL;');
        // NORMAL sync is safe with WAL and significantly faster than FULL
        await connection.execAsync('PRAGMA synchronous = NORMAL;');
        // 8MB cache for faster reads on repeated queries
        await connection.execAsync('PRAGMA cache_size = -8000;');
        // Store temp tables in memory for faster joins/sorts
        await connection.execAsync('PRAGMA temp_store = MEMORY;');

        // Run migrations
        await runMigrations(connection);

        // Never expose a connection while its tables are still being migrated.
        dbInstance = connection;
        return dbInstance;
    } catch (error) {
        console.error('[Database] Failed to open database:', error);
        // A failed attempt is not proof that SQLite is unusable. sqliteAvailable
        // means "the module loaded"; turning it off here permanently disabled
        // local storage for the whole session after one transient failure, and
        // silently stopped saving habits. Clear the attempt so the next call
        // retries instead.
        dbInstance = null;
        openPromise = null;
        if (connection) await connection.closeAsync().catch(() => undefined);
        return null;
    }
}

/**
 * Add a column only when it is missing.
 *
 * ALTER TABLE ... ADD COLUMN throws "duplicate column name" when the column already
 * exists. That aborted runMigrations before the schema version was written, so every
 * later launch replayed the same migration, failed again, and getDatabase() disabled
 * SQLite for the whole session.
 */
async function addColumnIfMissing(db: any, table: string, column: string, definition: string): Promise<void> {
    const columns = await db.getAllAsync(`PRAGMA table_info(${table})`);
    if (columns?.some((c: any) => c.name === column)) return;
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
}

/**
 * Run database migrations
 */
async function runMigrations(db: any): Promise<void> {
    // Create schema version table
    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY
        );
    `);

    // Get current version
    const versionRow = await db.getFirstAsync('SELECT version FROM schema_version LIMIT 1');
    const currentVersion = versionRow?.version || 0;

    const migrations: [number, (db: any) => Promise<void>][] = [
        [1, migrateToV1],
        [2, migrateToV2],
        [3, migrateToV3],
        [4, migrateToV4],
        [5, migrateToV5],
        [6, migrateToV6],
        [7, migrateToV7],
        [8, migrateToV8],
        [9, migrateToV9],
        [10, migrateToV10],
        [11, migrateToV11],
        [12, migrateToV12],
        [13, migrateToV13],
        [14, migrateToV14],
        [15, migrateToV15],
        [16, migrateToV16],
        [17, migrateToV17],
        [18, migrateToV18],
        [19, migrateToV19],
        [20, migrateToV20],
        [21, migrateToV21],
        [22, migrateToV22],
        [23, migrateToV23],
        [24, migrateToV24],
        [25, migrateToV25],
        [26, migrateToV26],
        [27, migrateToV27],
    ];

    if (migrations[migrations.length - 1][0] !== SCHEMA_VERSION) {
        console.warn('[Database] SCHEMA_VERSION does not match the migration list');
    }

    // Record the version after each migration. Writing it only at the end meant a
    // failure part-way through left the version unset, replaying every migration.
    for (const [version, migrate] of migrations) {
        if (currentVersion >= version) continue;
        await migrate(db);
        // One transaction, so the table can never be seen empty or hold two rows.
        await db.withTransactionAsync(async () => {
            await db.runAsync('DELETE FROM schema_version');
            await db.runAsync('INSERT INTO schema_version (version) VALUES (?)', version);
        });
    }
}

/**
 * Migration to version 19 — a task's steps.
 *
 * "Write, edit and publish the blog post" is one task with three steps,
 * ticked one by one. Kept as JSON on the task ([{ id, title, done }]), backed
 * up with it; null on older rows, which is a task with no steps.
 */
/**
 * Migration to version 20 — a to-do's section in its goal's list.
 *
 * A goal's to-do list is its tasks, grouped under headings you name
 * ("Research", "Build", "Launch"). The heading is kept on the task, so a
 * to-do planned onto a day still knows where it came from. Null: no section.
 * On this phone only, like v15–v17.
 */
/**
 * Migration to version 21 — a habit's or task's own reminders before it begins.
 *
 * Minutes before its start, as JSON ("[10, 30]"): "Study in 10 min". The base
 * notifications (lib/dayGuide.ts) need nothing stored; these are the extras a
 * habit or task asks for. Backed up: the cloud tables gain `alerts`
 * (supabase/migrations/20261108000200_item_alerts.sql); until that is applied
 * the sync leaves the column out and carries on (lib/cloudSync.ts).
 */
/**
 * Migration to version 22 — a habit held before or after an event or meal
 * (lib/habitAnchor.ts), as JSON: {"to":"Accounting","side":"before","gap":0}.
 * Backed up through supabase/migrations/20261109000100_habit_anchor.sql; until
 * that is applied the sync leaves the column out and carries on.
 */
/**
 * Migration to version 23 — a task reminded like a habit: at a time on its day
 * ("HH:MM"), and at places, arriving or leaving (JSON). Backed up through
 * supabase/migrations/20261109000200_task_reminders.sql.
 */
/**
 * Migration to version 24 — a task held before or after something in the day,
 * like a habit (lib/habitAnchor.ts), as the same JSON. Kept on this phone.
 */
/** Drop a column only when it is there (a fresh install never had it). */
async function dropColumnIfPresent(db: any, table: string, column: string): Promise<void> {
    const columns = await db.getAllAsync(`PRAGMA table_info(${table})`);
    if (!columns?.some((c: any) => c.name === column)) return;
    await db.execAsync(`ALTER TABLE ${table} DROP COLUMN ${column};`);
}

/**
 * Migration to version 27 — goals are gone from Habyss.
 *
 * Goals were habits marked is_goal, with milestones and links from habits and
 * tasks (goal_id, milestone_id). The goal rows go (with their check-ins), the
 * milestones table goes, and the columns that held goals are dropped. Habits
 * and tasks that were under a goal stay, on their own. The goal settings kept
 * outside the database go too.
 */
async function migrateToV27(db: any): Promise<void> {
    const habitColumns = await db.getAllAsync('PRAGMA table_info(habits)');
    if (habitColumns?.some((c: any) => c.name === 'is_goal')) {
        const goals = ((await db.getAllAsync('SELECT id FROM habits WHERE is_goal = 1')) ?? []).map((row: { id: string }) => row.id);
        for (const id of goals) {
            await db.runAsync('DELETE FROM completions WHERE habit_id = ?', id);
            await db.runAsync('DELETE FROM habit_measurements WHERE habit_id = ?', id);
        }
        await db.runAsync('DELETE FROM habits WHERE is_goal = 1');
    }
    await db.execAsync('DROP INDEX IF EXISTS idx_habits_goal;');
    await db.execAsync('DROP TABLE IF EXISTS milestones;');
    for (const column of ['goal_id', 'is_goal', 'target_date', 'goal_spec']) await dropColumnIfPresent(db, 'habits', column);
    for (const column of ['goal_id', 'milestone_id']) await dropColumnIfPresent(db, 'tasks', column);
    try {
        const AsyncStorage = (require('@react-native-async-storage/async-storage') as typeof import('@react-native-async-storage/async-storage')).default;
        await AsyncStorage.multiRemove(['habyss_goal_logs', 'habyss_peak_targets', 'habyss_staked_goals', 'habyss_goal_celebrated']);
    } catch { /* settings left behind are never read */ }
    console.log('[Database] Migrated to schema v27');
}

/**
 * Migration to version 26 — depth for every check-in and every schedule.
 *  - completions.source: what logged it (manual, timer, health, auto, siri,
 *    widget, watch, notification). Null on older rows, which were by hand.
 *  - habits.schedule_history: the schedules a habit had before, so changing
 *    one never rewrites the days already lived (lib/scheduleHistory.ts).
 * Both kept on this phone.
 */
async function migrateToV26(db: any): Promise<void> {
    await addColumnIfMissing(db, 'completions', 'source', 'TEXT');
    await addColumnIfMissing(db, 'habits', 'schedule_history', 'TEXT');
    console.log('[Database] Migrated to schema v26');
}

/**
 * Migration to version 25 — what a finished task's Shards were multiplied by
 * for being done early (lib/taskSpeed.ts): 2, 1.5, or null. Kept on this phone.
 */
async function migrateToV25(db: any): Promise<void> {
    await addColumnIfMissing(db, 'tasks', 'speed', 'REAL');
    console.log('[Database] Migrated to schema v25');
}

async function migrateToV24(db: any): Promise<void> {
    await addColumnIfMissing(db, 'tasks', 'anchor', 'TEXT');
    console.log('[Database] Migrated to schema v24');
}

async function migrateToV23(db: any): Promise<void> {
    await addColumnIfMissing(db, 'tasks', 'reminder', 'TEXT');
    await addColumnIfMissing(db, 'tasks', 'location_reminders', 'TEXT');
    console.log('[Database] Migrated to schema v23');
}

async function migrateToV22(db: any): Promise<void> {
    await addColumnIfMissing(db, 'habits', 'anchor', 'TEXT');
    console.log('[Database] Migrated to schema v22');
}

async function migrateToV21(db: any): Promise<void> {
    await addColumnIfMissing(db, 'habits', 'alerts', 'TEXT');
    await addColumnIfMissing(db, 'tasks', 'alerts', 'TEXT');
    console.log('[Database] Migrated to schema v21');
}

async function migrateToV20(db: any): Promise<void> {
    await addColumnIfMissing(db, 'tasks', 'section', 'TEXT');
    console.log('[Database] Migrated to schema v20');
}

async function migrateToV19(db: any): Promise<void> {
    await addColumnIfMissing(db, 'tasks', 'subtasks', 'TEXT');
    console.log('[Database] Migrated to schema v19');
}

/**
 * Migration to version 18 — a goal's milestones.
 *
 * "Read 24 books by December 31" is kept on track by checkpoints: Book 1 by
 * Nov 2, Book 2 by Nov 9. They belong to the goal and nothing else (never on
 * the timeline or in a task list), each with the day it is due and when it
 * was reached. Backed up like habits and tasks.
 */
async function migrateToV18(db: any): Promise<void> {
    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS milestones (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            goal_id TEXT NOT NULL,
            title TEXT NOT NULL,
            due_date TEXT,
            done_at TEXT,
            position INTEGER DEFAULT 0,
            created_at TEXT,
            updated_at TEXT,
            deleted INTEGER DEFAULT 0,
            synced INTEGER DEFAULT 0
        );
    `);
    await db.execAsync('CREATE INDEX IF NOT EXISTS idx_milestones_goal ON milestones (goal_id, deleted);');
    await db.execAsync('CREATE INDEX IF NOT EXISTS idx_milestones_unsynced ON milestones (synced) WHERE synced = 0;');
    console.log('[Database] Migrated to schema v18');
}

/**
 * Migration to version 17 — whether a set time may move.
 *
 * A habit or task at a time of day is either flexible (the timeline may slide
 * it with the day, or fit it in again if its time passes) or exact (it stays
 * at that time, like a meeting). 0 is exact; null or 1 is flexible, which is
 * how every timed habit and task behaved before. On this phone only.
 */
async function migrateToV17(db: any): Promise<void> {
    await addColumnIfMissing(db, 'habits', 'flexible', 'INTEGER');
    await addColumnIfMissing(db, 'tasks', 'flexible', 'INTEGER');
    console.log('[Database] Migrated to schema v17');
}

/**
 * Migration to version 16 — a task's deadline, apart from its day.
 *
 * `due_date` is the day you plan to do it (the day it is on the timeline);
 * `deadline` is when it must be done by. Not done on its day, it moves to the
 * next one until the deadline, and only counts as late after that. Null on
 * older rows: the day is the deadline, as before. On this phone only, like v15.
 */
async function migrateToV16(db: any): Promise<void> {
    await addColumnIfMissing(db, 'tasks', 'deadline', 'TEXT');
    console.log('[Database] Migrated to schema v16');
}

/**
 * Migration to version 15 — a habit's priority, as tasks have.
 *
 * The timeline fills the day with what has no set time, most urgent first;
 * a habit needs a priority for that. Null on older rows: normal. On this
 * phone only for now; the cloud table has no column for it yet, and uploading
 * one it lacks fails the whole batch, so it is not in the sync mapping.
 */
async function migrateToV15(db: any): Promise<void> {
    await addColumnIfMissing(db, 'habits', 'priority', 'INTEGER');
    // How hard each one is (1 easy … 3 hard), so the timeline can put the
    // hardest in your best hours. Also on this phone only.
    await addColumnIfMissing(db, 'habits', 'difficulty', 'INTEGER');
    await addColumnIfMissing(db, 'tasks', 'difficulty', 'INTEGER');
    console.log('[Database] Migrated to schema v15');
}

/**
 * Migration to version 14 — what a task asks for, and where in a plan it sits.
 *
 * "Send the proposal" is done or not; "call 25 leads" is a count and "study two
 * hours" is time. A task needs its target and how far it has got to say which,
 * and a goal made of steps needs to know which step each task belongs to.
 * All null on older rows, which is a done-or-not task in no step: what they were.
 */
async function migrateToV14(db: any): Promise<void> {
    await addColumnIfMissing(db, 'tasks', 'measure', 'TEXT');
    await addColumnIfMissing(db, 'tasks', 'target', 'REAL');
    await addColumnIfMissing(db, 'tasks', 'unit', 'TEXT');
    await addColumnIfMissing(db, 'tasks', 'amount', 'REAL');
    await addColumnIfMissing(db, 'tasks', 'milestone_id', 'TEXT');
    console.log('[Database] Migrated to schema v14');
}

/**
 * Migration to version 13 — how a check-in was evidenced.
 *
 * `lib/evidence.ts` has always worked this out on the fly, which is fine for
 * your own feed card and no use for a friend's: the server cannot see your
 * timer sessions or which of your habits reads Health. Stamping it on the row
 * at the moment it is written is the only time the answer is cheap and certain,
 * and it means a completion carries its own provenance to the server.
 *
 * Null on every row written before this, which reads as self-logged — the
 * honest reading of a tick nobody checked.
 */
async function migrateToV13(db: any): Promise<void> {
    await addColumnIfMissing(db, 'completions', 'evidence', 'TEXT');
    console.log('[Database] Migrated to schema v13');
}

/**
 * Migration to version 12 — how often something comes round.
 *
 * The old fields could say "these weekdays, every N weeks", and monthly or
 * yearly off the start date. They could not say "the third Sunday of every
 * second month", so this carries a rule from lib/recurrence as JSON.
 *
 * It backs up: `recurrence` was added to the cloud `habits` table on
 * 2026-09-27 and is in the sync mapping. The older columns are still written
 * alongside it, so a habit stays readable by a build that knows nothing about
 * this one.
 */
async function migrateToV12(db: any): Promise<void> {
    await addColumnIfMissing(db, 'habits', 'recurrence', 'TEXT');
    console.log('[Database] Migrated to schema v12');
}

/**
 * Migration to version 11 — what a reminder says.
 *
 * Reminders were written by Echo or by the built-in coach lines, which is
 * right most of the time and useless for the habit that needs one specific
 * sentence. It backs up: the cloud `habits` table gained `reminder_message` on
 * 2026-09-27 and it is in the sync mapping.
 */
async function migrateToV11(db: any): Promise<void> {
    await addColumnIfMissing(db, 'habits', 'reminder_message', 'TEXT');
    console.log('[Database] Migrated to schema v11');
}

/** Partial progress stays separate from check-ins so existing streaks count only finished habits. */
async function migrateToV10(db: any): Promise<void> {
    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS habit_measurements (
            user_id TEXT NOT NULL,
            habit_id TEXT NOT NULL,
            date TEXT NOT NULL,
            value REAL NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (user_id, habit_id, date)
        );
    `);
}

/**
 * Migration to version 7 - tasks.
 *
 * Habits repeat; tasks happen once and then they are done. A plan built
 * elsewhere is mostly tasks, so they need a real home rather than being forced
 * into the habit table, where a due date and a one-off completion do not fit.
 *
 * external_id is what makes importing a plan idempotent: re-importing the same
 * plan updates the same rows instead of duplicating them.
 */
async function migrateToV7(db: any): Promise<void> {
    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            title TEXT NOT NULL,
            description TEXT,
            due_date TEXT,
            due_time TEXT,
            estimated_minutes INTEGER,
            priority INTEGER DEFAULT 2,
            status TEXT DEFAULT 'open',
            completed_at TEXT,
            source TEXT DEFAULT 'app',
            external_id TEXT,
            created_at TEXT,
            updated_at TEXT,
            deleted INTEGER DEFAULT 0
        );
    `);
    await db.execAsync('CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks (due_date, status);');
    // One row per imported task, so a re-import updates rather than duplicates.
    await db.execAsync('CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_external ON tasks (external_id) WHERE external_id IS NOT NULL;');

    console.log('[Database] Migrated to schema v7');
}

/**
 * Migration to version 8 - tasks take part in backup.
 *
 * Habits and completions already mark every change as not yet uploaded; tasks
 * did not, so a backup would have had no way to know which ones had changed.
 */
async function migrateToV8(db: any): Promise<void> {
    await addColumnIfMissing(db, 'tasks', 'synced', 'INTEGER DEFAULT 0');
    await db.execAsync('CREATE INDEX IF NOT EXISTS idx_tasks_unsynced ON tasks (synced) WHERE synced = 0;');
    console.log('[Database] Migrated to schema v8');
}

/**
 * A skipped day is a decision, not a failure.
 *
 * Without this, a day the user deliberately stood down was stored as nothing
 * at all, which is the same as forgetting: it broke streaks and counted
 * against them. A skip is now recorded next to the check-in it replaces.
 */
async function migrateToV9(db: any): Promise<void> {
    await addColumnIfMissing(db, 'completions', 'skipped', 'INTEGER DEFAULT 0');
    console.log('[Database] Migrated to schema v9');
}

/**
 * Migration to version 1 - Initial schema
 */
async function migrateToV1(db: any): Promise<void> {
    await db.execAsync(`
        -- Habits table
        CREATE TABLE IF NOT EXISTS habits (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            category TEXT DEFAULT 'misc',
            icon TEXT,
            task_days TEXT DEFAULT '["mon","tue","wed","thu","fri","sat","sun"]',
            reminders TEXT DEFAULT '[]',
            start_date TEXT,
            end_date TEXT,
            duration_minutes INTEGER,
            start_time TEXT,
            end_time TEXT,
            type TEXT DEFAULT 'build',
            color TEXT DEFAULT '#6B46C1',
            goal_period TEXT DEFAULT 'daily',
            goal_value INTEGER DEFAULT 1,
            unit TEXT DEFAULT 'count',
            chart_type TEXT DEFAULT 'bar',
            is_archived INTEGER DEFAULT 0,
            show_memo INTEGER DEFAULT 0,
            frequency TEXT,
            week_interval INTEGER DEFAULT 1,
            time_of_day TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT,
            synced INTEGER DEFAULT 0,
            deleted INTEGER DEFAULT 0
        );

        -- Completions table
        CREATE TABLE IF NOT EXISTS completions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            habit_id TEXT NOT NULL,
            date TEXT NOT NULL,
            value REAL DEFAULT 1,
            memo TEXT,
            created_at TEXT NOT NULL,
            synced INTEGER DEFAULT 0,
            deleted INTEGER DEFAULT 0,
            UNIQUE(habit_id, date)
        );

        -- Sync queue for offline changes
        CREATE TABLE IF NOT EXISTS sync_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            table_name TEXT NOT NULL,
            operation TEXT NOT NULL,
            record_id TEXT NOT NULL,
            payload TEXT,
            created_at TEXT NOT NULL,
            attempts INTEGER DEFAULT 0
        );

        -- Create indexes for common queries
        CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id);
        CREATE INDEX IF NOT EXISTS idx_completions_user ON completions(user_id);
        CREATE INDEX IF NOT EXISTS idx_completions_date ON completions(date);
        CREATE INDEX IF NOT EXISTS idx_completions_habit_date ON completions(habit_id, date);
        CREATE INDEX IF NOT EXISTS idx_sync_queue_table ON sync_queue(table_name);
    `);

    console.log('[Database] Migrated to schema v1');
}

/**
 * Migration to version 2 - Add graph_style, tracking_method, reminder_offset, location_reminders
 */
async function migrateToV2(db: any): Promise<void> {
    await addColumnIfMissing(db, 'habits', 'graph_style', 'TEXT');
    await addColumnIfMissing(db, 'habits', 'tracking_method', "TEXT DEFAULT 'boolean'");
    await addColumnIfMissing(db, 'habits', 'reminder_offset', 'INTEGER');
    await addColumnIfMissing(db, 'habits', 'location_reminders', "TEXT DEFAULT '[]'");

    console.log('[Database] Migrated to schema v2');
}

/**
 * Migration to version 3 - Performance indexes, completions updated_at, sync queue optimization
 */
async function migrateToV3(db: any): Promise<void> {
    // Add updated_at to completions for sync conflict resolution
    await addColumnIfMissing(db, 'completions', 'updated_at', 'TEXT');

    await db.execAsync(`
        -- Composite index: active habits for a user (most common query)
        CREATE INDEX IF NOT EXISTS idx_habits_user_active ON habits(user_id, deleted, is_archived);

        -- Composite index: completions by habit + date + deleted (daily check)
        CREATE INDEX IF NOT EXISTS idx_completions_habit_date_active ON completions(habit_id, date, deleted);

        -- Composite index: unsynced records (push-to-cloud query)
        CREATE INDEX IF NOT EXISTS idx_habits_unsynced ON habits(synced, deleted) WHERE synced = 0;
        CREATE INDEX IF NOT EXISTS idx_completions_unsynced ON completions(synced, deleted) WHERE synced = 0;

        -- Sync queue: pending items ordered by time
        CREATE INDEX IF NOT EXISTS idx_sync_queue_pending ON sync_queue(attempts, created_at) WHERE attempts < 3;
    `);

    console.log('[Database] Migrated to schema v3');
}

/**
 * Migration to version 4 - HealthKit integration
 */
async function migrateToV4(db: any): Promise<void> {
    await addColumnIfMissing(db, 'habits', 'health_kit_metric', 'TEXT');
    await addColumnIfMissing(db, 'habits', 'health_kit_target', 'REAL');

    console.log('[Database] Migrated to schema v4');
}

async function migrateToV5(db: any): Promise<void> {
    await addColumnIfMissing(db, 'habits', 'ringtone', "TEXT DEFAULT 'default'");

    console.log('[Database] Migrated to schema v5');
}

/**
 * Migration to version 6 - structured goals.
 *
 * goal_value and unit alone cannot tell a limit from a volume, or hold the
 * baseline a target_value goal needs. goal_spec stores the parsed goal as JSON
 * so a goal stays calculable.
 */
async function migrateToV6(db: any): Promise<void> {
    await addColumnIfMissing(db, 'habits', 'goal_spec', 'TEXT');

    console.log('[Database] Migrated to schema v6');
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
    // Finish any startup before closing, including callers still in migrations.
    if (openPromise) await openPromise;
    // Drop the shared open too, or the next caller receives the closed handle.
    openPromise = null;
    const connection = dbInstance;
    dbInstance = null;
    if (connection) await connection.closeAsync();
}

/**
 * Generate a UUID for new records
 */
export function generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Get current ISO timestamp
 */
export function nowISO(): string {
    return new Date().toISOString();
}

/**
 * Get today's date string (YYYY-MM-DD)
 */
export function todayString(d = new Date()): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
