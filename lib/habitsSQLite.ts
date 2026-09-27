/**
 * SQLite-Only Habits Module
 * All data operations go through SQLite. No cloud sync.
 * Cloud sync will be re-enabled with premium subscription.
 */

import { getDatabase, generateId, isSQLiteAvailable } from './database';
import { HealthKitService } from './HealthKitService';
import { Platform } from 'react-native';
import { getLocalUserId } from './localUser';
import { NotificationService } from './notificationService';
import { isHabitScheduledForDate, localDateKey, parseHabitDate } from './habitSchedule';
import type { Task } from './tasks';
import { addDays, daysBetween, goalProgress } from './goalInsights';
import { measurementFor } from './habitMeasurement';
import { emit } from './appEvents';
export { isHabitScheduledForDate } from './habitSchedule';

// Re-export types
export type HabitCategory = 'body' | 'wealth' | 'heart' | 'mind' | 'soul' | 'play' | 'health' | 'fitness' | 'work' | 'personal' | 'mindfulness' | 'misc' | 'productivity' | 'learning' | 'creativity' | 'social' | 'family' | 'finance';
export type HabitType = 'build' | 'quit';
export type GoalPeriod = 'daily' | 'weekly' | 'monthly';
export type ChartType = 'bar' | 'line';
export type HabitFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'free_time';
export type TrackingMethod = 'boolean' | 'numeric';

export interface Habit {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    category: HabitCategory;
    createdAt: string;
    durationMinutes?: number;
    startTime?: string;
    endTime?: string;
    isGoal?: boolean;
    targetDate?: string;
    type: HabitType;
    color: string;
    goalPeriod: GoalPeriod;
    goalValue: number;
    unit: string;
    taskDays: string[];
    reminders: string[];
    chartType: ChartType;
    startDate: string;
    endDate?: string;
    isArchived: boolean;
    showMemo: boolean;
    goalId?: string;
    frequency?: HabitFrequency;
    weekInterval?: number;
    graphStyle?: string;
    timeOfDay?: TimeOfDay;
    trackingMethod?: TrackingMethod;
    ringtone?: string;
    /** Parsed goal contract as JSON; set on goals created from natural language. */
    goalSpec?: string;
    locationReminders?: { name: string; latitude: number; longitude: number; radius?: number }[];
    reminderOffset?: number; // Minutes before start time
    /** One specific sentence for this habit's reminder; Echo writes it when unset. */
    reminderMessage?: string;
    /** A lib/recurrence rule as JSON, when the schedule needs more than weekdays. */
    recurrence?: string;
    healthKitMetric?: 'steps' | 'sleep' | 'mindfulness' | 'workout'; // New
    healthKitTarget?: number; // New
}

// Cache
let cachedHabits: Habit[] | null = null;
const habitsListeners: Set<(habits: Habit[]) => void> = new Set();
const completionsCache: Record<string, Record<string, boolean>> = {};

// --- Helpers ---

export async function getUserId(): Promise<string | undefined> {
    return await getLocalUserId();
}

const todayString = (d = new Date()) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// --- Subscription ---

export async function subscribeToHabits(callback: (habits: Habit[]) => void): Promise<() => void> {
    if (cachedHabits) {
        callback(cachedHabits);
    } else {
        getHabits().then(callback);
    }
    habitsListeners.add(callback);
    return () => { habitsListeners.delete(callback); };
}

export function clearHabitsCache() {
    cachedHabits = null;
    clearProgressCache();
    habitsListeners.clear();
}

function clearProgressCache() {
    for (const day of Object.keys(completionsCache)) delete completionsCache[day];
    for (const day of Object.keys(skippedCache)) delete skippedCache[day];
}

/**
 * Re-reads habits from storage and tells every screen already subscribed.
 *
 * For when rows change underneath the app, such as a restore from backup.
 * clearHabitsCache would also drop the subscribers, silently disconnecting
 * every open screen, so this keeps them.
 */
export async function reloadHabitsFromStorage(): Promise<void> {
    cachedHabits = null;
    clearProgressCache();
    const habits = await getHabits();
    habitsListeners.forEach(listener => listener(habits));
}

// --- CRUD Operations (SQLite-first when available, Supabase fallback) ---

function storedArray(value: unknown, fallback: any[] = []): any[] {
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return Array.isArray(parsed) ? parsed : fallback;
    } catch { return fallback; }
}

