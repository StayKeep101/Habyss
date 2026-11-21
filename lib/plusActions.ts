import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * What the + does on each tab, the fastest way from a thought to the thing.
 *
 * - Home and Roadmap: make something (goal, habit, task, thought). Mood and
 *   energy are no longer logged by hand: Echo asks;
 * - Community: put Shards on a goal, or pick a challenge;
 * - Settings: the + is a search lens, not a menu (see settings.tsx).
 *
 * Each tab's list can be changed in Settings → Plus button, from the same
 * catalogue. A tab with one action runs it straight away: no menu for one
 * choice.
 */

export type PlusTab = 'home' | 'roadmap' | 'community';
/** Focus is not one: it is the bar over the tab bar, one tap away on every tab. */
export type PlusActionId = 'goal' | 'habit' | 'task' | 'thought' | 'bet' | 'challenge';

/** Every action the + can offer, with the token colour its icon wears. */
export const PLUS_ACTIONS: Record<PlusActionId, { label: string; icon: string; tone: 'accent' | 'success' | 'warning' | 'danger' }> = {
    goal: { label: 'Goal', icon: 'flag-outline', tone: 'accent' },
    habit: { label: 'Habit', icon: 'repeat', tone: 'success' },
    task: { label: 'Task', icon: 'checkmark-circle-outline', tone: 'warning' },
    thought: { label: 'Thought', icon: 'bulb-outline', tone: 'warning' },
    bet: { label: 'Bet on a goal', icon: 'diamond-outline', tone: 'accent' },
    challenge: { label: 'Pick a challenge', icon: 'trophy-outline', tone: 'warning' },
};

export const PLUS_TABS: { id: PlusTab; label: string; icon: string }[] = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'roadmap', label: 'Roadmap', icon: 'map' },
    { id: 'community', label: 'Community', icon: 'people' },
];

export const DEFAULT_PLUS: Record<PlusTab, PlusActionId[]> = {
    home: ['goal', 'habit', 'task', 'thought'],
    roadmap: ['goal', 'habit', 'task', 'thought'],
    community: ['bet', 'challenge'],
};

/** The most a menu holds, so it never reaches the top of the screen. */
export const MAX_PLUS = 5;

const KEY = 'habyss_plus_actions';
/** Goal and Bet on a goal are offered only while goals are on (constants/features.ts). */
export const plusOffered = (id: PlusActionId): boolean => {
    const { GOALS_ENABLED, MARKET_ENABLED } = require('@/constants/features') as typeof import('@/constants/features');
    return id === 'goal' ? GOALS_ENABLED : id === 'bet' ? GOALS_ENABLED && MARKET_ENABLED : true;
};
const isAction = (id: unknown): id is PlusActionId => typeof id === 'string' && id in PLUS_ACTIONS && plusOffered(id as PlusActionId);

/** A saved choice, cleaned: known actions, in catalogue order, at most five; a tab never empty. */
export function cleanPlus(raw: unknown): Record<PlusTab, PlusActionId[]> {
    const saved = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const order = Object.keys(PLUS_ACTIONS) as PlusActionId[];
    const out = Object.fromEntries((Object.keys(DEFAULT_PLUS) as PlusTab[]).map(tab => [tab, DEFAULT_PLUS[tab].filter(plusOffered)])) as Record<PlusTab, PlusActionId[]>;
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
        state = cleanPlus(JSON.parse((await AsyncStorage.getItem(KEY)) ?? 'null'));
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
    else if (id === 'goal') emit('show_goal_quick_add');
    else if (id === 'task') emit('show_task_form');
    else if (id === 'thought') go('/brain-dump');
    else if (id === 'bet') emit('show_open_bet');
    else if (id === 'challenge') emit('show_challenges');
}
