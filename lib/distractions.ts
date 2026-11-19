import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Got distracted: one tap during focus, counted. Time focused says how long;
 * this says how often you were pulled away, the honest number self-reports
 * miss (people feel faster and more focused than they measure).
 */
const KEY = 'habyss_distractions';
export interface Distraction { date: string; itemId: string | null; at: number }

let list: Distraction[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach(listener => listener());

export async function loadDistractions(): Promise<Distraction[]> {
    if (loaded) return list;
    try {
        const raw = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]');
        list = Array.isArray(raw) ? raw : [];
    } catch { list = []; }
    loaded = true;
    changed();
    return list;
}

/** One more, kept for 90 days. */
export async function addDistraction(date: string, itemId: string | null, now = Date.now()): Promise<void> {
    await loadDistractions();
    const floor = now - 90 * 86400000;
    list = [...list.filter(item => item.at >= floor), { date, itemId, at: now }];
    changed();
    await AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => undefined);
}

/** How many between two days, inclusive; for one item when given. Pure. */
export const distractionsBetween = (all: Distraction[], from: string, to: string, itemId?: string): number =>
    all.filter(item => item.date >= from && item.date <= to && (itemId === undefined || item.itemId === itemId)).length;

export const currentDistractions = (): Distraction[] => list;
export function subscribeDistractions(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