export async function getHabits(): Promise<Habit[]> {
    const uid = await getUserId();
    if (!uid) return cachedHabits || [];

    // Try SQLite first (offline-capable)
    if (isSQLiteAvailable()) {
        try {
            const db = await getDatabase();
            if (db) {
                const rows = await db.getAllAsync(
                    'SELECT * FROM habits WHERE user_id = ? AND deleted = 0 ORDER BY created_at DESC',
                    uid
                );

                const habits: Habit[] = rows.map((row: any) => ({
                    id: row.id,
                    name: row.name,
                    description: row.description,
                    category: row.category as HabitCategory,
                    icon: row.icon,
                    createdAt: row.created_at,
                    durationMinutes: row.duration_minutes,
                    startTime: row.start_time,
                    endTime: row.end_time,
                    isGoal: row.is_goal === 1,
                    targetDate: row.target_date,
                    type: row.type || 'build',
                    color: row.color || '#6B46C1',
                    goalPeriod: row.goal_period || 'daily',
                    goalValue: row.goal_value || 1,
                    unit: row.unit || 'count',
                    taskDays: storedArray(row.task_days).filter(day => typeof day === 'string'),
                    reminders: storedArray(row.reminders).filter(time => typeof time === 'string'),
                    chartType: row.chart_type || 'bar',
                    startDate: row.start_date || row.created_at,
                    endDate: row.end_date,
                    isArchived: row.is_archived === 1,
                    showMemo: row.show_memo === 1,
                    goalId: row.goal_id,
                    frequency: row.frequency,
                    weekInterval: row.week_interval,
                    timeOfDay: row.time_of_day,
                    ringtone: row.ringtone || 'default',
                    goalSpec: row.goal_spec || undefined,
                    reminderOffset: row.reminder_offset,
                    locationReminders: storedArray(row.location_reminders).filter(location => location && typeof location.name === 'string' && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)),
                    reminderMessage: row.reminder_message || undefined,
                    recurrence: row.recurrence || undefined,
                    graphStyle: row.graph_style,
                    trackingMethod: row.tracking_method,
                    healthKitMetric: row.health_kit_metric,
                    healthKitTarget: row.health_kit_target,
                }));

                cachedHabits = habits;
                return habits;
            }
        } catch (e) {
            console.error('[Habits] SQLite read failed:', e);
        }
    }

    // SQLite is the only data source in local-only mode
    return cachedHabits || [];
}

export async function getGoals(): Promise<Habit[]> {
    const habits = await getHabits();
    return habits.filter(h => h.isGoal);
}

