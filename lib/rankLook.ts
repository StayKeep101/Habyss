import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Which rank the app is dressed for (theme/rankLooks.ts), read by the accent
 * (context/AccentContext.tsx).
 *
 * - Your rank: set by Home whenever your Marks are counted, kept on the phone
 *   so the app opens already in your colour.
 * - A preview: the Developer page can dress the app for any rank, for this
 *   session only. It never touches your Marks or your rank.
 */
const KEY = 'habyss_rank_look_rank';

let rank: string | null = null;
let preview: string | null = null;
let loaded = false;
const listeners = new Set<() => void>();
const publish = () => listeners.forEach(listener => listener());

export const currentRankLook = (): { rank: string | null; preview: string | null } => ({ rank, preview });
export function subscribeRankLook(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export async function loadRankLook(): Promise<void> {
    if (loaded) return;
    loaded = true;
    try {
        const saved = await AsyncStorage.getItem(KEY);
        if (saved && !rank) { rank = saved; publish(); }
    } catch { /* first launch */ }
}

/** Your rank now (from your Marks). */
export function setRankLook(name: string): void {
    if (rank === name) return;
    rank = name;
    publish();
    void AsyncStorage.setItem(KEY, name).catch(() => undefined);
}

/** Dress the app for another rank, this session only; null goes back to yours. */
export function previewRankLook(name: string | null): void {
    preview = name;
    publish();
}
