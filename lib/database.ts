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
const SCHEMA_VERSION = 15;

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
 * Migration to version 15 — a habit's priority, as tasks have.
 *
 * The timeline fills the day with what has no set time, most urgent first;
 * a habit needs a priority for that. Null on older rows: normal. On this
 * phone only for now; the cloud table has no column for it yet, and uploading
 * one it lacks fails the whole batch, so it is not in the sync mapping.
 */
async function migrateToV15(db: any): Promise<void> {
    await addColumnIfMissing(db, 'habits', 'priority', 'INTEGER');
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
            goal_id TEXT,
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
            is_goal INTEGER DEFAULT 0,
            target_date TEXT,
            goal_id TEXT,
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
        CREATE INDEX IF NOT EXISTS idx_habits_goal ON habits(goal_id);
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