export async function addHabit(habitData: Partial<Habit>): Promise<Habit | null> {
    const uid = await getUserId();
    if (!uid) return null;

    const now = new Date().toISOString();

    // Try SQLite first (offline-capable)
    if (isSQLiteAvailable()) {
        try {
            const db = await getDatabase();
            if (db) {
                const id = generateId();

                await db.runAsync(`
                    INSERT INTO habits (
                        id, user_id, name, description, category, icon, is_goal, target_date, goal_id,
                        task_days, reminders, start_date, end_date, duration_minutes, start_time, end_time,
                        type, color, goal_period, goal_value, unit, chart_type, is_archived, show_memo,
                        frequency, week_interval, time_of_day, graph_style, tracking_method,
                        ringtone, goal_spec, reminder_offset, reminder_message, recurrence, location_reminders, health_kit_metric, health_kit_target, created_at, updated_at, synced, deleted
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
                `,
                    id,
                    uid,
                    habitData.name || 'New Habit',
                    habitData.description || null,
                    habitData.category || 'misc',
                    habitData.icon || null,
                    habitData.isGoal ? 1 : 0,
                    habitData.targetDate || null,
                    habitData.goalId || null,
                    JSON.stringify(habitData.taskDays || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
                    JSON.stringify(habitData.reminders || []),
                    habitData.startDate || now.split('T')[0],
                    habitData.endDate || null,
                    habitData.durationMinutes || null,
                    habitData.startTime || null,
                    habitData.endTime || null,
                    habitData.type || 'build',
                    habitData.color || '#6B46C1',
                    habitData.goalPeriod || 'daily',
                    habitData.goalValue || 1,
                    habitData.unit || 'count',
                    habitData.chartType || 'bar',
                    habitData.isArchived ? 1 : 0,
                    habitData.showMemo ? 1 : 0,
                    habitData.frequency || null,
                    habitData.weekInterval || 1,
                    habitData.timeOfDay || null,
                    habitData.graphStyle || null,
                    habitData.trackingMethod || 'boolean',
                    habitData.ringtone || 'default',
                    habitData.goalSpec || null,
                    habitData.reminderOffset || null,
                    habitData.reminderMessage?.trim() || null,
                    habitData.recurrence || null,
                    JSON.stringify(habitData.locationReminders || []),
                    habitData.healthKitMetric || null,
                    habitData.healthKitTarget || null,
                    now,
                    now
                );


                const created: Habit = {
                    id,
                    name: habitData.name || 'New Habit',
                    description: habitData.description,
                    category: (habitData.category || 'misc') as HabitCategory,
                    icon: habitData.icon,
                    createdAt: now,
                    durationMinutes: habitData.durationMinutes,
                    startTime: habitData.startTime,
                    endTime: habitData.endTime,
                    isGoal: habitData.isGoal,
                    targetDate: habitData.targetDate,
                    type: habitData.type || 'build',
                    color: habitData.color || '#6B46C1',
                    goalPeriod: habitData.goalPeriod || 'daily',
                    goalValue: habitData.goalValue || 1,
                    unit: habitData.unit || 'count',
                    taskDays: habitData.taskDays || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
                    reminders: habitData.reminders || [],
                    chartType: habitData.chartType || 'bar',
                    startDate: habitData.startDate || now.split('T')[0],
                    endDate: habitData.endDate,
                    isArchived: habitData.isArchived || false,
                    showMemo: habitData.showMemo || false,
                    goalId: habitData.goalId,
                    frequency: habitData.frequency,
                    weekInterval: habitData.weekInterval,
                    timeOfDay: habitData.timeOfDay,
                    ringtone: habitData.ringtone || 'default',
                    goalSpec: habitData.goalSpec,
                    reminderOffset: habitData.reminderOffset,
                    locationReminders: habitData.locationReminders || [],
                    graphStyle: habitData.graphStyle,
                    trackingMethod: habitData.trackingMethod,
                    healthKitMetric: habitData.healthKitMetric,
                    healthKitTarget: habitData.healthKitTarget,
                };

                if ((created.reminders && created.reminders.length > 0) || (created.locationReminders && created.locationReminders.length > 0)) {
                    void NotificationService.scheduleHabitReminder(created).catch(error => console.warn('[Habits] Reminder scheduling failed:', error));
                }

                if (cachedHabits) {
                    cachedHabits = [created, ...cachedHabits];
                    habitsListeners.forEach(l => l(cachedHabits!));
                }

                emit('habit_created', { habit: created });

                return created;
            }
        } catch (e) {
            console.error('[Habits] SQLite insert failed:', e);
        }
    }

    // SQLite is the only data source
    console.error('[Habits] Cannot add habit: SQLite unavailable');
    return null;
}

export async function updateHabit(updatedHabit: Partial<Habit> & { id: string }): Promise<void> {
    const uid = await getUserId();
    if (!uid) throw new Error('Your local profile is unavailable. Please reopen Habyss.');

    const now = new Date().toISOString();

    // Try SQLite first (offline-capable)
    if (isSQLiteAvailable()) {
        try {
            const db = await getDatabase();
            if (db) {
                const setClauses: string[] = ['updated_at = ?', 'synced = 0'];
                const params: any[] = [now];

                if (updatedHabit.name !== undefined) { setClauses.push('name = ?'); params.push(updatedHabit.name); }
                if (updatedHabit.description !== undefined) { setClauses.push('description = ?'); params.push(updatedHabit.description); }
                if (updatedHabit.category !== undefined) { setClauses.push('category = ?'); params.push(updatedHabit.category); }
                if (updatedHabit.icon !== undefined) { setClauses.push('icon = ?'); params.push(updatedHabit.icon); }
                if (updatedHabit.isGoal !== undefined) { setClauses.push('is_goal = ?'); params.push(updatedHabit.isGoal ? 1 : 0); }
                if (updatedHabit.targetDate !== undefined) { setClauses.push('target_date = ?'); params.push(updatedHabit.targetDate); }
                if (Object.prototype.hasOwnProperty.call(updatedHabit, 'goalId')) { setClauses.push('goal_id = ?'); params.push(updatedHabit.goalId ?? null); }
                if (updatedHabit.taskDays !== undefined) { setClauses.push('task_days = ?'); params.push(JSON.stringify(updatedHabit.taskDays)); }
                if (updatedHabit.reminders !== undefined) { setClauses.push('reminders = ?'); params.push(JSON.stringify(updatedHabit.reminders)); }
                if (updatedHabit.isArchived !== undefined) { setClauses.push('is_archived = ?'); params.push(updatedHabit.isArchived ? 1 : 0); }
                if (Object.prototype.hasOwnProperty.call(updatedHabit, 'durationMinutes')) { setClauses.push('duration_minutes = ?'); params.push(updatedHabit.durationMinutes ?? null); }
                if (Object.prototype.hasOwnProperty.call(updatedHabit, 'startTime')) { setClauses.push('start_time = ?'); params.push(updatedHabit.startTime ?? null); }
                if (Object.prototype.hasOwnProperty.call(updatedHabit, 'endTime')) { setClauses.push('end_time = ?'); params.push(updatedHabit.endTime ?? null); }
                if (updatedHabit.type !== undefined) { setClauses.push('type = ?'); params.push(updatedHabit.type); }
                if (updatedHabit.color !== undefined) { setClauses.push('color = ?'); params.push(updatedHabit.color); }
                if (updatedHabit.goalPeriod !== undefined) { setClauses.push('goal_period = ?'); params.push(updatedHabit.goalPeriod); }
                if (updatedHabit.goalValue !== undefined) { setClauses.push('goal_value = ?'); params.push(updatedHabit.goalValue); }
                if (updatedHabit.unit !== undefined) { setClauses.push('unit = ?'); params.push(updatedHabit.unit); }
                if (updatedHabit.chartType !== undefined) { setClauses.push('chart_type = ?'); params.push(updatedHabit.chartType); }
                if (updatedHabit.showMemo !== undefined) { setClauses.push('show_memo = ?'); params.push(updatedHabit.showMemo ? 1 : 0); }
                if (updatedHabit.frequency !== undefined) { setClauses.push('frequency = ?'); params.push(updatedHabit.frequency); }
                if (Object.prototype.hasOwnProperty.call(updatedHabit, 'weekInterval')) { setClauses.push('week_interval = ?'); params.push(updatedHabit.weekInterval ?? null); }
                if (updatedHabit.timeOfDay !== undefined) { setClauses.push('time_of_day = ?'); params.push(updatedHabit.timeOfDay); }
                if (updatedHabit.startDate !== undefined) { setClauses.push('start_date = ?'); params.push(updatedHabit.startDate); }
                if (Object.prototype.hasOwnProperty.call(updatedHabit, 'endDate')) { setClauses.push('end_date = ?'); params.push(updatedHabit.endDate ?? null); }
                if (updatedHabit.graphStyle !== undefined) { setClauses.push('graph_style = ?'); params.push(updatedHabit.graphStyle); }
                if (updatedHabit.trackingMethod !== undefined) { setClauses.push('tracking_method = ?'); params.push(updatedHabit.trackingMethod); }
                if (updatedHabit.ringtone !== undefined) { setClauses.push('ringtone = ?'); params.push(updatedHabit.ringtone); }
                if (updatedHabit.goalSpec !== undefined) { setClauses.push('goal_spec = ?'); params.push(updatedHabit.goalSpec); }
                if (Object.prototype.hasOwnProperty.call(updatedHabit, 'reminderOffset')) { setClauses.push('reminder_offset = ?'); params.push(updatedHabit.reminderOffset ?? null); }
                if (updatedHabit.locationReminders !== undefined) { setClauses.push('location_reminders = ?'); params.push(JSON.stringify(updatedHabit.locationReminders)); }
                if (updatedHabit.reminderMessage !== undefined) { setClauses.push('reminder_message = ?'); params.push(updatedHabit.reminderMessage?.trim() || null); }
                if (updatedHabit.recurrence !== undefined) { setClauses.push('recurrence = ?'); params.push(updatedHabit.recurrence || null); }
                if (Object.prototype.hasOwnProperty.call(updatedHabit, 'healthKitMetric')) { setClauses.push('health_kit_metric = ?'); params.push(updatedHabit.healthKitMetric ?? null); }
                if (Object.prototype.hasOwnProperty.call(updatedHabit, 'healthKitTarget')) { setClauses.push('health_kit_target = ?'); params.push(updatedHabit.healthKitTarget ?? null); }

                params.push(updatedHabit.id, uid);

                const result = await db.runAsync(
                    `UPDATE habits SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`,
                    ...params
                );


                if (result.changes === 0) throw new Error('This habit no longer exists.');

                // Update cache
                if (cachedHabits) {
                    cachedHabits = cachedHabits.map(h => h.id === updatedHabit.id ? { ...h, ...updatedHabit } as Habit : h);
                    habitsListeners.forEach(l => l(cachedHabits!));
                }

                void NotificationService.refreshHabitReminders().catch(error => console.warn('[Habits] Reminder update failed:', error));

                emit('habit_updated', { habitId: updatedHabit.id });

                return;
            }
        } catch (e) {
            console.error('[Habits] SQLite update failed:', e);
            throw e;
        }
    }
    throw new Error('Habit storage is unavailable. Your changes were not saved.');
}

export async function removeHabitEverywhere(habitId: string): Promise<void> {
    const uid = await getUserId();
    const now = new Date().toISOString();

    // Try SQLite first (offline-capable)
    if (isSQLiteAvailable()) {
        try {
            const db = await getDatabase();
            if (db) {
                // Soft delete in SQLite
                await db.runAsync(
                    'UPDATE habits SET deleted = 1, synced = 0, updated_at = ? WHERE id = ?',
                    now, habitId
                );


                await NotificationService.cancelHabitReminder(habitId);

                if (cachedHabits) {
                    cachedHabits = cachedHabits.filter(h => h.id !== habitId);
                    habitsListeners.forEach(l => l(cachedHabits!));
                }

                emit('habit_deleted', { habitId });

                return;
            }
        } catch (e) {
            console.error('[Habits] SQLite delete failed:', e);
        }
    }
}

export async function removeGoalWithLinkedHabits(goalId: string): Promise<void> {
    const habits = cachedHabits || await getHabits();
    const linkedHabits = habits.filter(h => h.goalId === goalId);

    const { deleteTasksForGoal } = await import('./tasks');

    // Delete all linked habits, tasks and the goal in parallel
    await Promise.all([
        ...linkedHabits.map(habit => removeHabitEverywhere(habit.id)),
        removeHabitEverywhere(goalId),
        deleteTasksForGoal(goalId),
    ]);

    emit('goal_deleted', { goalId });
    emit('tasks_changed');
}

// --- Completions ---

export async function getCompletions(dateISO?: string): Promise<Record<string, boolean>> {
    const uid = await getUserId();
    if (!uid) return {};

    const dateStr = dateISO ?? todayString();

    // Check cache first
    if (completionsCache[dateStr]) {
        return completionsCache[dateStr];
    }

    // Try SQLite first (offline-capable)
    if (isSQLiteAvailable()) {
        try {
            const db = await getDatabase();
            if (db) {
                // A skipped habit is recorded, but it is not a check-in.
                const rows = await db.getAllAsync(
                    'SELECT habit_id FROM completions WHERE user_id = ? AND date = ? AND deleted = 0 AND COALESCE(skipped, 0) = 0',
                    uid, dateStr
                );

                const result: Record<string, boolean> = {};
                rows.forEach((row: any) => { result[row.habit_id] = true; });
                completionsCache[dateStr] = result;
                return result;
            }
        } catch (e) {
            console.error('[Habits] SQLite completions read failed:', e);
        }
    }

    return completionsCache[dateStr] || {};
}

/** Habits skipped on a day, by id. A skip is neither done nor missed. */
const skippedCache: Record<string, Record<string, boolean>> = {};

export async function getSkipped(dateISO?: string): Promise<Record<string, boolean>> {
    const uid = await getUserId();
    if (!uid) return {};
    const dateStr = dateISO ?? todayString();
    if (skippedCache[dateStr]) return skippedCache[dateStr];
    if (!isSQLiteAvailable()) return {};

    try {
        const db = await getDatabase();
        if (!db) return {};
        const rows = await db.getAllAsync(
            'SELECT habit_id FROM completions WHERE user_id = ? AND date = ? AND deleted = 0 AND COALESCE(skipped, 0) = 1',
            uid, dateStr,
        );
        const result: Record<string, boolean> = {};
        rows.forEach((row: any) => { result[row.habit_id] = true; });
        skippedCache[dateStr] = result;
        return result;
    } catch (e) {
        console.error('[Habits] SQLite skip read failed:', e);
        return {};
    }
}

/**
 * Skips a habit for a day, or takes the skip back.
 *
 * A skip says "not today, on purpose". It clears any check-in for that day,
 * and everywhere Habyss counts, the day is treated as if the habit had not
 * been scheduled: it does not break a streak and it does not count as missed.
 */
// Serialize every progress mutation, including switches between measured, skipped
// and checked states. Cache changes and notifications follow a committed write.
let progressWrites: Promise<unknown> = Promise.resolve();
function writeProgress<T>(work: () => Promise<T>): Promise<T> {
    const next = progressWrites.catch(() => undefined).then(work);
    progressWrites = next;
    return next;
}

async function progressTransaction(db: any, work: (tx: any) => Promise<void>): Promise<void> {
    // Expo exposes exclusive connections only on native platforms. Progress
    // writes are also queued above, so web can use its supported transaction API.
    if (Platform.OS === 'web') await db.withTransactionAsync(() => work(db));
    else await db.withExclusiveTransactionAsync(work);
}

async function progressStorage() {
    const uid = await getUserId();
    const db = await getDatabase();
    if (!uid || !db) throw new Error('Your progress could not be saved. Please try again.');
    return { uid, db };
}

function progressSaved(habitId: string, date: string, completed: boolean, skipped = false) {
    delete completionsCache[date];
    delete skippedCache[date];
    emit('habit_completion_updated', { habitId, date, completed, skipped });
    void NotificationService.refreshHabitReminders().catch(() => undefined);

}

export function setSkipped(habitId: string, skipped: boolean, dateISO = todayString()): Promise<void> {
    return writeProgress(async () => {
        const { uid, db } = await progressStorage();
        const now = new Date().toISOString();
        await progressTransaction(db, async (tx: any) => {
            await tx.runAsync('DELETE FROM habit_measurements WHERE user_id = ? AND habit_id = ? AND date = ?', uid, habitId, dateISO);
            if (skipped) {
                await tx.runAsync(
                    `INSERT INTO completions (id, user_id, habit_id, date, value, skipped, created_at, updated_at, synced, deleted)
                     VALUES (?, ?, ?, ?, 0, 1, ?, ?, 0, 0)
                     ON CONFLICT(habit_id, date) DO UPDATE SET
                     value = 0, skipped = 1, deleted = 0, synced = 0, updated_at = excluded.updated_at`,
                    `${habitId}_${dateISO}`, uid, habitId, dateISO, now, now,
                );
            } else {
                await tx.runAsync(
                    'UPDATE completions SET deleted = 1, skipped = 0, synced = 0, updated_at = ? WHERE habit_id = ? AND date = ? AND user_id = ?',
                    now, habitId, dateISO, uid,
                );
            }
        });
        progressSaved(habitId, dateISO, false, skipped);
    });
}

export function toggleCompletion(habitId: string, dateISO = todayString()): Promise<Record<string, boolean>> {
    return writeProgress(async () => {
        const { uid, db } = await progressStorage();
        const now = new Date().toISOString();
        let completed = false;
        await progressTransaction(db, async (tx: any) => {
            const existing = await tx.getFirstAsync(
                'SELECT id FROM completions WHERE user_id = ? AND habit_id = ? AND date = ? AND deleted = 0 AND COALESCE(skipped, 0) = 0',
                uid, habitId, dateISO,
            );
            completed = !existing;
            await tx.runAsync('DELETE FROM habit_measurements WHERE user_id = ? AND habit_id = ? AND date = ?', uid, habitId, dateISO);
            if (!completed) {
                await tx.runAsync(
                    'UPDATE completions SET deleted = 1, skipped = 0, synced = 0, updated_at = ? WHERE habit_id = ? AND date = ? AND user_id = ?',
                    now, habitId, dateISO, uid,
                );
            } else {
                await tx.runAsync(
                    `INSERT INTO completions (id, user_id, habit_id, date, value, skipped, created_at, updated_at, synced, deleted)
                     VALUES (?, ?, ?, ?, 1, 0, ?, ?, 0, 0)
                     ON CONFLICT(habit_id, date) DO UPDATE SET
                     value = 1, skipped = 0, updated_at = excluded.updated_at, deleted = 0, synced = 0`,
                    `${habitId}_${dateISO}`, uid, habitId, dateISO, now, now,
                );
            }
        });
        progressSaved(habitId, dateISO, completed);
        const habit = cachedHabits?.find(h => h.id === habitId);
        if (completed && habit) void NotificationService.sendCompletionNotification(habit.name).catch(() => undefined);
        return getCompletions(dateISO);
    });
}

// --- Statistics ---

export async function getLastNDaysCompletions(days: number): Promise<{ date: string; completedIds: string[]; skippedIds: string[] }[]> {
    const uid = await getUserId();
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - (days - 1));

    const startStr = todayString(startDate);
    const endStr = todayString(endDate);

    // Try SQLite first (offline-capable)
    if (isSQLiteAvailable()) {
        try {
            const db = await getDatabase();
            if (db && uid) {
                const rows = await db.getAllAsync(
                    'SELECT date, habit_id, COALESCE(skipped, 0) AS skipped FROM completions WHERE user_id = ? AND date >= ? AND date <= ? AND deleted = 0',
                    uid, startStr, endStr
                );

                const map = new Map<string, string[]>();
                const skips = new Map<string, string[]>();
                rows.forEach((row: any) => {
                    const target = row.skipped ? skips : map;
                    if (!target.has(row.date)) target.set(row.date, []);
                    target.get(row.date)!.push(row.habit_id);
                });

                const result: { date: string; completedIds: string[]; skippedIds: string[] }[] = [];
                for (let i = 0; i < days; i++) {
                    const d = new Date(startDate);
                    d.setDate(startDate.getDate() + i);
                    const dateStr = todayString(d);
                    result.push({
                        date: dateStr,
                        completedIds: map.get(dateStr) || [],
                        skippedIds: skips.get(dateStr) || [],
                    });
                }

                return result;
            }
        } catch (e) {
            console.error('[Habits] SQLite completions range read failed:', e);
        }
    }

    return [];
}

