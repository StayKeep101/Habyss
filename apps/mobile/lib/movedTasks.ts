import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TaskMove } from './missed';

/**
 * The tasks the timeline carried to the next day because there was no room
 * before bedtime, so "Missed" can say so. Kept on this phone, last 60 days.
 */
const KEY = 'habyss_moved_tasks';
let state: TaskMove[] = [];
let loaded = false;
const listeners = new Set<() => void>();

export const currentMoves = (): TaskMove[] => state;
export function subscribeMoves(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export async function loadMoves(): Promise<TaskMove[]> {
    if (loaded) return state;
    try {
        const raw = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]');
        if (Array.isArray(raw)) state = raw.filter(move => move && typeof move.id === 'string' && typeof move.from === 'string');
    } catch { /* none yet */ }
    loaded = true;
    listeners.forEach(listener => listener());
    return state;
}

export async function logMoves(moves: TaskMove[]): Promise<void> {
    if (!moves.length) return;
    await loadMoves();
    const cutoff = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
    const seen = new Set(moves.map(move => `${move.id}:${move.from}`));
    state = [...state.filter(move => move.from >= cutoff && !seen.has(`${move.id}:${move.from}`)), ...moves];
    listeners.forEach(listener => listener());
    await AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => undefined);
}
