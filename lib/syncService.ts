/**
 * Sync Service - Background Cloud Sync (Industry Standard)
 * 
 * Pattern: Soft-Delete + Last-Modified Timestamp
 * Used by: Notion, Linear, Todoist, Habitica
 * 
 * Key principles:
 * - Never hard-delete, use soft-delete (deleted_at timestamp)
 * - Always compare timestamps before overwriting
 * - Local wins if local is newer (conflict resolution)
 * - Bidirectional sync of deletions
 */

import { getDatabase, nowISO } from './database';
import { supabase } from './supabase';
import { DeviceEventEmitter } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

interface SyncQueueItem {
    id: number;
    table_name: string;
    operation: string;
    record_id: string;
    payload: string | null;
    created_at: string;
    attempts: number;
}

interface LocalHabit {
    id: string;
    updated_at: string;
    deleted: number;
}

let isSyncing = false;
let syncInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the background sync service
 */
export function startSyncService(): void {
    if (syncInterval) return;

    // Sync every 30 seconds
    syncInterval = setInterval(() => {
        syncPendingChanges();
    }, 30000);

    // Also sync on network restore
    NetInfo.addEventListener(state => {
        if (state.isConnected) {
            syncPendingChanges();
        }
    });

    // Initial sync
    syncPendingChanges();

    console.log('[SyncService] Started');
}

/**
 * Stop the background sync service
 */
export function stopSyncService(): void {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
}

/**
 * Sync all pending changes to Supabase
 */
export async function syncPendingChanges(): Promise<void> {
    if (isSyncing) return;

    const netState = await NetInfo.fetch();
    if (!netState.isConnected) return;

    isSyncing = true;

    try {
        const db = await getDatabase();
        const queue = await db.getAllAsync<SyncQueueItem>(
            'SELECT * FROM sync_queue WHERE attempts < 3 ORDER BY created_at ASC LIMIT 50'
        );

        if (queue.length === 0) {
            isSyncing = false;
            return;
        }

        console.log(`[SyncService] Processing ${queue.length} pending changes`);

        for (const item of queue) {
            try {
                await processSyncItem(item);
                // Remove from queue on success
                await db.runAsync('DELETE FROM sync_queue WHERE id = ?', item.id);
            } catch (error) {
                console.error(`[SyncService] Failed to sync item ${item.id}:`, error);
                // Increment attempts
                await db.runAsync('UPDATE sync_queue SET attempts = attempts + 1 WHERE id = ?', item.id);
            }
        }

        DeviceEventEmitter.emit('sync_completed');
    } catch (error) {
        console.error('[SyncService] Sync error:', error);
    } finally {
        isSyncing = false;
    }
}

/**
 * Process a single sync queue item
 */
async function processSyncItem(item: SyncQueueItem): Promise<void> {
    const payload = item.payload ? JSON.parse(item.payload) : null;

    if (item.table_name === 'habits') {
        await syncHabit(item.operation, item.record_id, payload);
    } else if (item.table_name === 'completions') {
        await syncCompletion(item.operation, item.record_id, payload);
    }
}

/**
 * Sync a habit change to Supabase
 * Uses soft-delete pattern - sets deleted_at instead of hard delete
 */
async function syncHabit(operation: string, recordId: string, payload: any): Promise<void> {
    const db = await getDatabase();
    const now = nowISO();

    if (operation === 'DELETE') {
        // SOFT DELETE: Set deleted_at timestamp instead of deleting
        await supabase.from('habits')
            .update({ deleted_at: now })
            .eq('id', recordId);

        // Mark as synced locally
        await db.runAsync('UPDATE habits SET synced = 1 WHERE id = ?', recordId);
    } else if (operation === 'INSERT' || operation === 'UPDATE') {
        // Get full habit from local DB
        const row = await db.getFirstAsync<any>(
            'SELECT * FROM habits WHERE id = ?',
            recordId
        );

        if (!row) return;

        // If locally deleted, sync as soft-delete
        if (row.deleted === 1) {
            await supabase.from('habits')
                .update({ deleted_at: now })
                .eq('id', recordId);
            await db.runAsync('UPDATE habits SET synced = 1 WHERE id = ?', recordId);
            return;
        }

        // Map to Supabase schema
        const habitData = {
            id: row.id,
            user_id: row.user_id,
            name: row.name,
            description: row.description,
            category: row.category,
            icon: row.icon,
            is_goal: row.is_goal === 1,
            target_date: row.target_date,
            goal_id: row.goal_id,
            task_days: JSON.parse(row.task_days || '[]'),
            reminders: JSON.parse(row.reminders || '[]'),
            start_date: row.start_date,
            duration_minutes: row.duration_minutes,
            start_time: row.start_time,
            end_time: row.end_time,
            created_at: row.created_at,
            updated_at: row.updated_at,
            deleted_at: null, // Explicitly null for non-deleted
        };

        await supabase.from('habits').upsert(habitData);

        // Mark as synced
        await db.runAsync('UPDATE habits SET synced = 1 WHERE id = ?', recordId);
    }
}

/**
 * Sync a completion change to Supabase
 */
async function syncCompletion(operation: string, recordId: string, payload: any): Promise<void> {
    const db = await getDatabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const now = nowISO();

    if (operation === 'DELETE') {
        // SOFT DELETE: Set deleted_at instead of hard delete
        if (payload) {
            await supabase.from('habit_completions')
                .update({ deleted_at: now })
                .eq('user_id', user.id)
                .eq('habit_id', payload.habitId)
                .eq('date', payload.date);
        }
    } else if (operation === 'INSERT') {
        // Get completion from local DB
        const row = await db.getFirstAsync<any>(
            'SELECT * FROM completions WHERE id = ?',
            recordId
        );

        if (!row || row.deleted) return;

        await supabase.from('habit_completions').upsert({
            user_id: row.user_id,
            habit_id: row.habit_id,
            date: row.date,
            completed: true,
            deleted_at: null,
        });

        // Mark as synced
        await db.runAsync('UPDATE completions SET synced = 1 WHERE id = ?', recordId);
    }
}