export async function getStreakData(): Promise<{ currentStreak: number; bestStreak: number; perfectDays: number; totalCompleted: number }> {
    const habits = await getHabits();
    const earliest = habits.map(h => parseHabitDate(h.startDate) ?? parseHabitDate(h.createdAt))
        .filter((date): date is Date => date !== null).map(localDateKey).sort()[0] ?? todayString();
    const history = await getLastNDaysCompletions(Math.max(1, daysBetween(earliest, todayString()) + 1));
    const totalHabitCount = habits.filter(h => !h.isGoal).length;

    if (totalHabitCount === 0) return { currentStreak: 0, bestStreak: 0, perfectDays: 0, totalCompleted: 0 };

    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;
    let perfectDays = 0;
    let totalCompleted = 0;

    history.forEach(day => {
        const completedCount = day.completedIds.length;
        totalCompleted += completedCount;

        if (completedCount > 0 && completedCount >= totalHabitCount) {
            perfectDays++;
        }

        if (completedCount > 0) {
            tempStreak++;
        } else {
            bestStreak = Math.max(bestStreak, tempStreak);
            tempStreak = 0;
        }
    });

    bestStreak = Math.max(bestStreak, tempStreak);

    let streak = 0;
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].completedIds.length > 0) {
            streak++;
        } else {
            if (i === history.length - 1) continue;
            break;
        }
    }
    currentStreak = streak;

    return { currentStreak, bestStreak, perfectDays, totalCompleted };
}

