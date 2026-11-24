import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Your few words after doing a habit: how it went, what you noticed. Asked
 * for the moment you tick it (components/Habit/HabitThoughtPopup.tsx), read
 * back on the habit's page, newest first (components/Habit/HabitThoughts.tsx).
 * One per habit a day (writing again that day replaces it). Kept on this
 * phone, the last 365 per habit.
 */
const KEY = 'habyss_habit_thoughts';
const KEEP = 365;
const MAX_LENGTH = 600;

export type HabitThought = { date: string; text: string; at: string };
type Store = Record<string, HabitThought[]>;

let store: Store = {};
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();
const publish = () => listeners.forEach(listener => listener());

export function loadHabitThoughts(): Promise<void> {
    if (!loaded) {
        loaded = (async () => {
            try {
                const raw = await AsyncStorage.getItem(KEY);
                if (raw) store = JSON.parse(raw) as Store;
            } catch { /* none yet */ }
            publish();
        })();
    }
    return loaded;
}

/** A habit's thoughts, newest first. */
export const habitThoughts = (habitId: string): HabitThought[] => store[habitId] ?? [];

export function subscribeHabitThoughts(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

/** Adds the day's thought (or replaces it), or, with no words, takes it away. */
export function withThought(list: HabitThought[], date: string, text: string, at: string): HabitThought[] {
    const words = text.trim().slice(0, MAX_LENGTH);
    const rest = list.filter(item => item.date !== date);
    const next = words ? [{ date, text: words, at }, ...rest] : rest;
    return next.sort((a, b) => (a.date === b.date ? b.at.localeCompare(a.at) : b.date.localeCompare(a.date))).slice(0, KEEP);
}

export async function setHabitThought(habitId: string, date: string, text: string, now = new Date()): Promise<void> {
    await loadHabitThoughts();
    const next = withThought(store[habitId] ?? [], date, text, now.toISOString());
    store = { ...store, [habitId]: next };
    if (!next.length) delete store[habitId];
    publish();
    await AsyncStorage.setItem(KEY, JSON.stringify(store)).catch(() => undefined);
}

/** Removes a habit's thoughts along with it. */
export async function forgetHabitThoughts(habitId: string): Promise<void> {
    await loadHabitThoughts();
    if (!store[habitId]) return;
    const { [habitId]: _gone, ...rest } = store;
    store = rest;
    publish();
    await AsyncStorage.setItem(KEY, JSON.stringify(store)).catch(() => undefined);
}
