import { supabase } from '@/lib/supabase';
import { NotificationService } from './notificationService';
import { WidgetService } from './widgetService';

// --- In-Memory Cache ---
let cachedHabits: Habit[] | null = null;
let habitsSubscription: any = null;
const habitsListeners: Set<(habits: Habit[]) => void> = new Set();

// Completion cache for optimistic updates - keyed by dateStr
const completionsCache: Record<string, Record<string, boolean>> = {};

export type HabitCategory = 'health' | 'fitness' | 'work' | 'personal' | 'mindfulness' | 'misc' | 'productivity' | 'learning' | 'creativity' | 'social';
export type HabitType = 'build' | 'quit';
export type GoalPeriod = 'daily' | 'weekly' | 'monthly';
export type ChartType = 'bar' | 'line';

export interface Habit {
  id: string;
  name: string;
  description?: string;
  icon?: string; // Ionicons name
  category: HabitCategory;
  createdAt: string; // ISO date
  durationMinutes?: number; // optional time factor per session
  startTime?: string; // 'HH:mm'
  endTime?: string;   // 'HH:mm'
  isGoal?: boolean; // true if this is a goal with target date
  targetDate?: string; // ISO date for goal target
  type: HabitType;
  color: string;
  goalPeriod: GoalPeriod;
  goalValue: number;
  unit: string;
  taskDays: string[]; // ['mon', 'tue', ...]
  reminders: string[]; // ['09:00', ...]
  chartType: ChartType;
  startDate: string; // YYYY-MM-DD
  endDate?: string;
  isArchived: boolean;
  showMemo: boolean;
  goalId?: string; // ID of the goal this habit belongs to
}

const todayString = (d = new Date()) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export async function getUserId(): Promise<string | undefined> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id;
}

// --- Habits Real-time Subscription ---

async function setupHabitsListener() {
  if (habitsSubscription) return; // Already listening

  const uid = await getUserId();
  if (!uid) return;

  habitsSubscription = supabase
    .channel('public:habits')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'habits', filter: `user_id=eq.${uid}` }, () => {
      // Reload habits when any change occurs
      getHabits().then(habits => {
        habitsListeners.forEach(listener => listener(habits));
      });
    })
    .subscribe();
}

export async function subscribeToHabits(callback: (habits: Habit[]) => void): Promise<() => void> {
  // If we have cache, return it immediately
  if (cachedHabits) {
    callback(cachedHabits);
  } else {
    // Fetch initially
    getHabits().then(callback);
  }

  // Start listener if not started
  setupHabitsListener();

  habitsListeners.add(callback);

  return () => {
    habitsListeners.delete(callback);
  };
}

/**
 * Clear all cached data - call when user logs out or switches accounts
 */
export function clearHabitsCache() {
  cachedHabits = null;
  habitsListeners.clear();
  if (habitsSubscription) {
    supabase.removeChannel(habitsSubscription);
    habitsSubscription = null;
  }
}

// --- Habits CRUD ---

export async function getHabits(): Promise<Habit[]> {
  const uid = await getUserId();
  if (!uid) return []; // No user = no habits

  try {
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', uid) // CRITICAL: Filter by user_id
      .order('created_at', { ascending: false });

    if (error) throw error;

    const habits: Habit[] = data.map((row: any) => ({
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
      goalId: row.goal_id
    }));

    cachedHabits = habits;
    return habits;
  } catch (e) {
    console.error('Error fetching habits:', e);
    return cachedHabits || [];
  }
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
    // description: habitData.description, // Missing in DB
    // type: habitData.type || 'build', // Missing in DB
    // color: habitData.color || '#6B46C1', // Missing in DB
    // goal_period: habitData.goalPeriod || 'daily', // Missing in DB
    // goal_value: habitData.goalValue || 1, // Missing in DB
    // unit: habitData.unit || 'count', // Missing in DB
    // task_days: habitData.taskDays || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], // Missing in DB
    // reminders: habitData.reminders || [], // Missing in DB
    // chart_type: habitData.chartType || 'bar', // Missing in DB
    // start_date: habitData.startDate || new Date().toISOString(), // Missing in DB
    // end_date: habitData.endDate, // Missing in DB
    // is_archived: false, // Missing in DB
    // show_memo: habitData.showMemo || false, // Missing in DB
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

  // Refresh cache
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
    type: data.type,
    color: data.color,
    goalPeriod: data.goal_period,
    goalValue: data.goal_value,
    unit: data.unit,
    taskDays: data.task_days,
    reminders: data.reminders,
    chartType: data.chart_type,
    startDate: data.start_date,
    endDate: data.end_date,
    isArchived: data.is_archived || false,
    showMemo: data.show_memo || false,
    goalId: data.goal_id
  };

  // Schedule notifications
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

  const { error } = await supabase
    .from('habits')
    .update({
      name: updatedHabit.name,
      description: updatedHabit.description,
      category: updatedHabit.category,
      icon: updatedHabit.icon,
      duration_minutes: updatedHabit.durationMinutes,
      start_time: updatedHabit.startTime,
      end_time: updatedHabit.endTime,
      is_goal: updatedHabit.isGoal,
      target_date: updatedHabit.targetDate,
      // description: updatedHabit.description,
      // type: updatedHabit.type,
      // color: updatedHabit.color, // DB schema missing
      // goal_period: updatedHabit.goalPeriod,
      // goal_value: updatedHabit.goalValue,
      // unit: updatedHabit.unit,
      // task_days: updatedHabit.taskDays,
      // reminders: updatedHabit.reminders,
      // chart_type: updatedHabit.chartType, // Not in DB yet
      // start_date: updatedHabit.startDate,
      // end_date: updatedHabit.endDate,
      // is_archived: updatedHabit.isArchived,
      // show_memo: updatedHabit.showMemo,
      ...(updatedHabit.goalId ? { goal_id: updatedHabit.goalId } : {})
    })
    .eq('id', updatedHabit.id);

  if (error) {
    console.error("Error updating habit:", error);
  } else {
    // Update notifications
    if (updatedHabit.reminders) {
      const fullHabit = cachedHabits?.find(h => h.id === updatedHabit.id);
      if (fullHabit) {
        await NotificationService.scheduleHabitReminder({ ...fullHabit, ...updatedHabit } as Habit);
      }
    }

    if (cachedHabits) {
      cachedHabits = cachedHabits.map(h => h.id === updatedHabit.id ? { ...h, ...updatedHabit } as Habit : h);
      habitsListeners.forEach(l => l(cachedHabits!));
    }
  }
}