/**
 * Get detailed stats for a single habit
 */
export async function getHabitStats(habitId: string): Promise<{
    currentStreak: number;
    bestStreak: number;
    completionRate: number; // 0-100
    totalCompletions: number;
    totalDaysTracked: number;
}> {
    const habits = await getHabits();
    const habit = habits.find((item) => item.id === habitId);
    if (!habit) {
        return { currentStreak: 0, bestStreak: 0, completionRate: 0, totalCompletions: 0, totalDaysTracked: 0 };
    }

    const today = todayString();
    const start = parseHabitDate(habit.startDate) ?? parseHabitDate(habit.createdAt) ?? new Date();
    const trackingStartStr = localDateKey(start);
    const uid = await getUserId();
    const db = await getDatabase();
    if (!uid || !db) throw new Error('Habit history is unavailable. Please try again.');
    const rows = await db.getAllAsync(
        'SELECT date, COALESCE(skipped, 0) AS skipped FROM completions WHERE user_id = ? AND habit_id = ? AND date >= ? AND date <= ? AND deleted = 0',
        uid, habitId, trackingStartStr, today,
    );
    const completed = new Set<string>(rows.filter((row: any) => !row.skipped).map((row: any) => row.date));
    const skipped = new Set<string>(rows.filter((row: any) => row.skipped).map((row: any) => row.date));
    const habitHistory = [];
    for (let day = trackingStartStr; day <= today; day = addDays(day, 1)) {
        habitHistory.push({
            date: day,
            completed: completed.has(day),
            scheduled: !skipped.has(day) && isHabitScheduledForDate(habit, new Date(`${day}T12:00:00`)),
        });
    }

    const relevantHistory = habitHistory.filter((day) => day.scheduled);

    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;
    let totalCompletions = 0;

    relevantHistory.forEach(day => {
        if (day.completed) {
            tempStreak++;
            totalCompletions++;
        } else {
            bestStreak = Math.max(bestStreak, tempStreak);
            tempStreak = 0;
        }
    });
    bestStreak = Math.max(bestStreak, tempStreak);

    // Current streak (from end, allow today to be incomplete)
    for (let i = relevantHistory.length - 1; i >= 0; i--) {
        if (relevantHistory[i].completed) currentStreak++;
        else if (relevantHistory[i].date === today) continue; // only today is still pending
        else break;
    }

    const totalDaysTracked = relevantHistory.length;
    const completionRate = totalDaysTracked > 0 ? Math.round((totalCompletions / totalDaysTracked) * 100) : 0;

    return { currentStreak, bestStreak, completionRate, totalCompletions, totalDaysTracked };
}

