/**
 * SQLite-Enabled Habits Module with Expo Go Fallback
 * Provides SQLite-first data access with Supabase cloud sync
 * Falls back to Supabase-only when SQLite is unavailable (Expo Go)
 */

import { isSQLiteAvailable } from './database';
import { supabase } from './supabase';
import { DeviceEventEmitter } from 'react-native';
import { NotificationService } from './notificationService';

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

// --- CRUD Operations (Supabase fallback when SQLite unavailable) ---

export async function getHabits(): Promise<Habit[]> {
    const uid = await getUserId();
    if (!uid) return [];

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
            locationReminders: row.location_reminders || []
        }));

        cachedHabits = habits;
        return habits;
    } catch (e) {
        console.error('Error fetching habits:', e);
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

    const newHabit: any = {
        user_id: uid,
        name: habitData.name,
        category: habitData.category,
        icon: habitData.icon,
        created_at: new Date().toISOString(),
        duration_minutes: habitData.durationMinutes,
        start_time: habitData.startTime,
        end_time: habitData.endTime,
        is_goal: habitData.isGoal,
        target_date: habitData.targetDate,
        reminder_offset: habitData.reminderOffset,
        location_reminders: habitData.locationReminders,
        ...(habitData.goalId ? { goal_id: habitData.goalId } : {}),
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
        locationReminders: data.location_reminders || []
    };

    if (created.reminders && created.reminders.length > 0) {
        await NotificationService.scheduleHabitReminder(created);
    }

    if (cachedHabits) {
        cachedHabits = [created, ...cachedHabits];
        habitsListeners.forEach(l => l(cachedHabits!));
    }

    return created;
}

export async function updateHabit(updatedHabit: Partial<Habit> & { id: string }): Promise<void> {
    const uid = await getUserId();
    if (!uid) return;

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

        // --- NEW: Reschedule Reminder ---
        // We need the full habit object to schedule correctly
        const fullHabit = cachedHabits?.find(h => h.id === updatedHabit.id) ||
            (await getHabits()).find(h => h.id === updatedHabit.id);

        if (fullHabit) {
            await NotificationService.scheduleHabitReminder(fullHabit);
        }
    }
}

export async function removeHabitEverywhere(habitId: string): Promise<void> {
    const { error } = await supabase.from('habits').delete().eq('id', habitId);
    if (error) console.error("Error deleting habit:", error);

    await NotificationService.cancelHabitReminder(habitId);

    if (cachedHabits) {
        cachedHabits = cachedHabits.filter(h => h.id !== habitId);
        habitsListeners.forEach(l => l(cachedHabits!));
    }
}

export async function removeGoalWithLinkedHabits(goalId: string): Promise<void> {
    const habits = cachedHabits || await getHabits();
    const linkedHabits = habits.filter(h => h.goalId === goalId);

    for (const habit of linkedHabits) {
        await removeHabitEverywhere(habit.id);
    }

    await removeHabitEverywhere(goalId);
    DeviceEventEmitter.emit('goal_deleted', { goalId });
}

// --- Completions ---

export async function getCompletions(dateISO?: string): Promise<Record<string, boolean>> {
    const uid = await getUserId();
    if (!uid) return {};

    const dateStr = dateISO ?? todayString();

    if (completionsCache[dateStr]) {
        return completionsCache[dateStr];
    }

    const { data, error } = await supabase
        .from('habit_completions')
        .select('habit_id')
        .eq('user_id', uid)
        .eq('date', dateStr);

    if (error) {
        console.error("Error getting completions:", error);
        return {};
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

    if (!completionsCache[dateStr]) {
        completionsCache[dateStr] = {};
    }

    const wasCompleted = !!completionsCache[dateStr][habitId];
    const newCompleted = !wasCompleted;

    if (newCompleted) {
        completionsCache[dateStr][habitId] = true;
    } else {
        delete completionsCache[dateStr][habitId];
    }

    const optimisticResult = { ...completionsCache[dateStr] };

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
            if (newCompleted) {
                delete completionsCache[dateStr][habitId];
            } else {
                completionsCache[dateStr][habitId] = true;
            }
        }
    })();

    DeviceEventEmitter.emit('habit_completion_updated', { habitId, date: dateStr, completed: newCompleted });

    return optimisticResult;
}

// --- Statistics ---

export async function getLastNDaysCompletions(days: number): Promise<{ date: string; completedIds: string[] }[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - (days - 1));

    const startStr = todayString(startDate);
    const endStr = todayString(endDate);

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
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 365);

    const startStr = todayString(startDate);
    const endStr = todayString(endDate);

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

export async function syncHealthKitData() {
    console.log('[Habits] HealthKit sync placeholder');
}
