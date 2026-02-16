/**
 * SQLite-Enabled Habits Module with Expo Go Fallback
 * Provides SQLite-first data access with Supabase cloud sync
 * Falls back to Supabase-only when SQLite is unavailable (Expo Go)
 */

import { isSQLiteAvailable } from './database';
import { HealthKitService } from './HealthKitService';
import { VoidCard } from '@/components/Layout/VoidCard';
import { supabase } from './supabase';
import { DeviceEventEmitter } from 'react-native';
import { NotificationService } from './notificationService';
import SharedDefaults from './SharedDefaults';

// Widget Sync Helper
async function syncWidgets() {
    try {
        const habits = await getHabits();
        const activeHabits = habits.filter(h => !h.isArchived && !h.isGoal);
        const todayCompletions = await getCompletions(todayString());

        const widgetData = activeHabits.map(h => ({
            id: h.id,
            name: h.name,
            isCompleted: !!todayCompletions[h.id]
        }));

        console.log('[Widget] Syncing', widgetData.length, 'habits');
        await SharedDefaults.set('habitsData', JSON.stringify(widgetData));
        await SharedDefaults.set('todayStats', JSON.stringify({
            total: activeHabits.length,
            completed: Object.keys(todayCompletions).length
        }));

        // Force widget reload
        await SharedDefaults.reloadTimelines();

    } catch (e) {
        console.warn('[Widget] Sync failed:', e);
    }
}


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
    locationReminders?: { name: string; latitude: number; longitude: number; radius?: number }[];
    reminderOffset?: number; // Minutes before start time
    healthKitMetric?: 'steps' | 'sleep' | 'mindfulness' | 'workout'; // New
    healthKitTarget?: number; // New
}

// Cache
let cachedHabits: Habit[] | null = null;
const habitsListeners: Set<(habits: Habit[]) => void> = new Set();
const completionsCache: Record<string, Record<string, boolean>> = {};

// --- Helpers ---

export async function getUserId(): Promise<string | undefined> {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id;
}

const todayString = (d = new Date()) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const isHabitScheduledForDate = (habit: Habit, date: Date): boolean => {
    const habitStart = new Date(habit.startDate || habit.createdAt);
    const dateStr = date.toISOString().split('T')[0];
    const startStr = habitStart.toISOString().split('T')[0];

    if (dateStr < startStr) return false;

    if (habit.targetDate) {
        const targetStr = new Date(habit.targetDate).toISOString().split('T')[0];
        if (dateStr > targetStr) return false;
    }

    if (habit.weekInterval && habit.weekInterval > 1) {
        const getWeekNumber = (d: Date): number => {
            const date = new Date(d);
            date.setHours(0, 0, 0, 0);
            const jan1st = new Date(date.getFullYear(), 0, 1);
            const days = Math.floor((date.getTime() - jan1st.getTime()) / (24 * 60 * 60 * 1000));
            return Math.ceil((days + jan1st.getDay() + 1) / 7);
        };

        const startWeek = getWeekNumber(habitStart);
        const currentWeek = getWeekNumber(date);
        const weeksDiff = currentWeek - startWeek;

        if (weeksDiff % habit.weekInterval !== 0) return false;
    }

    if (habit.frequency === 'monthly') {
        const startDay = parseInt(habit.startDate.split('-')[2], 10);
        const currentDay = parseInt(dateStr.split('-')[2], 10);
        if (startDay !== currentDay) return false;
        return true;
    }

    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
    if (habit.taskDays && habit.taskDays.length > 0) {
        return habit.taskDays.map(d => d.toLowerCase()).includes(dayName);
    }

    return true;
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
    habitsListeners.clear();
}

// --- CRUD Operations (SQLite-first when available, Supabase fallback) ---