/**
 * Infer tracking style from habit unit & goalValue
 * Returns 'timer' | 'counter' | 'boolean'
 */
export function inferTrackingStyle(unit?: string, goalValue?: number): 'timer' | 'counter' | 'boolean' {
    const timerUnits = ['minutes', 'hours', 'seconds', 'min', 'hrs', 'sec'];
    if (unit && timerUnits.includes(unit.toLowerCase())) return 'timer';
    if (goalValue && goalValue > 1) return 'counter';
    return 'boolean';
}

export async function calculateGoalProgress(goal: Habit): Promise<number> {
    const uid = await getUserId();
    if (!uid || !goal.isGoal) return 0;

    const habits = await getHabits();
    const linked = habits.filter(h => h.goalId === goal.id && !h.isArchived);

    if (linked.length === 0) return 0;

    const startDate = new Date(goal.startDate || goal.createdAt);
    const targetDate = goal.targetDate ? new Date(goal.targetDate) : new Date();

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = targetDate.toISOString().split('T')[0];

    // Use SQLite to get completions for linked habits
    let totalCompleted = 0;
    if (isSQLiteAvailable()) {
        try {
            const db = await getDatabase();
            if (db) {
                const linkedIds = linked.map(h => h.id);
                const placeholders = linkedIds.map(() => '?').join(',');
                const rows = await db.getAllAsync(
                    `SELECT habit_id, date FROM completions WHERE habit_id IN (${placeholders}) AND date >= ? AND date <= ? AND deleted = 0`,
                    ...linkedIds, startStr, endStr
                );
                totalCompleted = rows.length;
            }
        } catch (e) {
            console.error('[Habits] SQLite goal progress query failed:', e);
            return 0;
        }
    }

    let totalExpected = 0;

    const current = new Date(startDate);
    if (current > targetDate) return 0;

    while (current <= targetDate) {
        const dayName = current.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
        const dateStr = current.toISOString().split('T')[0];

        linked.forEach(habit => {
            const hCreated = new Date(habit.createdAt);
            if (new Date(dateStr) >= new Date(hCreated.toISOString().split('T')[0])) {
                if (habit.taskDays.includes(dayName)) {
                    totalExpected++;
                }
            }
        });

        current.setDate(current.getDate() + 1);
    }

    if (totalExpected === 0) return 0;

    return Math.round((totalCompleted / totalExpected) * 100);
}

