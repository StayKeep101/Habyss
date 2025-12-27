import AsyncStorage from '@react-native-async-storage/async-storage';

export type HabitCategory = 'health' | 'fitness' | 'work' | 'personal' | 'mindfulness' | 'misc';

export interface Habit {
  id: string;
  name: string;
  icon?: string; // Ionicons name
  category: HabitCategory;
  createdAt: string; // ISO date
  durationMinutes?: number; // optional time factor per session
  startTime?: string; // 'HH:mm'
  endTime?: string;   // 'HH:mm'
  isGoal?: boolean; // true if this is a goal with target date
  targetDate?: string; // ISO date for goal target
}

const HABITS_KEY = 'habyss_habits_v1';
const COMPLETIONS_PREFIX = 'habyss_completions_v1_'; // + YYYY-MM-DD

const todayString = (d = new Date()) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export async function getHabits(): Promise<Habit[]> {
  const raw = await AsyncStorage.getItem(HABITS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Habit[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveHabits(habits: Habit[]): Promise<void> {
  await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(habits));
}

export async function addHabit(
  name: string,
  category: HabitCategory = 'work',
  icon?: string,
  durationMinutes?: number,
  startTime?: string,
  endTime?: string,
  isGoal?: boolean,
  targetDate?: string,
): Promise<Habit> {
  const habits = await getHabits();
  const newHabit: Habit = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    category,
    icon,
    createdAt: new Date().toISOString(),
    durationMinutes,
    startTime,
    endTime,
    isGoal,
    targetDate,
  };
  const updated = [newHabit, ...habits];
  await saveHabits(updated);
  return newHabit;
}

export async function removeHabit(habitId: string): Promise<void> {
  const habits = await getHabits();
  const updated = habits.filter(h => h.id !== habitId);
  await saveHabits(updated);
}

/** Remove a habit and strip it from all stored completion days */
export async function removeHabitEverywhere(habitId: string): Promise<void> {
  await removeHabit(habitId);
  try {
    const keys = await AsyncStorage.getAllKeys();
    const completionKeys = keys.filter((k) => k.startsWith(COMPLETIONS_PREFIX));
    if (completionKeys.length === 0) return;
    const pairs = await AsyncStorage.multiGet(completionKeys);
    const updates: [string, string][] = [];
    for (const [key, value] of pairs) {
      if (!value) continue;
      try {
        const obj = JSON.parse(value) as Record<string, boolean>;
        if (obj && Object.prototype.hasOwnProperty.call(obj, habitId)) {
          delete obj[habitId];
          updates.push([key, JSON.stringify(obj)]);
        }
      } catch {
        // ignore malformed
      }
    }
    if (updates.length > 0) {
      await AsyncStorage.multiSet(updates);
    }
  } catch {
    // ignore failures; habit already removed
  }
}

export async function getCompletions(dateISO?: string): Promise<Record<string, boolean>> {
  const key = COMPLETIONS_PREFIX + (dateISO ?? todayString());
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed ?? {};
  } catch {
    return {};
  }
}

export async function setCompletions(dateISO: string, data: Record<string, boolean>): Promise<void> {
  const key = COMPLETIONS_PREFIX + dateISO;
  await AsyncStorage.setItem(key, JSON.stringify(data));
}

export async function toggleCompletion(habitId: string, dateISO?: string): Promise<Record<string, boolean>> {
  const dateStr = dateISO ?? todayString();
  const current = await getCompletions(dateStr);
  const next = { ...current, [habitId]: !current[habitId] };
  await setCompletions(dateStr, next);
  return next;
}

export async function getLastNDaysCompletions(days: number): Promise<{ date: string; completedIds: string[] }[]> {
  const result: { date: string; completedIds: string[] }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = todayString(d);
    const c = await getCompletions(dateStr);
    result.push({ date: dateStr, completedIds: Object.keys(c).filter(id => !!c[id]) });
  }
  return result;
}

export async function getGoalTargetDate(): Promise<string | null> {
  const habits = await getHabits();
  const goal = habits.find(h => h.isGoal && h.targetDate);
  return goal?.targetDate || null;
}

// Get completion data for the last N days
export async function getCompletionDataForDays(days: number): Promise<{
  date: string;
  totalHabits: number;
  completedHabits: number;
  completionRate: number;
}[]> {
  const habits = await getHabits();
  const totalHabits = habits.length;
  const result: {
    date: string;
    totalHabits: number;
    completedHabits: number;
    completionRate: number;
  }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = todayString(date);
    const completions = await getCompletions(dateStr);
    const completedCount = Object.values(completions).filter(Boolean).length;
    const completionRate = totalHabits > 0 ? (completedCount / totalHabits) * 100 : 0;

    result.push({
      date: dateStr,
      totalHabits,
      completedHabits: completedCount,
      completionRate,
    });
  }

  return result;
}

// Get weekly completion data (last 7 days)
export async function getWeeklyCompletionData(): Promise<{
  date: string;
  totalHabits: number;
  completedHabits: number;
  completionRate: number;
}[]> {
  return getCompletionDataForDays(7);
}

// Get monthly completion data (last 30 days)
export async function getMonthlyCompletionData(): Promise<{
  date: string;
  totalHabits: number;
  completedHabits: number;
  completionRate: number;
}[]> {
  return getCompletionDataForDays(30);
}

// Get yearly completion data (last 12 months)
export async function getYearlyCompletionData(): Promise<{
  month: string;
  year: number;
  totalHabits: number;
  completedHabits: number;
  completionRate: number;
}[]> {
  const habits = await getHabits();
  const totalHabits = habits.length;
  const result: {
    month: string;
    year: number;
    totalHabits: number;
    completedHabits: number;
    completionRate: number;
  }[] = [];

  for (let i = 11; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthStr = date.toLocaleDateString('en-US', { month: 'short' });
    const year = date.getFullYear();
    
    // Get all days in this month
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    let totalCompleted = 0;
    let totalDays = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const checkDate = new Date(date.getFullYear(), date.getMonth(), day);
      if (checkDate <= new Date()) { // Only count days up to today
        const dateStr = todayString(checkDate);
        const completions = await getCompletions(dateStr);
        const completedCount = Object.values(completions).filter(Boolean).length;
        totalCompleted += completedCount;
        totalDays++;
      }
    }

    const completionRate = totalDays > 0 ? (totalCompleted / (totalDays * totalHabits)) * 100 : 0;

    result.push({
      month: monthStr,
      year,
      totalHabits,
      completedHabits: Math.round(totalCompleted / totalDays) || 0,
      completionRate,
    });
  }

  return result;
}

// Get habit completion breakdown by category
export async function getHabitCompletionByCategory(): Promise<{
  category: string;
  totalHabits: number;
  completedHabits: number;
  completionRate: number;
}[]> {
  const habits = await getHabits();
  const categories: { [key: string]: { total: number; completed: number } } = {};
  
  // Initialize categories
  habits.forEach(habit => {
    if (!categories[habit.category]) {
      categories[habit.category] = { total: 0, completed: 0 };
    }
    categories[habit.category].total++;
  });

  // Get today's completions
  const completions = await getCompletions();
  
  // Count completions by category
  habits.forEach(habit => {
    if (completions[habit.id]) {
      categories[habit.category].completed++;
    }
  });

  return Object.entries(categories).map(([category, data]) => ({
    category: category.charAt(0).toUpperCase() + category.slice(1),
    totalHabits: data.total,
    completedHabits: data.completed,
    completionRate: data.total > 0 ? (data.completed / data.total) * 100 : 0,
  }));
}


