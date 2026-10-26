import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateId } from './database';

/**
 * Progress written straight onto a goal: "ran 4 km today", "saved $300",
 * "weighed 82 kg", "GPA is 3.5". For anything you measure rather than tick:
 * a goal adds them up (books, dollars), keeps the best (the longest run), or
 * keeps the latest (a weight, a GPA, a net worth), depending on what it is
 * (lib/goalInsights.ts measureByDay). Kept on this phone and in the personal
 * backup.
 */
export interface GoalLog { id: string; date: string; amount: number }

const KEY = 'habyss_goal_logs';
let state: Record<string, GoalLog[]> = {};
let loaded = false;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach(listener => listener());

export const currentGoalLogs = (): Record<string, GoalLog[]> => state;
export function subscribeGoalLogs(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export async function loadGoalLogs(): Promise<Record<string, GoalLog[]>> {
    if (loaded) return state;
    try {
        const raw = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}');
        if (raw && typeof raw === 'object') state = raw;
    } catch { /* none yet */ }
    loaded = true;
    changed();
    return state;
}

async function save(next: Record<string, GoalLog[]>) {
    state = next;
    changed();
    await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
}

export async function addGoalLog(goalId: string, date: string, amount: number): Promise<void> {
    await loadGoalLogs();
    if (!Number.isFinite(amount)) return;
    const list = [...(state[goalId] ?? []), { id: generateId(), date, amount }].sort((a, b) => a.date.localeCompare(b.date));
    await save({ ...state, [goalId]: list });
}

export async function removeGoalLog(goalId: string, id: string): Promise<void> {
    await loadGoalLogs();
    await save({ ...state, [goalId]: (state[goalId] ?? []).filter(log => log.id !== id) });
}
