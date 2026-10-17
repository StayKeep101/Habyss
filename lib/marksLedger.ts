import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDateKey } from './habitSchedule';
import { penaltiesOf, type KeptPenalty } from './marks';

/**
 * The misses of things that were deleted.
 *
 * Marks are read back from what is on your lists, so deleting something takes
 * back everything it earned: adding and deleting is always break-even. But it
 * would also erase every day it was missed, which made deleting a neglected
 * habit a way to climb. So just before something is deleted, its misses are
 * written here and keep counting. One copy in memory for every screen.
 */
const KEY = 'habyss_marks_kept';
let kept: KeptPenalty[] = [];
let loaded = false;
const listeners = new Set<() => void>();

export const currentKept = (): KeptPenalty[] => kept;
export function subscribeKept(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export async function loadKept(): Promise<KeptPenalty[]> {
    if (loaded) return kept;
    loaded = true;
    try {
        const raw = await AsyncStorage.getItem(KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed) && parsed.length) { kept = parsed; listeners.forEach(listener => listener()); }
    } catch { /* starts empty */ }
    return kept;
}

/**
 * Call before deleting habits, goals or tasks. Never throws: a delete must
 * not fail because the ledger could not be written.
 */
export async function keepPenaltiesOf(ids: { habits?: string[]; tasks?: string[] }): Promise<void> {
    try {
        await loadKept();
        const { loadedData } = require('./dataStore') as typeof import('./dataStore');
        const { getHabits } = require('./habitsSQLite') as typeof import('./habitsSQLite');
        const [data, habits] = await Promise.all([loadedData(), getHabits()]);
        const found = penaltiesOf({ habits, tasks: data.tasks, history: data.history, skips: data.skips, today: localDateKey(new Date()) }, ids);
        if (!found.length) return;
        kept = [...kept, ...found];
        listeners.forEach(listener => listener());
        await AsyncStorage.setItem(KEY, JSON.stringify(kept));
    } catch { /* the delete goes ahead regardless */ }
}
