import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Meals and calendar events that finished early today ("class let out at
 * 2:10"), and the minute each one did. The timeline ends them there (lib/dayFlow.ts
 * rule 6) and what comes next moves up into the time they gave back. Today
 * only, kept on this phone; a new day starts empty.
 */
export interface EndedEarly { day: string; at: Record<string, number> }

const KEY = 'habyss_ended_early';
let state: EndedEarly = { day: '', at: {} };
let loaded = false;
const listeners = new Set<() => void>();

export const currentEndedEarly = (): EndedEarly => state;
export function subscribeEndedEarly(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export async function loadEndedEarly(): Promise<EndedEarly> {
    if (loaded) return state;
    try {
        const raw = JSON.parse((await AsyncStorage.getItem(KEY)) ?? 'null');
        if (raw && typeof raw.day === 'string' && raw.at && typeof raw.at === 'object') state = raw;
    } catch { /* start empty */ }
    loaded = true;
    listeners.forEach(listener => listener());
    return state;
}

export const endedFor = (all: EndedEarly, day: string): Record<string, number> => (all.day === day ? all.at : {});

/** Ends `id` at `minute` on `day`, or takes that back when it was already ended. */
export async function toggleEndedEarly(day: string, id: string, minute: number): Promise<void> {
    await loadEndedEarly();
    const at = { ...(state.day === day ? state.at : {}) };
    if (at[id] !== undefined) delete at[id]; else at[id] = Math.max(0, Math.round(minute));
    state = { day, at };
    listeners.forEach(listener => listener());
    await AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => undefined);
    void (require('./dayInputsSync') as typeof import('./dayInputsSync')).markDayInputsDirty('habyss_ended_early');
}

/** The stored copy changed underneath (another device): read it again. */
export async function reloadEndedEarly(): Promise<void> {
    loaded = false;
    await loadEndedEarly();
}