/**
 * A goal's progress, 0-100: its habits' share of scheduled check-ins done and
 * its finished tasks, each habit and task weighing the same. Every screen
 * showing a goal's progress uses this (see lib/goalInsights.ts), so the number
 * is the same wherever the goal appears. Pass the tasks; without them only the
 * habit side is counted.
 */
export function calculateGoalProgressInstant(
    goal: Habit,
    habits: Habit[],
    todayCompletions: Record<string, boolean>,
    historyMap: Record<string, string[]> = {},
    tasks: Task[] = [],
): number {
    if (!goal.isGoal) return 0;
    const today = todayString();
    const doneToday = Object.keys(todayCompletions).filter(id => todayCompletions[id]);
    const history = { ...historyMap, [today]: doneToday };
    return goalProgress({ goal, habits, tasks, history, today });
}

export async function getHeatmapData(): Promise<{ date: string; count: number }[]> {
    const uid = await getUserId();
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 365);

    const startStr = todayString(startDate);
    const endStr = todayString(endDate);

    // Try SQLite first (offline-capable)
    if (isSQLiteAvailable()) {
        try {
            const db = await getDatabase();
            if (db && uid) {
                const rows = await db.getAllAsync(
                    'SELECT date FROM completions WHERE user_id = ? AND date >= ? AND date <= ? AND deleted = 0',
                    uid, startStr, endStr
                );

                const counts: Record<string, number> = {};
                rows.forEach((row: any) => {
                    counts[row.date] = (counts[row.date] || 0) + 1;
                });

                return Object.keys(counts).map(date => ({
                    date,
                    count: counts[date]
                }));
            }
        } catch (e) {
            console.error('[Habits] SQLite heatmap read failed:', e);
        }
    }

    return [];
}

export function setCompletionValue(habitId: string, value: number, dateISO = todayString()): Promise<void> {
    return writeProgress(async () => {
        if (!Number.isFinite(value) || value < 0) throw new Error('Enter a valid amount.');
        const { uid, db } = await progressStorage();
        const now = new Date().toISOString();
        await progressTransaction(db, async (tx: any) => {
            await tx.runAsync('DELETE FROM habit_measurements WHERE user_id = ? AND habit_id = ? AND date = ?', uid, habitId, dateISO);
            await tx.runAsync(
                `INSERT INTO completions (id, user_id, habit_id, date, value, skipped, created_at, updated_at, synced, deleted)
                 VALUES (?, ?, ?, ?, ?, 0, ?, ?, 0, 0)
                 ON CONFLICT(habit_id, date) DO UPDATE SET
                 value = excluded.value, skipped = 0, updated_at = excluded.updated_at, deleted = 0, synced = 0`,
                `${habitId}_${dateISO}`, uid, habitId, dateISO, value, now, now,
            );
        });
        progressSaved(habitId, dateISO, true);
        emit('habit_completed', { habitId, date: dateISO, value });
    });
}

/** Reads a persisted amount; old check-ins without measurements represent the full target. */
export async function getHabitMeasurement(habitId: string, target: number, dateISO = todayString()): Promise<number> {
    const uid = await getUserId();
    const db = await getDatabase();
    if (!uid || !db) throw new Error('Habit progress is unavailable. Please try again.');
    return readMeasurement(db, uid, habitId, target, dateISO);
}

