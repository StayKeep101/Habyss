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

export async function updateHabit(updatedHabit: Habit): Promise<void> {
  const habits = await getHabits();
  const index = habits.findIndex(h => h.id === updatedHabit.id);
  if (index !== -1) {
    habits[index] = updatedHabit;
    await saveHabits(habits);
  }
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

export async function getStreakData(): Promise<{ currentStreak: number; bestStreak: number; perfectDays: number; totalCompleted: number }> {
  // Retrieve last 365 days of data
  const history = await getLastNDaysCompletions(365);
  const habits = await getHabits();
  const totalHabitCount = habits.length;

  if (totalHabitCount === 0) return { currentStreak: 0, bestStreak: 0, perfectDays: 0, totalCompleted: 0 };

  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 0;
  let perfectDays = 0;
  let totalCompleted = 0;

  // Process from oldest to newest for Best Streak and Perfect Days
  history.forEach(day => {
    const completedCount = day.completedIds.length;
    totalCompleted += completedCount;

    // Check for "Perfect Day" (all habits completed)
    // We assume totalHabitCount is constant for simplicity, though historically it might change.
    // A more robust way would be to check historical habit counts if we tracked creation dates strictly.
    // For now, if completedCount >= totalHabitCount (and > 0), it's perfect.
    if (completedCount > 0 && completedCount >= totalHabitCount) {
      perfectDays++;
    }

    // Streak Logic: At least 1 habit completed counts as "active" for the day?
    // OR: Streak usually implies hitting your goals. Let's say > 50% completion keeps streak alive?
    // user likely wants "Did I do my habits?". Let's go with > 0 for now as a "Activity Streak".
    // Or stricter: All habits? Let's stick to > 0 is "Active Day".
    if (completedCount > 0) {
      tempStreak++;
    } else {
      bestStreak = Math.max(bestStreak, tempStreak);
      tempStreak = 0;
    }
  });
  
  // Final check for best streak
  bestStreak = Math.max(bestStreak, tempStreak);

  // Calculate Current Streak (working backwards from today)
  // We need to check if today is completed (or in progress)
  // If today has 0, but yesterday had >0, streak is still alive (just not incremented for today yet)
  // Actually, usually streak includes today if done, or up to yesterday.
  const today = history[history.length - 1];
  const yesterday = history[history.length - 2];
  
  // Simple backward check
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].completedIds.length > 0) {
          streak++;
      } else {
          // If it's today and 0, we don't break yet if we just want to see "yesterday's streak"
          // But "Current Streak" usually implies unbroken chain.
          // If I haven't done today's yet, my streak is technically what it was yesterday.
          // However, if I missed yesterday, it's 0.
          if (i === history.length - 1) continue; // Skip today if 0, effectively
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
  // Last 90 days
  const history = await getLastNDaysCompletions(91); // 13 weeks x 7
  return history.map(h => ({
    date: h.date,
    count: h.completedIds.length
  }));
}
