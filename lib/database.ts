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
const SCHEMA_VERSION = 3;

let dbInstance: any = null;

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

    try {
        dbInstance = await SQLite.openDatabaseAsync(DATABASE_NAME);

        // Enable WAL mode for better concurrent read/write performance
        await dbInstance.execAsync('PRAGMA journal_mode = WAL;');
        // NORMAL sync is safe with WAL and significantly faster than FULL
        await dbInstance.execAsync('PRAGMA synchronous = NORMAL;');
        // 8MB cache for faster reads on repeated queries
        await dbInstance.execAsync('PRAGMA cache_size = -8000;');
        // Store temp tables in memory for faster joins/sorts
        await dbInstance.execAsync('PRAGMA temp_store = MEMORY;');

        // Run migrations
        await runMigrations(dbInstance);

        return dbInstance;
    } catch (error) {
        console.error('[Database] Failed to open database:', error);
        sqliteAvailable = false;
        return null;
    }
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

    if (currentVersion < 1) {
        await migrateToV1(db);
    }
    if (currentVersion < 2) {
        await migrateToV2(db);
    }
    if (currentVersion < 3) {
        await migrateToV3(db);
    }

    // Update schema version
    if (currentVersion !== SCHEMA_VERSION) {
        await db.runAsync('DELETE FROM schema_version');
        await db.runAsync('INSERT INTO schema_version (version) VALUES (?)', SCHEMA_VERSION);
    }
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
    await db.execAsync(`
        ALTER TABLE habits ADD COLUMN graph_style TEXT;
        ALTER TABLE habits ADD COLUMN tracking_method TEXT DEFAULT 'boolean';
        ALTER TABLE habits ADD COLUMN reminder_offset INTEGER;
        ALTER TABLE habits ADD COLUMN location_reminders TEXT DEFAULT '[]';
    `);

    console.log('[Database] Migrated to schema v2');
}

/**
 * Migration to version 3 - Performance indexes, completions updated_at, sync queue optimization
 */
async function migrateToV3(db: any): Promise<void> {
    await db.execAsync(`
        -- Add updated_at to completions for sync conflict resolution
        ALTER TABLE completions ADD COLUMN updated_at TEXT;

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
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
    if (dbInstance) {
        await dbInstance.closeAsync();
        dbInstance = null;
    }
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
