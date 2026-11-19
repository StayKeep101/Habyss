import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * At most three goals in focus at once; the rest are kept going, not grown.
 * Too many goals split attention (goal-setting research; OKR practice caps
 * objectives at three), so a fourth is only taken on by setting one down.
 * A goal never chosen fills a free focus place, oldest first.
 */
export type GoalMode = 'focus' | 'maintain';
export const MAX_FOCUS = 3;
const KEY = 'habyss_goal_focus';

let stored: Record<string, GoalMode> = {};
let loaded = false;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach(listener => listener());

export async function loadGoalFocus(): Promise<Record<string, GoalMode>> {
    if (loaded) return stored;
    try {
        const raw = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}');
        stored = raw && typeof raw === 'object' ? raw : {};
    } catch { stored = {}; }
    loaded = true;
    changed();
    return stored;
}

/** Each goal's mode, from what was chosen; the unchosen fill the free focus places in the order given. Pure. */
export function goalModes(goalIds: string[], chosen: Record<string, GoalMode>): Record<string, GoalMode> {
    const out: Record<string, GoalMode> = {};
    let focus = goalIds.filter(id => chosen[id] === 'focus').slice(0, MAX_FOCUS);
    for (const id of goalIds) {
        if (chosen[id] === 'maintain') out[id] = 'maintain';
        else if (focus.includes(id)) out[id] = 'focus';
        else if (!chosen[id] && focus.length < MAX_FOCUS) { focus = [...focus, id]; out[id] = 'focus'; }
        else out[id] = 'maintain';
    }
    return out;
}

/** Sets a goal's mode; `swap` is set down to maintain in the same step, to keep three. */
export async function setGoalMode(id: string, mode: GoalMode, swap?: string): Promise<void> {
    await loadGoalFocus();
    stored = { ...stored, [id]: mode, ...(swap ? { [swap]: 'maintain' as const } : null) };
    changed();
    await AsyncStorage.setItem(KEY, JSON.stringify(stored)).catch(() => undefined);
}

export const currentGoalFocus = (): Record<string, GoalMode> => stored;
export function subscribeGoalFocus(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
