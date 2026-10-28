import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Rule 5 (lib/dayFlow.ts): habits and tasks rescheduled today by a swipe, and
 * the minute each one was. Today only, kept on this phone; a new day starts
 * empty.
 */
export interface Reschedules { day: string; at: Record<string, number> }

const KEY = 'habyss_reschedules';
let state: Reschedules = { day: '', at: {} };
let loaded = false;
const listeners = new Set<() => void>();

export const currentReschedules = (): Reschedules => state;
export function subscribeReschedules(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export async function loadReschedules(): Promise<Reschedules> {
    if (loaded) return state;
    try {
        const raw = JSON.parse((await AsyncStorage.getItem(KEY)) ?? 'null');
        if (raw && typeof raw.day === 'string' && raw.at && typeof raw.at === 'object') state = raw;
    } catch { /* start empty */ }
    loaded = true;
    listeners.forEach(listener => listener());
    return state;
}

/** Today's reschedules for `day`, or none when they were made on another day. */
export const reschedulesFor = (all: Reschedules, day: string): Record<string, number> => (all.day === day ? all.at : {});

/** Reschedules `id` at `minute` (minutes from midnight) on `day`. */
export async function reschedule(day: string, id: string, minute: number): Promise<void> {
    await loadReschedules();
    state = { day, at: { ...(state.day === day ? state.at : {}), [id]: Math.max(0, Math.round(minute)) } };
    listeners.forEach(listener => listener());
    await AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => undefined);
}