export async function getHabits(): Promise<Habit[]> {
    const uid = await getUserId();
    if (!uid) return cachedHabits || [];

    // Try SQLite first (offline-capable)
    if (isSQLiteAvailable()) {
        try {
            const { getDatabase } = await import('./database');
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
                    taskDays: typeof row.task_days === 'string' ? JSON.parse(row.task_days) : (row.task_days || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
                    reminders: typeof row.reminders === 'string' ? JSON.parse(row.reminders) : (row.reminders || []),
                    chartType: row.chart_type || 'bar',
                    startDate: row.start_date || row.created_at,
                    endDate: row.end_date,
                    isArchived: row.is_archived === 1,
                    showMemo: row.show_memo === 1,
                    goalId: row.goal_id,
                    frequency: row.frequency,
                    weekInterval: row.week_interval,
                    timeOfDay: row.time_of_day,
                    reminderOffset: row.reminder_offset,
                    locationReminders: typeof row.location_reminders === 'string' ? JSON.parse(row.location_reminders || '[]') : (row.location_reminders || []),
                    graphStyle: row.graph_style,
                    trackingMethod: row.tracking_method,
                    healthKitMetric: row.health_kit_metric,
                    healthKitTarget: row.health_kit_target,
                }));

                cachedHabits = habits;
                return habits;
            }
        } catch (e) {
            console.log('[Habits] SQLite read failed, falling back to Supabase:', e);
        }
    }

    // Fallback to Supabase (online mode)
    try {
        const { data, error } = await supabase
            .from('habits')
            .select('*')
            .eq('user_id', uid)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const habits: Habit[] = (data || []).map((row: any) => ({
            id: row.id,
            name: row.name,
            description: row.description,
            category: row.category as HabitCategory,
            icon: row.icon,
            createdAt: row.created_at,
            durationMinutes: row.duration_minutes,
            startTime: row.start_time,
            endTime: row.end_time,
            isGoal: row.is_goal,
            targetDate: row.target_date,
            type: row.type || 'build',
            color: row.color || '#6B46C1',
            goalPeriod: row.goal_period || 'daily',
            goalValue: row.goal_value || 1,
            unit: row.unit || 'count',
            taskDays: row.task_days || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
            reminders: row.reminders || [],
            chartType: row.chart_type || 'bar',
            startDate: row.start_date || row.created_at,
            endDate: row.end_date,
            isArchived: row.is_archived || false,
            showMemo: row.show_memo || false,
            goalId: row.goal_id,
            reminderOffset: row.reminder_offset,
            locationReminders: row.location_reminders || [],
            healthKitMetric: row.health_kit_metric,
            healthKitTarget: row.health_kit_target
        }));

        cachedHabits = habits;
        return habits;
    } catch (e) {
        console.error('Error fetching habits:', e);
        // Return cached data if available (offline fallback)
        return cachedHabits || [];
    }
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
            const { getDatabase, generateId } = await import('./database');
            const db = await getDatabase();
            if (db) {
                const id = generateId();

                await db.runAsync(`
                    INSERT INTO habits (
                        id, user_id, name, description, category, icon, is_goal, target_date, goal_id,
                        task_days, reminders, start_date, end_date, duration_minutes, start_time, end_time,
                        type, color, goal_period, goal_value, unit, chart_type, is_archived, show_memo,
                        frequency, week_interval, time_of_day, graph_style, tracking_method,
                        reminder_offset, location_reminders, health_kit_metric, health_kit_target, created_at, updated_at, synced, deleted
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
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
                    habitData.reminderOffset || null,
                    JSON.stringify(habitData.locationReminders || []),
                    habitData.healthKitMetric || null,
                    habitData.healthKitTarget || null,
                    now,
                    now
                );

                // Queue for sync to cloud
                await db.runAsync(
                    'INSERT INTO sync_queue (table_name, operation, record_id, payload, created_at) VALUES (?, ?, ?, ?, ?)',
                    'habits', 'INSERT', id, JSON.stringify(habitData), now
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
                    reminderOffset: habitData.reminderOffset,
                    locationReminders: habitData.locationReminders || [],
                    graphStyle: habitData.graphStyle,
                    trackingMethod: habitData.trackingMethod,
                    healthKitMetric: habitData.healthKitMetric,
                    healthKitTarget: habitData.healthKitTarget,
                };

                if (created.reminders && created.reminders.length > 0) {
                    await NotificationService.scheduleHabitReminder(created);
                }

                if (cachedHabits) {
                    cachedHabits = [created, ...cachedHabits];
                    habitsListeners.forEach(l => l(cachedHabits!));
                }

                DeviceEventEmitter.emit('habit_created', { habit: created });
                syncWidgets(); // Sync to widget
                return created;
            }
        } catch (e) {
            console.log('[Habits] SQLite insert failed, falling back to Supabase:', e);
        }
    }

    // Fallback to Supabase (online mode)
    const newHabit: any = {
        user_id: uid,
        name: habitData.name,
        category: habitData.category,
        icon: habitData.icon,
        created_at: now,
        duration_minutes: habitData.durationMinutes,
        start_time: habitData.startTime,
        end_time: habitData.endTime,
        is_goal: habitData.isGoal,
        target_date: habitData.targetDate,
        ...(habitData.goalId ? { goal_id: habitData.goalId } : {}),
        health_kit_metric: habitData.healthKitMetric,
        health_kit_target: habitData.healthKitTarget,
    };

    const { data, error } = await supabase
        .from('habits')
        .insert([newHabit])
        .select()
        .single();

    if (error) {
        console.error("Error adding habit:", error);
        return null;
    }

    const created: Habit = {
        id: data.id,
        name: data.name,
        description: data.description,
        category: data.category as HabitCategory,
        icon: data.icon,
        createdAt: data.created_at,
        durationMinutes: data.duration_minutes,
        startTime: data.start_time,
        endTime: data.end_time,
        isGoal: data.is_goal,
        targetDate: data.target_date,
        type: data.type || 'build',
        color: data.color || '#6B46C1',
        goalPeriod: data.goal_period || 'daily',
        goalValue: data.goal_value || 1,
        unit: data.unit || 'count',
        taskDays: data.task_days || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
        reminders: data.reminders || [],
        chartType: data.chart_type || 'bar',
        startDate: data.start_date || data.created_at,
        endDate: data.end_date,
        isArchived: data.is_archived || false,
        showMemo: data.show_memo || false,
        goalId: data.goal_id,
        reminderOffset: data.reminder_offset,
        locationReminders: data.location_reminders || [],
        healthKitMetric: data.health_kit_metric,
        healthKitTarget: data.health_kit_target
    };

    if (created.reminders && created.reminders.length > 0) {
        await NotificationService.scheduleHabitReminder(created);
    }

    if (cachedHabits) {
        cachedHabits = [created, ...cachedHabits];
        habitsListeners.forEach(l => l(cachedHabits!));
    }

    syncWidgets(); // Sync to widget
    return created;
}

export async function updateHabit(updatedHabit: Partial<Habit> & { id: string }): Promise<void> {
    const uid = await getUserId();
    if (!uid) return;

    const now = new Date().toISOString();

    // Try SQLite first (offline-capable)
    if (isSQLiteAvailable()) {
        try {
            const { getDatabase } = await import('./database');
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
                if (updatedHabit.goalId !== undefined) { setClauses.push('goal_id = ?'); params.push(updatedHabit.goalId); }
                if (updatedHabit.taskDays !== undefined) { setClauses.push('task_days = ?'); params.push(JSON.stringify(updatedHabit.taskDays)); }
                if (updatedHabit.reminders !== undefined) { setClauses.push('reminders = ?'); params.push(JSON.stringify(updatedHabit.reminders)); }
                if (updatedHabit.isArchived !== undefined) { setClauses.push('is_archived = ?'); params.push(updatedHabit.isArchived ? 1 : 0); }
                if (updatedHabit.durationMinutes !== undefined) { setClauses.push('duration_minutes = ?'); params.push(updatedHabit.durationMinutes); }
                if (updatedHabit.startTime !== undefined) { setClauses.push('start_time = ?'); params.push(updatedHabit.startTime); }
                if (updatedHabit.endTime !== undefined) { setClauses.push('end_time = ?'); params.push(updatedHabit.endTime); }
                if (updatedHabit.graphStyle !== undefined) { setClauses.push('graph_style = ?'); params.push(updatedHabit.graphStyle); }
                if (updatedHabit.trackingMethod !== undefined) { setClauses.push('tracking_method = ?'); params.push(updatedHabit.trackingMethod); }
                if (updatedHabit.reminderOffset !== undefined) { setClauses.push('reminder_offset = ?'); params.push(updatedHabit.reminderOffset); }
                if (updatedHabit.locationReminders !== undefined) { setClauses.push('location_reminders = ?'); params.push(JSON.stringify(updatedHabit.locationReminders)); }
                if (updatedHabit.healthKitMetric !== undefined) { setClauses.push('health_kit_metric = ?'); params.push(updatedHabit.healthKitMetric); }
                if (updatedHabit.healthKitTarget !== undefined) { setClauses.push('health_kit_target = ?'); params.push(updatedHabit.healthKitTarget); }

                params.push(updatedHabit.id, uid);

                await db.runAsync(
                    `UPDATE habits SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`,
                    ...params
                );

                // Queue for sync
                await db.runAsync(
                    'INSERT INTO sync_queue (table_name, operation, record_id, payload, created_at) VALUES (?, ?, ?, ?, ?)',
                    'habits', 'UPDATE', updatedHabit.id, JSON.stringify(updatedHabit), now
                );

                // Update cache
                if (cachedHabits) {
                    cachedHabits = cachedHabits.map(h => h.id === updatedHabit.id ? { ...h, ...updatedHabit } as Habit : h);
                    habitsListeners.forEach(l => l(cachedHabits!));
                }

                const fullHabit = cachedHabits?.find(h => h.id === updatedHabit.id);
                if (fullHabit) {
                    await NotificationService.scheduleHabitReminder(fullHabit);
                }

                DeviceEventEmitter.emit('habit_updated', { habitId: updatedHabit.id });
                syncWidgets(); // Sync to widget
                return;
            }
        } catch (e) {
            console.log('[Habits] SQLite update failed, falling back to Supabase:', e);
        }
    }

    // Fallback to Supabase
    const updateData: Record<string, any> = {};

    if (updatedHabit.name !== undefined) updateData.name = updatedHabit.name;
    if (updatedHabit.category !== undefined) updateData.category = updatedHabit.category;
    if (updatedHabit.icon !== undefined) updateData.icon = updatedHabit.icon;
    if (updatedHabit.durationMinutes !== undefined) updateData.duration_minutes = updatedHabit.durationMinutes;
    if (updatedHabit.startTime !== undefined) updateData.start_time = updatedHabit.startTime;
    if (updatedHabit.endTime !== undefined) updateData.end_time = updatedHabit.endTime;
    if (updatedHabit.isGoal !== undefined) updateData.is_goal = updatedHabit.isGoal;
    if (updatedHabit.targetDate !== undefined) updateData.target_date = updatedHabit.targetDate;
    if (updatedHabit.goalId !== undefined) updateData.goal_id = updatedHabit.goalId;
    if (updatedHabit.reminderOffset !== undefined) updateData.reminder_offset = updatedHabit.reminderOffset;
    if (updatedHabit.locationReminders !== undefined) updateData.location_reminders = updatedHabit.locationReminders;
    if (updatedHabit.healthKitMetric !== undefined) updateData.health_kit_metric = updatedHabit.healthKitMetric;
    if (updatedHabit.healthKitTarget !== undefined) updateData.health_kit_target = updatedHabit.healthKitTarget;

    const { error } = await supabase
        .from('habits')
        .update(updateData)
        .eq('id', updatedHabit.id);

    if (error) {
        console.error("Error updating habit:", error);
    } else {
        if (cachedHabits) {
            cachedHabits = cachedHabits.map(h => h.id === updatedHabit.id ? { ...h, ...updatedHabit } as Habit : h);
            habitsListeners.forEach(l => l(cachedHabits!));
        }

        const fullHabit = cachedHabits?.find(h => h.id === updatedHabit.id) ||
            (await getHabits()).find(h => h.id === updatedHabit.id);

        if (fullHabit) {
            await NotificationService.scheduleHabitReminder(fullHabit);
        }
        syncWidgets(); // Sync to widget
    }
}

export async function removeHabitEverywhere(habitId: string): Promise<void> {
    const uid = await getUserId();
    const now = new Date().toISOString();

    // Try SQLite first (offline-capable)
    if (isSQLiteAvailable()) {
        try {
            const { getDatabase } = await import('./database');
            const db = await getDatabase();
            if (db) {
                // Soft delete in SQLite
                await db.runAsync(
                    'UPDATE habits SET deleted = 1, synced = 0, updated_at = ? WHERE id = ?',
                    now, habitId
                );

                // Queue for sync
                await db.runAsync(
                    'INSERT INTO sync_queue (table_name, operation, record_id, payload, created_at) VALUES (?, ?, ?, ?, ?)',
                    'habits', 'DELETE', habitId, null, now
                );

                await NotificationService.cancelHabitReminder(habitId);

                if (cachedHabits) {
                    cachedHabits = cachedHabits.filter(h => h.id !== habitId);
                    habitsListeners.forEach(l => l(cachedHabits!));
                }

                DeviceEventEmitter.emit('habit_deleted', { habitId });
                syncWidgets(); // Sync to widget
                return;
            }
        } catch (e) {
            console.log('[Habits] SQLite delete failed, falling back to Supabase:', e);
        }
    }

    // Fallback to Supabase
    const { error } = await supabase.from('habits').delete().eq('id', habitId);
    if (error) console.error("Error deleting habit:", error);

    await NotificationService.cancelHabitReminder(habitId);

    if (cachedHabits) {
        cachedHabits = cachedHabits.filter(h => h.id !== habitId);
        habitsListeners.forEach(l => l(cachedHabits!));
    }
    syncWidgets(); // Sync to widget
}

export async function removeGoalWithLinkedHabits(goalId: string): Promise<void> {
    const habits = cachedHabits || await getHabits();
    const linkedHabits = habits.filter(h => h.goalId === goalId);

    // Delete all linked habits + the goal in parallel
    await Promise.all([
        ...linkedHabits.map(habit => removeHabitEverywhere(habit.id)),
        removeHabitEverywhere(goalId),
    ]);

    DeviceEventEmitter.emit('goal_deleted', { goalId });
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
            const { getDatabase } = await import('./database');
            const db = await getDatabase();
            if (db) {
                const rows = await db.getAllAsync(
                    'SELECT habit_id FROM completions WHERE user_id = ? AND date = ? AND deleted = 0',
                    uid, dateStr
                );

                const result: Record<string, boolean> = {};
                rows.forEach((row: any) => { result[row.habit_id] = true; });
                completionsCache[dateStr] = result;
                return result;
            }
        } catch (e) {
            console.log('[Habits] SQLite completions read failed, falling back to Supabase:', e);
        }
    }

    // Fallback to Supabase
    const { data, error } = await supabase
        .from('habit_completions')
        .select('habit_id')
        .eq('user_id', uid)
        .eq('date', dateStr);

    if (error) {
        console.error("Error getting completions:", error);
        return completionsCache[dateStr] || {};
    }

    const result: Record<string, boolean> = {};
    (data || []).forEach((row: any) => {
        result[row.habit_id] = true;
    });
    completionsCache[dateStr] = result;
    return result;
}

export async function toggleCompletion(habitId: string, dateISO?: string): Promise<Record<string, boolean>> {
    const uid = await getUserId();
    if (!uid) return {};

    const dateStr = dateISO ?? todayString();
    const now = new Date().toISOString();

    if (!completionsCache[dateStr]) {
        completionsCache[dateStr] = {};
    }

    const wasCompleted = !!completionsCache[dateStr][habitId];
    const newCompleted = !wasCompleted;

    // Optimistic update
    if (newCompleted) {
        completionsCache[dateStr][habitId] = true;
    } else {
        delete completionsCache[dateStr][habitId];
    }

    const optimisticResult = { ...completionsCache[dateStr] };

    // Try SQLite first (offline-capable)
    if (isSQLiteAvailable()) {
        try {
            const { getDatabase, generateId } = await import('./database');
            const db = await getDatabase();
            if (db) {
                if (wasCompleted) {
                    // Mark as deleted in SQLite
                    await db.runAsync(
                        'UPDATE completions SET deleted = 1, synced = 0 WHERE habit_id = ? AND date = ? AND user_id = ?',
                        habitId, dateStr, uid
                    );

                    // Queue for sync
                    await db.runAsync(
                        'INSERT INTO sync_queue (table_name, operation, record_id, payload, created_at) VALUES (?, ?, ?, ?, ?)',
                        'completions', 'DELETE', `${habitId}_${dateStr}`, JSON.stringify({ habitId, date: dateStr }), now
                    );
                } else {
                    // Insert new completion
                    const id = generateId();
                    await db.runAsync(
                        'INSERT INTO completions (id, user_id, habit_id, date, value, created_at, synced, deleted) VALUES (?, ?, ?, ?, 1, ?, 0, 0)',
                        id, uid, habitId, dateStr, now
                    );

                    // Queue for sync
                    await db.runAsync(
                        'INSERT INTO sync_queue (table_name, operation, record_id, payload, created_at) VALUES (?, ?, ?, ?, ?)',
                        'completions', 'INSERT', id, JSON.stringify({ habitId, date: dateStr }), now
                    );

                    // Send notification
                    const habit = cachedHabits?.find(h => h.id === habitId);
                    if (habit) {
                        await NotificationService.sendCompletionNotification(habit.name);
                    }
                }

                DeviceEventEmitter.emit('habit_completion_updated', { habitId, date: dateStr, completed: newCompleted });
                return optimisticResult;
            }
        } catch (e) {
            console.log('[Habits] SQLite completion toggle failed, falling back to Supabase:', e);
        }
    }

    // Fallback to Supabase (async, non-blocking)
    (async () => {
        try {
            if (wasCompleted) {
                await supabase
                    .from('habit_completions')
                    .delete()
                    .eq('user_id', uid)
                    .eq('habit_id', habitId)
                    .eq('date', dateStr);
            } else {
                await supabase.from('habit_completions').insert({
                    user_id: uid,
                    habit_id: habitId,
                    date: dateStr,
                    completed: true
                });

                const habits = await getHabits();
                const habit = habits.find(h => h.id === habitId);
                if (habit) {
                    await NotificationService.sendCompletionNotification(habit.name);
                }
            }
        } catch (error) {
            console.error('Error toggling completion:', error);
            // Revert optimistic update on failure
            if (newCompleted) {
                delete completionsCache[dateStr][habitId];
            } else {
                completionsCache[dateStr][habitId] = true;
            }
        }
    })();

    DeviceEventEmitter.emit('habit_completion_updated', { habitId, date: dateStr, completed: newCompleted });
    syncWidgets(); // Sync to widget

    return optimisticResult;
}

// --- Statistics ---

export async function getLastNDaysCompletions(days: number): Promise<{ date: string; completedIds: string[] }[]> {
    const uid = await getUserId();
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - (days - 1));

    const startStr = todayString(startDate);
    const endStr = todayString(endDate);

    // Try SQLite first (offline-capable)
    if (isSQLiteAvailable()) {
        try {
            const { getDatabase } = await import('./database');
            const db = await getDatabase();
            if (db && uid) {
                const rows = await db.getAllAsync(
                    'SELECT date, habit_id FROM completions WHERE user_id = ? AND date >= ? AND date <= ? AND deleted = 0',
                    uid, startStr, endStr
                );

                const map = new Map<string, string[]>();
                rows.forEach((row: any) => {
                    if (!map.has(row.date)) map.set(row.date, []);
                    map.get(row.date)!.push(row.habit_id);
                });

                const result: { date: string; completedIds: string[] }[] = [];
                for (let i = 0; i < days; i++) {
                    const d = new Date(startDate);
                    d.setDate(startDate.getDate() + i);
                    const dateStr = todayString(d);
                    result.push({
                        date: dateStr,
                        completedIds: map.get(dateStr) || []
                    });
                }

                return result;
            }
        } catch (e) {
            console.log('[Habits] SQLite completions range read failed, falling back to Supabase:', e);
        }
    }

    // Fallback to Supabase
    const { data, error } = await supabase
        .from('habit_completions')
        .select('date, habit_id')
        .gte('date', startStr)
        .lte('date', endStr);

    if (error) {
        console.error(error);
        return [];
    }

    const map = new Map<string, string[]>();
    (data || []).forEach((row: any) => {
        if (!map.has(row.date)) map.set(row.date, []);
        map.get(row.date)!.push(row.habit_id);
    });

    const result: { date: string; completedIds: string[] }[] = [];
    for (let i = 0; i < days; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        const dateStr = todayString(d);
        result.push({
            date: dateStr,
            completedIds: map.get(dateStr) || []
        });
    }

    return result;
}

export async function getStreakData(): Promise<{ currentStreak: number; bestStreak: number; perfectDays: number; totalCompleted: number }> {
    const history = await getLastNDaysCompletions(90);
    const habits = await getHabits();
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

    const { data: completions, error } = await supabase
        .from('habit_completions')
        .select('habit_id, date')
        .in('habit_id', linked.map(h => h.id))
        .gte('date', startStr)
        .lte('date', endStr);

    if (error) {
        console.error('Error fetching goal completions:', error);
        return 0;
    }

    let totalExpected = 0;
    let totalCompleted = completions?.length || 0;

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

export function calculateGoalProgressInstant(
    goal: Habit,
    habits: Habit[],
    todayCompletions: Record<string, boolean>,
    historyMap: Record<string, string[]> = {}
): number {
    if (!goal.isGoal) return 0;

    const linked = habits.filter(h => h.goalId === goal.id && !h.isArchived);
    if (linked.length === 0) return 0;

    const toLocalISO = (d: Date) => {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const todayStr = toLocalISO(new Date());
    const startDate = new Date(goal.startDate || goal.createdAt);
    const targetDate = goal.targetDate ? new Date(goal.targetDate) : new Date();

    let totalExpected = 0;
    let totalCompleted = 0;

    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0); // Normalize time
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);

    if (current > target) return 0;

    while (current <= target) {
        const dateStr = toLocalISO(current);
        const dayName = current.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();

        linked.forEach(habit => {
            const hCreated = new Date(habit.createdAt);
            const createdStr = toLocalISO(hCreated);

            if (dateStr >= createdStr) {
                if (habit.taskDays?.includes(dayName)) {
                    totalExpected++;

                    if (dateStr === todayStr) {
                        if (todayCompletions[habit.id]) totalCompleted++;
                    } else {
                        const completedIds = historyMap[dateStr];
                        if (completedIds && completedIds.includes(habit.id)) {
                            totalCompleted++;
                        }
                    }
                }
            }
        });

        current.setDate(current.getDate() + 1);
    }

    if (totalExpected === 0) return 0;
    return Math.round((totalCompleted / totalExpected) * 100);
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
            const { getDatabase } = await import('./database');
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
            console.log('[Habits] SQLite heatmap read failed, falling back to Supabase:', e);
        }
    }

    // Fallback to Supabase
    const { data, error } = await supabase
        .from('habit_completions')
        .select('date')
        .gte('date', startStr)
        .lte('date', endStr);

    if (error) {
        console.error(error);
        return [];
    }

    const counts: Record<string, number> = {};
    (data || []).forEach((row: any) => {
        counts[row.date] = (counts[row.date] || 0) + 1;
    });

    return Object.keys(counts).map(date => ({
        date,
        count: counts[date]
    }));
}

export async function setCompletionValue(habitId: string, value: number, dateISO?: string): Promise<void> {
    const uid = await getUserId();
    if (!uid) return;

    const dateStr = dateISO ?? todayString();
    const now = new Date().toISOString();

    // Try SQLite first (offline-capable)
    if (isSQLiteAvailable()) {
        try {
            const { getDatabase } = await import('./database');
            const db = await getDatabase();
            if (db) {
                // Upsert completion with value
                await db.runAsync(
                    `INSERT INTO completions (id, user_id, habit_id, date, value, created_at, updated_at, synced, deleted)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)
                     ON CONFLICT(habit_id, date) DO UPDATE SET
                     value = excluded.value,
                     updated_at = excluded.updated_at,
                     deleted = 0,
                     synced = 0`,
                    `${habitId}_${dateStr}`, uid, habitId, dateStr, value, now, now
                );

                // Update cache
                if (!completionsCache[dateStr]) completionsCache[dateStr] = {};
                completionsCache[dateStr][habitId] = true; // Mark as completed (existence implies completion for now, or check value > target?)

                // Notify listeners
                if (cachedHabits) habitsListeners.forEach(l => l(cachedHabits!));
                DeviceEventEmitter.emit('habit_completed', { habitId, date: dateStr, value });

                // Queue sync not strictly needed if we just mark synced=0, but for completeness:
                // We rely on background sync to pick up unsynced records.
                // Or we can explicitly queue if we want faster sync.
                return;
            }
        } catch (e) {
            console.log('[Habits] SQLite setCompletionValue failed:', e);
        }
    }
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