export async function removeHabitEverywhere(habitId: string): Promise<void> {
  const { error } = await supabase.from('habits').delete().eq('id', habitId);
  if (error) console.error("Error deleting habit:", error);

  // Cancel notifications
  await NotificationService.cancelHabitReminder(habitId);

  // Cache update handled by listener or manual refresh
  if (cachedHabits) {
    cachedHabits = cachedHabits.filter(h => h.id !== habitId);
    habitsListeners.forEach(l => l(cachedHabits!));
  }
}

// --- Completions ---

export async function getCompletions(dateISO?: string): Promise<Record<string, boolean>> {
  const uid = await getUserId();
  if (!uid) return {}; // No user = no completions

  const dateStr = dateISO ?? todayString();

  // Return cached data immediately if available for this date
  if (completionsCache[dateStr]) {
    // Refresh cache in background (don't await)
    refreshCompletionsCache(dateStr, uid);
    return completionsCache[dateStr];
  }

  // Initial fetch
  const result = await fetchCompletionsFromDB(dateStr, uid);
  completionsCache[dateStr] = result;
  return result;
}

// Internal: fetch from database
async function fetchCompletionsFromDB(dateStr: string, uid: string): Promise<Record<string, boolean>> {
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
  data.forEach((row: any) => {
    result[row.habit_id] = true;
  });
  return result;
}

// Internal: refresh cache in background with size limit
const MAX_CACHE_ENTRIES = 14; // Only keep 2 weeks of completion data in memory
async function refreshCompletionsCache(dateStr: string, uid: string) {
  const result = await fetchCompletionsFromDB(dateStr, uid);
  completionsCache[dateStr] = result;

  // Limit cache size to prevent memory bloat
  const keys = Object.keys(completionsCache);
  if (keys.length > MAX_CACHE_ENTRIES) {
    // Remove oldest entries (sort by date string)
    keys.sort();
    const toRemove = keys.slice(0, keys.length - MAX_CACHE_ENTRIES);
    toRemove.forEach(key => delete completionsCache[key]);
  }
}

export async function toggleCompletion(habitId: string, dateISO?: string): Promise<Record<string, boolean>> {
  const uid = await getUserId();
  if (!uid) return {};

  const dateStr = dateISO ?? todayString();

  // Initialize cache for this date if not exists
  if (!completionsCache[dateStr]) {
    completionsCache[dateStr] = {};
  }

  // OPTIMISTIC UPDATE: Toggle in cache IMMEDIATELY
  const wasCompleted = !!completionsCache[dateStr][habitId];
  const newCompleted = !wasCompleted;

  if (newCompleted) {
    completionsCache[dateStr][habitId] = true;
  } else {
    delete completionsCache[dateStr][habitId];
  }

  // Return the updated cache immediately for instant UI response
  const optimisticResult = { ...completionsCache[dateStr] };

  // Now do the database operation in background (don't block UI)
  (async () => {
    try {
      if (wasCompleted) {
        // Delete completion
        await supabase
          .from('habit_completions')
          .delete()
          .eq('user_id', uid)
          .eq('habit_id', habitId)
          .eq('date', dateStr);
      } else {
        // Insert completion
        await supabase.from('habit_completions').insert({
          user_id: uid,
          habit_id: habitId,
          date: dateStr,
          completed: true
        });

        // Trigger completion notification
        const habits = await getHabits();
        const habit = habits.find(h => h.id === habitId);
        if (habit) {
          await NotificationService.sendCompletionNotification(habit.name);
        }
      }

      // Widget update would be called here with proper data
      // WidgetService.updateTimeline(widgetData);
    } catch (error) {
      console.error('Error toggling completion:', error);
      // Revert optimistic update on error
      if (newCompleted) {
        delete completionsCache[dateStr][habitId];
      } else {
        completionsCache[dateStr][habitId] = true;
      }
    }
  })();

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
  data.forEach((row: any) => {
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
  // For streak, we need efficient query.
  // This is a heavy operation if we fetch everything.
  // We'll use the same logic as before but with Supabase data.

  const history = await getLastNDaysCompletions(90);
  const habits = await getHabits();
  const totalHabitCount = habits.length;

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

  // Calculate Current Streak
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

  return {
    currentStreak,
    bestStreak,
    perfectDays,
    totalCompleted
  };
}

export async function getHeatmapData(): Promise<{ date: string; count: number }[]> {
  const history = await getLastNDaysCompletions(91);
  return history.map(h => ({
    date: h.date,
    count: h.completedIds.length
  }));
}

