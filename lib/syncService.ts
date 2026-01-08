/**
 * Sync Service - Background Cloud Sync
 * Syncs local SQLite data with Supabase when online
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
 */
async function syncHabit(operation: string, recordId: string, payload: any): Promise<void> {
    const db = await getDatabase();

    if (operation === 'DELETE') {
        await supabase.from('habits').delete().eq('id', recordId);
    } else if (operation === 'INSERT' || operation === 'UPDATE') {
        // Get full habit from local DB
        const row = await db.getFirstAsync<any>(
            'SELECT * FROM habits WHERE id = ?',
            recordId
        );

        if (!row) return;

        // Map to Supabase schema
        const habitData = {
            id: row.id,
            user_id: row.user_id,
            name: row.name,
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
        };

        if (operation === 'INSERT') {
            await supabase.from('habits').insert(habitData);
        } else {
            await supabase.from('habits').upsert(habitData);
        }

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

    if (operation === 'DELETE') {
        // For completions, we delete by habit_id and date
        if (payload) {
            await supabase.from('habit_completions')
                .delete()
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
        });

        // Mark as synced
        await db.runAsync('UPDATE completions SET synced = 1 WHERE id = ?', recordId);
    }
}

/**
 * Pull latest data from Supabase into local SQLite
 */
export async function pullFromCloud(userId: string): Promise<void> {
    try {
        const db = await getDatabase();
        const now = nowISO();

        // Pull habits
        const { data: habits, error: habitError } = await supabase
            .from('habits')
            .select('*')
            .eq('user_id', userId);

        if (habitError) throw habitError;

        for (const h of habits || []) {
            await db.runAsync(`
                INSERT OR REPLACE INTO habits (
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

        // Pull completions (last 90 days)
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90);
        const startStr = startDate.toISOString().split('T')[0];

        const { data: completions, error: compError } = await supabase
            .from('habit_completions')
            .select('*')
            .eq('user_id', userId)
            .gte('date', startStr);

        if (compError) throw compError;

        for (const c of completions || []) {
            await db.runAsync(`
                INSERT OR IGNORE INTO completions (
                    id, user_id, habit_id, date, value, created_at, synced, deleted
                ) VALUES (?, ?, ?, ?, 1, ?, 1, 0)
            `,
                c.id || `${c.habit_id}-${c.date}`, c.user_id, c.habit_id, c.date, now
            );
        }

        console.log(`[SyncService] Pulled ${habits?.length || 0} habits and ${completions?.length || 0} completions from cloud`);
        DeviceEventEmitter.emit('data_pulled_from_cloud');
    } catch (error) {
        console.error('[SyncService] Pull error:', error);
    }
}

/**
 * Force a full sync (push pending + pull from cloud)
 */
export async function fullSync(userId: string): Promise<void> {
    await syncPendingChanges();
    await pullFromCloud(userId);
}
