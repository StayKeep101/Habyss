import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * What the + does on each tab, the fastest way from a thought to the thing.
 *
 * - Home and Roadmap: make something (habit, task, thought). Mood and
 *   energy are no longer logged by hand: Echo asks;
 * - Community: race the clock, or pick a challenge;
 * - Settings: the + is a search lens, not a menu (see settings.tsx).
 *
 * Each tab's list can be changed in Settings → Plus button, from the same
 * catalogue. A tab with one action runs it straight away: no menu for one
 * choice.
 */

export type PlusTab = 'home' | 'roadmap' | 'community';
/** Focus is not one: it is the bar over the tab bar, one tap away on every tab. */
export type PlusActionId = 'habit' | 'task' | 'thought' | 'race' | 'challenge';

/** Every action the + can offer, with the token colour its icon wears. */
export const PLUS_ACTIONS: Record<PlusActionId, { label: string; icon: string; tone: 'accent' | 'success' | 'warning' | 'danger' }> = {
    habit: { label: 'Habit', icon: 'repeat', tone: 'success' },
    task: { label: 'Task', icon: 'checkmark-circle-outline', tone: 'warning' },
    thought: { label: 'Thought', icon: 'bulb-outline', tone: 'warning' },
    race: { label: 'Race the clock', icon: 'flash-outline', tone: 'warning' },
    challenge: { label: 'Pick a challenge', icon: 'trophy-outline', tone: 'warning' },
};

export const PLUS_TABS: { id: PlusTab; label: string; icon: string }[] = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'roadmap', label: 'Roadmap', icon: 'map' },
    { id: 'community', label: 'Community', icon: 'people' },
];

export const DEFAULT_PLUS: Record<PlusTab, PlusActionId[]> = {
    home: ['habit', 'task', 'thought'],
    roadmap: ['habit', 'task', 'thought'],
    community: ['race', 'challenge'],
};

/** The most a menu holds, so it never reaches the top of the screen. */
export const MAX_PLUS = 5;

const KEY = 'habyss_plus_actions';
/**
 * Actions added after people may already have saved their own lists: each is
 * put into the tabs whose default holds it, once, so it shows up without
 * undoing anyone's choices (and stays off if they turn it off afterwards).
 */
const ADDED: PlusActionId[] = ['race'];
const ADDED_KEY = 'habyss_plus_added';
const isAction = (id: unknown): id is PlusActionId => typeof id === 'string' && id in PLUS_ACTIONS;

/** A saved choice, cleaned: known actions, in catalogue order, at most five; a tab never empty. */
export function cleanPlus(raw: unknown): Record<PlusTab, PlusActionId[]> {
    const saved = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const order = Object.keys(PLUS_ACTIONS) as PlusActionId[];
    const out = Object.fromEntries((Object.keys(DEFAULT_PLUS) as PlusTab[]).map(tab => [tab, [...DEFAULT_PLUS[tab]]])) as Record<PlusTab, PlusActionId[]>;
    for (const tab of Object.keys(DEFAULT_PLUS) as PlusTab[]) {
        // Duels became challenges: a saved "duel" is the challenge now.
        const list = Array.isArray(saved[tab]) ? (saved[tab] as unknown[]).map(id => (id === 'duel' ? 'challenge' : id)).filter(isAction) : null;
        if (list && list.length) out[tab] = order.filter(id => list.includes(id)).slice(0, MAX_PLUS);
    }
    return out;
}

/** The same action on, or off, for one tab. Turning off the last one is refused: the + always does something. */
export function togglePlus(current: Record<PlusTab, PlusActionId[]>, tab: PlusTab, id: PlusActionId): Record<PlusTab, PlusActionId[]> {
    const list = current[tab];
    const next = list.includes(id) ? list.filter(item => item !== id) : [...list, id];
    if (!next.length || next.length > MAX_PLUS) return current;
    return cleanPlus({ ...current, [tab]: next });
}

/** New actions put into the tabs whose default holds them, if there is room. */
export function withAdded(current: Record<PlusTab, PlusActionId[]>, added: PlusActionId[]): Record<PlusTab, PlusActionId[]> {
    if (!added.length) return current;
    const next = { ...current };
    for (const tab of Object.keys(DEFAULT_PLUS) as PlusTab[]) {
        const fresh = added.filter(id => DEFAULT_PLUS[tab].includes(id) && !next[tab].includes(id));
        if (fresh.length && next[tab].length + fresh.length <= MAX_PLUS) next[tab] = [...next[tab], ...fresh];
    }
    return cleanPlus(next);
}

let state: Record<PlusTab, PlusActionId[]> = cleanPlus(null);
let loaded = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

export const currentPlus = () => state;
export function subscribePlus(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export async function loadPlus(): Promise<Record<PlusTab, PlusActionId[]>> {
    if (loaded) return state;
    try {
        const saved = JSON.parse((await AsyncStorage.getItem(KEY)) ?? 'null');
        const seen: string[] = JSON.parse((await AsyncStorage.getItem(ADDED_KEY)) ?? '[]');
        state = withAdded(cleanPlus(saved), ADDED.filter(id => !seen.includes(id)));
        if (ADDED.some(id => !seen.includes(id))) {
            void AsyncStorage.setItem(ADDED_KEY, JSON.stringify(ADDED)).catch(() => undefined);
            if (saved) void AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => undefined);
        }
    } catch { state = DEFAULT_PLUS; }
    loaded = true;
    notify();
    return state;
}

export async function savePlus(next: Record<PlusTab, PlusActionId[]>): Promise<void> {
    state = cleanPlus(next);
    notify();
    await AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => undefined);
}

/** Which tab's + this is, from the route the dock is on. Settings has its own (search). */
export const plusTabOf = (route: string | undefined): PlusTab | 'settings' =>
    route === 'settings' ? 'settings' : route === 'community' ? 'community' : route === 'roadmap' ? 'roadmap' : 'home';

/** Does what the action is for: opens the sheet or the page. */
export function runPlus(id: PlusActionId): void {
    const { emit } = require('./appEvents') as typeof import('./appEvents');
    const go = (path: string) => (require('expo-router') as typeof import('expo-router')).router.push(path as never);
    // Creating a habit opens quick add; the full form is for editing, reachable from quick add's More options.
    if (id === 'habit') emit('show_quick_add');
    else if (id === 'task') emit('show_task_form');
    else if (id === 'thought') go('/brain-dump');
    else if (id === 'race') emit('show_race');
    else if (id === 'challenge') emit('show_challenges');
}
