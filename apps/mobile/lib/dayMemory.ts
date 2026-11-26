import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DayFlow } from './dayFlow';
// Shared with the Mac: packages/core/src/dayMemory.ts (the rules). What stays here is the phone's own part.
import { emptyMemory, remember, seen, broughtBack, type DayMemory } from '@habyss/core/dayMemory';
export * from '@habyss/core/dayMemory';

const KEY = 'habyss_day_memory';
let state: DayMemory = emptyMemory('');
let loading = false;
/** The stored copy has been read: until then nothing is remembered or carried over. */
let loaded = false;
const listeners = new Set<() => void>();

export const currentMemory = (): DayMemory => state;
export const memoryReady = (): boolean => loaded;
export function subscribeMemory(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export async function loadMemory(): Promise<DayMemory> {
    if (loaded || loading) return state;
    loading = true;
    try {
        const raw = JSON.parse((await AsyncStorage.getItem(KEY)) ?? 'null');
        if (raw && typeof raw.day === 'string' && raw.slots && raw.done && raw.moved) state = raw;
    } catch { /* start empty */ }
    loaded = true;
    listeners.forEach(listener => listener());
    return state;
}

/**
 * The Roadmap saves its timeline here and redraws from what is saved, so the
 * two feed each other. They agree after a pass or two; if some day's data
 * keeps them disagreeing, that must not redraw the screen forever (it crashed
 * the Roadmap: "Maximum update depth exceeded"). Past a few changes in one
 * go, the memory is still kept but screens are told again only on the next
 * turn of the app, so a disagreement costs a redraw at most, never a crash.
 */
export const MAX_CHANGES_AT_ONCE = 8;
let changesAtOnce = 0;
let reported = false;

function store(next: DayMemory) {
    if (JSON.stringify(next) === JSON.stringify(state)) return;
    state = next;
    void AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => undefined);
    void (require('./dayInputsSync') as typeof import('./dayInputsSync')).markDayInputsDirty('habyss_day_memory');
    if (changesAtOnce === 0) setTimeout(() => { changesAtOnce = 0; }, 0);
    changesAtOnce += 1;
    if (changesAtOnce > MAX_CHANGES_AT_ONCE) {
        if (!reported) {
            reported = true;
            // Reported (lib/crashReport.ts), so the data that disagrees can be found and fixed.
            try { (require('./crashReport') as typeof import('./crashReport')).reportCaught(new Error('Day memory kept changing'), 'dayMemory'); } catch { /* kept */ }
        }
        return;
    }
    listeners.forEach(listener => listener());
}

/** The stored copy changed underneath (another device): read it again. */
export async function reloadMemory(): Promise<void> {
    loaded = false;
    loading = false;
    await loadMemory();
}

/** Called with today's flow whenever it changes. Waits for the stored copy first. */
export function rememberFlow(day: string, flow: DayFlow, now: number): void {
    if (!loaded) return;
    store(remember(state, day, flow, now));
}

export function bringBack(ids: string[]): void {
    if (!loaded || !ids.length) return;
    store(broughtBack(state, ids));
}

export function markSeen(id: string): void {
    store(seen(state, id));
}
