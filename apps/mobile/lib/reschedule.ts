import AsyncStorage from '@react-native-async-storage/async-storage';
// Shared with the Mac: packages/core/src/reschedule.ts (the rules). What stays here is the phone's own part.
import { type Reschedules } from '@habyss/core/reschedule';
export * from '@habyss/core/reschedule';

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

/** Reschedules `id` at `minute` (minutes from midnight) on `day`. */
export async function reschedule(day: string, id: string, minute: number): Promise<void> {
    await loadReschedules();
    state = { day, at: { ...(state.day === day ? state.at : {}), [id]: Math.max(0, Math.round(minute)) } };
    listeners.forEach(listener => listener());
    await AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => undefined);
    void (require('./dayInputsSync') as typeof import('./dayInputsSync')).markDayInputsDirty('habyss_reschedules');
}

/** The stored copy changed underneath (another device): read it again. */
export async function reloadReschedules(): Promise<void> {
    loaded = false;
    await loadReschedules();
}
