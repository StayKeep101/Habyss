import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Which rank the app is dressed for (theme/rankLooks.ts), read by the accent
 * (context/AccentContext.tsx).
 *
 * - Your rank: set by Home whenever your Marks are counted, kept on the phone
 *   so the app opens already in your colour.
 * - Chosen: an hourglass you have reached, picked in the hourglasses (Home,
 *   tap the hourglass). The only way to change the app's colour; one above
 *   your rank is never shown (AccentContext checks it).
 * - A preview: the Developer page can dress the app for any rank, for this
 *   session only. It never touches your Marks or your rank.
 */
const KEY = 'habyss_rank_look_rank';
const CHOSEN_KEY = 'habyss_rank_look_chosen';
let chosen: string | null = null;

let rank: string | null = null;
let preview: string | null = null;
let loaded = false;
const listeners = new Set<() => void>();
const publish = () => listeners.forEach(listener => listener());

export const currentRankLook = (): { rank: string | null; preview: string | null; chosen: string | null } => ({ rank, preview, chosen });
export function subscribeRankLook(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export async function loadRankLook(): Promise<void> {
    if (loaded) return;
    loaded = true;
    try {
        const [saved, picked] = await Promise.all([AsyncStorage.getItem(KEY), AsyncStorage.getItem(CHOSEN_KEY)]);
        if (saved && !rank) rank = saved;
        if (picked && !chosen) chosen = picked;
        if (saved || picked) publish();
    } catch { /* first launch */ }
}

/** Your rank now (from your Marks). */
export function setRankLook(name: string): void {
    if (rank === name) return;
    rank = name;
    publish();
    void AsyncStorage.setItem(KEY, name).catch(() => undefined);
}

/** The hourglass you picked (one you have reached) dresses the app; null goes back to your rank's. */
export function chooseRankLook(name: string | null): void {
    if (chosen === name) return;
    chosen = name;
    publish();
    void (name ? AsyncStorage.setItem(CHOSEN_KEY, name) : AsyncStorage.removeItem(CHOSEN_KEY)).catch(() => undefined);
}

/** Dress the app for another rank, this session only; null goes back to yours. */
export function previewRankLook(name: string | null): void {
    preview = name;
    publish();
}
