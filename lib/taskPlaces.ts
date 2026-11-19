import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Where a task gets done: "9:00 · Library". With the time the timeline
 * already gives, it turns a task into an if-then plan ("at 9:00 in the
 * library, I open the problem set"), the best-supported planning finding
 * there is (Gollwitzer & Sheeran 2006). One tap, never required.
 */
const KEY = 'habyss_task_places';
export const PRESET_PLACES = ['Home', 'Library', 'Gym', 'Office', 'Café'];

interface Store { byTask: Record<string, string>; recent: string[] }
let store: Store = { byTask: {}, recent: [] };
let loaded = false;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach(listener => listener());

export async function loadPlaces(): Promise<Store> {
    if (loaded) return store;
    try {
        const raw = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}');
        store = { byTask: raw?.byTask ?? {}, recent: Array.isArray(raw?.recent) ? raw.recent : [] };
    } catch { /* starts empty */ }
    loaded = true;
    changed();
    return store;
}

/** Sets (or, null, clears) where a task is done; the place goes to the front of the recent ones. */
export async function setPlace(taskId: string, place: string | null): Promise<void> {
    await loadPlaces();
    const clean = place?.trim().slice(0, 40) || null;
    const byTask = { ...store.byTask };
    if (clean) byTask[taskId] = clean; else delete byTask[taskId];
    const recent = clean ? [clean, ...store.recent.filter(item => item !== clean)].slice(0, 6) : store.recent;
    store = { byTask, recent };
    changed();
    await AsyncStorage.setItem(KEY, JSON.stringify(store)).catch(() => undefined);
}

export const placeOf = (taskId: string): string | null => store.byTask[taskId] ?? null;
export const placesById = (): Record<string, string> => store.byTask;

/** The places to offer: recent first, then the usual ones, no repeats. Pure. */
export const placeChoices = (recent: string[]): string[] => [...new Set([...recent, ...PRESET_PLACES])].slice(0, 7);
export const recentPlaces = (): string[] => store.recent;

export const currentPlaces = (): Store => store;
export function subscribePlaces(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
