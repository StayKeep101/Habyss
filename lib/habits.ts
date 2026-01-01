import { supabase } from '@/lib/supabase';
import { NotificationService } from './notificationService';
import { WidgetSync } from './widgetSync';

// --- In-Memory Cache ---
let cachedHabits: Habit[] | null = null;
let habitsSubscription: any = null;
const habitsListeners: Set<(habits: Habit[]) => void> = new Set();

export type HabitCategory = 'health' | 'fitness' | 'work' | 'personal' | 'mindfulness' | 'misc';
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

// --- Habits CRUD ---

export async function getHabits(): Promise<Habit[]> {
  try {
    const { data, error } = await supabase
      .from('habits')
      .select('*')
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
    description: habitData.description,
    type: habitData.type || 'build',
    color: habitData.color || '#6B46C1',
    goal_period: habitData.goalPeriod || 'daily',
    goal_value: habitData.goalValue || 1,
    unit: habitData.unit || 'count',
    task_days: habitData.taskDays || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    reminders: habitData.reminders || [],
    chart_type: habitData.chartType || 'bar',
    start_date: habitData.startDate || new Date().toISOString(),
    end_date: habitData.endDate,
    is_archived: false,
    show_memo: habitData.showMemo || false,
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

  // Sync Widgets
  syncWidgets();

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
      type: updatedHabit.type,
      color: updatedHabit.color,
      goal_period: updatedHabit.goalPeriod,
      goal_value: updatedHabit.goalValue,
      unit: updatedHabit.unit,
      task_days: updatedHabit.taskDays,
      reminders: updatedHabit.reminders,
      chart_type: updatedHabit.chartType,
      start_date: updatedHabit.startDate,
      end_date: updatedHabit.endDate,
      is_archived: updatedHabit.isArchived,
      show_memo: updatedHabit.showMemo,
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

    // Sync Widgets
    syncWidgets();
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

  // Sync Widgets
  syncWidgets();
}

// --- Completions ---

export async function getCompletions(dateISO?: string): Promise<Record<string, boolean>> {
  const dateStr = dateISO ?? todayString();

  const { data, error } = await supabase
    .from('habit_completions')
    .select('habit_id')
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

export async function toggleCompletion(habitId: string, dateISO?: string): Promise<Record<string, boolean>> {
  const uid = await getUserId();
  if (!uid) return {};

  const dateStr = dateISO ?? todayString();

  // Check if exists
  const { data: existing } = await supabase
    .from('habit_completions')
    .select('id')
    .eq('habit_id', habitId)
    .eq('date', dateStr)
    .single();

  if (existing) {
    await supabase.from('habit_completions').delete().eq('id', existing.id);
  } else {
    await supabase.from('habit_completions').insert({
      user_id: uid,
      habit_id: habitId,
      date: dateStr,
      completed: true
    });

    // Trigger smart motivation if it's evening
    const hour = new Date().getHours();
    if (hour >= 18) { // 6PM or later
      const habits = await getHabits();
      const habit = habits.find(h => h.id === habitId);
      if (habit) {
        // Pass false because the habit was JUST completed
        await NotificationService.sendMotivationIfNeeded(false, habit.name);
      }
    }
  }

  // Sync Widgets
  syncWidgets();

  return getCompletions(dateStr);
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

/**
 * Syncs the latest habit data to the home screen widgets.
 */
export async function syncWidgets() {
  try {
    const habits = await getHabits();
    const completions = await getCompletions();
    const streakData = await getStreakData();

    const today = todayString();
    const todayHabits = habits.filter(h => {
      // Very basic filter: if it's not archived
      if (h.isArchived) return false;

      // Filter by taskDays if available
      if (h.taskDays && h.taskDays.length > 0) {
        const dayMap: Record<string, number> = { 'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6 };
        const todayDay = new Date().getDay();
        const activeDays = h.taskDays.map(d => dayMap[d.toLowerCase()]);
        return activeDays.includes(todayDay);
      }
      return true;
    });

    const totalHabitsToday = todayHabits.length;
    const completedHabitsToday = todayHabits.filter(h => completions[h.id]).length;

    const widgetHabits = todayHabits.map(h => ({
      id: h.id,
      name: h.name,
      completed: !!completions[h.id],
      category: h.category,
      icon: h.icon || 'ellipse-outline'
    }));

    const nextHabit = widgetHabits.find(h => !h.completed);

    await WidgetSync.updateWidgetData({
      completedHabitsToday,
      totalHabitsToday,
      streakDays: streakData.currentStreak,
      todayHabits: widgetHabits,
      nextHabit: nextHabit
    });
  } catch (error) {
    console.error('Error syncing widgets from habits.ts:', error);
  }
}

// --- Integration Management ---

/**
 * Links a habit to an integration data source
 */
export async function linkHabitToIntegration(
  habitId: string,
  serviceName: string,
  dataType: string,
  config: any = {},
  autoComplete: boolean = true
): Promise<void> {
  const { SyncCoordinator } = await import('./syncCoordinator');
  await SyncCoordinator.linkHabitToIntegration(habitId, serviceName, dataType, config, autoComplete);
}

/**
 * Unlinks a habit from an integration
 */
export async function unlinkHabitFromIntegration(
  habitId: string,
  serviceName: string,
  dataType: string
): Promise<void> {
  const { SyncCoordinator } = await import('./syncCoordinator');
  await SyncCoordinator.unlinkHabitFromIntegration(habitId, serviceName, dataType);
}

/**
 * Gets all integration mappings for a habit
 */
export async function getHabitIntegrations(habitId: string): Promise<any[]> {
  const { SyncCoordinator } = await import('./syncCoordinator');
  return await SyncCoordinator.getHabitIntegrations(habitId);
}

/**
 * Syncs habit from integrations and auto-completes if needed
 */
export async function syncHabitFromIntegrations(habitId: string): Promise<void> {
  const { SyncCoordinator } = await import('./syncCoordinator');
  await SyncCoordinator.syncAllIntegrations();
}
