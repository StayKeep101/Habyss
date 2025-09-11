import AsyncStorage from '@react-native-async-storage/async-storage';

export type HabitCategory = 'health' | 'productivity' | 'fitness' | 'mindfulness';

export interface Habit {
  id: string;
  name: string;
  icon?: string; // Ionicons name
  category: HabitCategory;
  createdAt: string; // ISO date
  durationMinutes?: number; // optional time factor per session
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

export async function addHabit(name: string, category: HabitCategory = 'productivity', icon?: string, durationMinutes?: number): Promise<Habit> {
  const habits = await getHabits();
  const newHabit: Habit = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    category,
    icon,
    createdAt: new Date().toISOString(),
    durationMinutes,
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