async function readMeasurement(db: any, uid: string, habitId: string, target: number, date: string): Promise<number> {
    const measurement = await db.getFirstAsync(
        'SELECT value FROM habit_measurements WHERE user_id = ? AND habit_id = ? AND date = ?', uid, habitId, date,
    );
    if (measurement) return measurement.value;
    const completion = await db.getFirstAsync(
        'SELECT value FROM completions WHERE user_id = ? AND habit_id = ? AND date = ? AND deleted = 0 AND COALESCE(skipped, 0) = 0',
        uid, habitId, date,
    );
    return completion ? Math.max(target, completion.value || 0) : 0;
}

// Serialize taps and completed focus sessions. A rejected write must not block the next one.
export function saveHabitMeasurement(habitId: string, amount: number, dateISO = todayString(), add = false): Promise<number> {
    return writeProgress(async () => {
        if (!Number.isFinite(amount) || amount < 0 || amount > 100000000) throw new Error('Enter a valid amount.');
        const uid = await getUserId();
        const db = await getDatabase();
        if (!uid || !db) throw new Error('Your progress could not be saved. Please try again.');
        const habit = await db.getFirstAsync(
            'SELECT goal_value AS goalValue, unit, duration_minutes AS durationMinutes, type, tracking_method AS trackingMethod FROM habits WHERE id = ? AND user_id = ? AND deleted = 0',
            habitId, uid,
        );
        if (!habit) throw new Error('This habit is no longer available.');
        const { target } = measurementFor(habit);
        const now = new Date().toISOString();
        let value = amount;
        await progressTransaction(db, async (tx: any) => {
            if (add) value += await readMeasurement(tx, uid, habitId, target, dateISO);
            if (!Number.isFinite(value) || value > 100000000) throw new Error('Enter a valid amount.');
            value = Math.round(value * 1000) / 1000;
            await tx.runAsync(
                `INSERT INTO habit_measurements (user_id, habit_id, date, value, updated_at) VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(user_id, habit_id, date) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
                uid, habitId, dateISO, value, now,
            );
            if (value >= target) {
                await tx.runAsync(
                    `INSERT INTO completions (id, user_id, habit_id, date, value, skipped, created_at, updated_at, synced, deleted)
                     VALUES (?, ?, ?, ?, ?, 0, ?, ?, 0, 0)
                     ON CONFLICT(habit_id, date) DO UPDATE SET value = excluded.value, skipped = 0, deleted = 0, synced = 0, updated_at = excluded.updated_at`,
                    `${habitId}_${dateISO}`, uid, habitId, dateISO, value, now, now,
                );
            } else {
                await tx.runAsync(
                    'UPDATE completions SET deleted = 1, skipped = 0, synced = 0, updated_at = ? WHERE user_id = ? AND habit_id = ? AND date = ?',
                    now, uid, habitId, dateISO,
                );
            }
        });
        delete completionsCache[dateISO];
        delete skippedCache[dateISO];
        emit('habit_completion_updated', { habitId, date: dateISO, completed: value >= target, value });
        void NotificationService.refreshHabitReminders().catch(() => undefined);

        return value;
    });
}

export async function syncHealthKitData() {
    if (!HealthKitService.isAvailable) return;

    // Check if we have any habits that need syncing BEFORE asking for permission/init
    const habits = await getHabits();
    const hkHabits = habits.filter(h => h.healthKitMetric && !h.isArchived && !h.isGoal);

    if (hkHabits.length === 0) return;

    // Now init (will prompt if not authorized, or just return false if denied/restricted)
    const authorized = await HealthKitService.init();
    if (!authorized) return;

    console.log('[Habits] Syncing HealthKit data for', hkHabits.length, 'habits');

    const today = new Date();
    const dateStr = todayString(today);

    for (const habit of hkHabits) {
        let value = 0;
        try {
            switch (habit.healthKitMetric) {
                case 'steps': value = await HealthKitService.getSteps(today); break;
                case 'sleep': value = await HealthKitService.getSleep(today); break; // mins
                case 'mindfulness': value = await HealthKitService.getMindfulness(today); break;
                case 'workout': value = await HealthKitService.getWorkout(today); break;
            }

            // Only update if we have data. 
            // Also logic: should we only complete if value >= target? 
            // For numeric tracking, we store the value. 
            // For boolean tracking, we might want to toggle?
            // Let's store the value regardless. The UI can decide if it shows as "checked" based on target.

            if (value > 0) {
                // If it's a "Steps" habit, goalValue 10000. 
                // We store 5000 in completions. 
                // Does getCompletions return values? currently it returns boolean map.
                // We might need to upgrade getCompletions to return values map or similar.
                // For now, let's just use setCompletionValue which inserts into DB.
                // But does UI see it? 

                // If the habit is "boolean" tracking (default), we only mark complete if target reached.
                if (habit.trackingMethod === 'numeric') {
                    await setCompletionValue(habit.id, value, dateStr);
                } else {
                    // Boolean tracking (e.g. Ring)
                    const target = habit.healthKitTarget || habit.goalValue || 1;
                    if (value >= target) {
                        // Check if already completed?
                        // Just force complete
                        await setCompletionValue(habit.id, value, dateStr);
                    }
                }
            }
        } catch (e) {
            console.error('[Habits] Error syncing habit', habit.id, e);
        }
    }
}
