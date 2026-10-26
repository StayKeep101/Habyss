import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Travel time around a calendar event: an hour to get to school and an hour
 * back means 11:30–12:50 School keeps 10:30–1:50 free of work. Kept per event
 * name ("School"), so every School in the calendar gets it; the timeline
 * shows the travel as its own fixed rows, which nothing is planned inside.
 */
export interface Travel { before: number; after: number }

const KEY = 'habyss_event_travel';
let state: Record<string, Travel> = {};
let loaded = false;
const listeners = new Set<() => void>();

export const travelKey = (title: string) => title.trim().toLowerCase().replace(/\s+/g, ' ');
export const currentTravel = (): Record<string, Travel> => state;
export function subscribeTravel(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export async function loadTravel(): Promise<Record<string, Travel>> {
    if (loaded) return state;
    try {
        const raw = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}');
        if (raw && typeof raw === 'object') state = raw;
    } catch { /* none set */ }
    loaded = true;
    listeners.forEach(listener => listener());
    return state;
}

export function travelFor(title: string, all: Record<string, Travel> = state): Travel {
    return all[travelKey(title)] ?? { before: 0, after: 0 };
}

export async function setTravel(title: string, travel: Travel): Promise<void> {
    await loadTravel();
    const next = { ...state };
    const clean = { before: Math.max(0, Math.min(240, Math.round(travel.before))), after: Math.max(0, Math.min(240, Math.round(travel.after))) };
    if (!clean.before && !clean.after) delete next[travelKey(title)];
    else next[travelKey(title)] = clean;
    state = next;
    listeners.forEach(listener => listener());
    await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
}