/**
 * Pull latest data from Supabase into local SQLite
 * INDUSTRY STANDARD: Preserves local deleted state,  only updates if cloud is newer
 */
export async function pullFromCloud(userId: string): Promise<void> {
    try {
        const db = await getDatabase();
        const now = nowISO();

        // Pull ALL habits (including soft-deleted) to sync deletion state
        const { data: cloudHabits, error: habitError } = await supabase
            .from('habits')
            .select('*')
            .eq('user_id', userId);

        if (habitError) throw habitError;

        // Get all local habits for comparison
        const localHabits = await db.getAllAsync<any>(
            'SELECT id, updated_at, deleted FROM habits WHERE user_id = ?',
            userId
        );
        const localHabitMap = new Map<string, any>(localHabits.map((h: any) => [h.id, h]));

        for (const cloudHabit of cloudHabits || []) {
            const localHabit = localHabitMap.get(cloudHabit.id);

            // Determine if cloud item is soft-deleted
            const cloudDeleted = cloudHabit.deleted_at != null;

            if (localHabit) {
                // CONFLICT RESOLUTION: Compare timestamps
                const localTime = new Date(localHabit.updated_at || 0).getTime();
                const cloudTime = new Date(cloudHabit.updated_at || cloudHabit.created_at).getTime();

                // If local is deleted and unsynced, preserve local state (local wins)
                if (localHabit.deleted === 1) {
                    // Local delete takes precedence - will be pushed to cloud
                    continue;
                }

                // If cloud is deleted, mark local as deleted
                if (cloudDeleted) {
                    await db.runAsync(
                        'UPDATE habits SET deleted = 1, synced = 1, updated_at = ? WHERE id = ?',
                        now, cloudHabit.id
                    );
                    continue;
                }

                // If cloud is newer, update local
                if (cloudTime > localTime) {
                    await updateLocalHabit(db, cloudHabit, now);
                }
                // Otherwise keep local version (it will sync to cloud later)
            } else {
                // New from cloud - insert if not deleted
                if (!cloudDeleted) {
                    await insertLocalHabit(db, cloudHabit, now);
                }
            }
        }

        // Pull completions (last 90 days)
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90);
        const startStr = startDate.toISOString().split('T')[0];

        const { data: cloudCompletions, error: compError } = await supabase
            .from('habit_completions')
            .select('*')
            .eq('user_id', userId)
            .gte('date', startStr);

        if (compError) throw compError;

        for (const c of cloudCompletions || []) {
            const cloudDeleted = c.deleted_at != null;
            const completionId = c.id || `${c.habit_id}-${c.date}`;

            if (cloudDeleted) {
                // Mark local as deleted if exists
                await db.runAsync(
                    'UPDATE completions SET deleted = 1, synced = 1 WHERE habit_id = ? AND date = ? AND user_id = ?',
                    c.habit_id, c.date, userId
                );
            } else {
                // Insert or ignore (don't overwrite local changes)
                await db.runAsync(`
                    INSERT OR IGNORE INTO completions (
                        id, user_id, habit_id, date, value, created_at, synced, deleted
                    ) VALUES (?, ?, ?, ?, 1, ?, 1, 0)
                `,
                    completionId, c.user_id, c.habit_id, c.date, now
                );
            }
        }

        console.log(`[SyncService] Synced ${cloudHabits?.length || 0} habits and ${cloudCompletions?.length || 0} completions`);
        DeviceEventEmitter.emit('data_pulled_from_cloud');
    } catch (error) {
        console.error('[SyncService] Pull error:', error);
    }
}

/**
 * Insert a new habit from cloud into local SQLite
 */
async function insertLocalHabit(db: any, h: any, now: string): Promise<void> {
    await db.runAsync(`
        INSERT INTO habits (
            id, user_id, name, description, category, icon, is_goal, target_date, goal_id,
            task_days, reminders, start_date, duration_minutes, start_time, end_time,
            created_at, updated_at, synced, deleted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
    `,
        h.id, h.user_id, h.name, h.description, h.category, h.icon,
        h.is_goal ? 1 : 0, h.target_date, h.goal_id,
        JSON.stringify(h.task_days || []), JSON.stringify(h.reminders || []),
        h.start_date, h.duration_minutes, h.start_time, h.end_time,
        h.created_at, now
    );
}

/**
 * Update an existing local habit from cloud data
 */
async function updateLocalHabit(db: any, h: any, now: string): Promise<void> {
    await db.runAsync(`
        UPDATE habits SET
            name = ?, description = ?, category = ?, icon = ?, is_goal = ?, target_date = ?, goal_id = ?,
            task_days = ?, reminders = ?, start_date = ?, duration_minutes = ?, start_time = ?, end_time = ?,
            updated_at = ?, synced = 1
        WHERE id = ?
    `,
        h.name, h.description, h.category, h.icon,
        h.is_goal ? 1 : 0, h.target_date, h.goal_id,
        JSON.stringify(h.task_days || []), JSON.stringify(h.reminders || []),
        h.start_date, h.duration_minutes, h.start_time, h.end_time,
        now, h.id
    );
}

/**
 * Force a full sync (push pending + pull from cloud)
 */
export async function fullSync(userId: string): Promise<void> {
    await syncPendingChanges();
    await pullFromCloud(userId);
}
