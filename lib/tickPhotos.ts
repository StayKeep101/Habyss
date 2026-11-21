import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The photo taken when a habit is ticked (lib/challengeProof.ts asks for it,
 * skippable): kept on this phone for the habit's history, and uploaded to the
 * `proofs` bucket so friends see it on your day (useDayCardPublisher puts its
 * address on the card's line). habit id → day → the photo.
 */
export interface TickPhoto { uri: string; url?: string }
type Store = Record<string, Record<string, TickPhoto>>;

const KEY = 'habyss_tick_photos';
let store: Store = {};
let loaded = false;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach(listener => listener());

export async function loadTickPhotos(): Promise<Store> {
    if (loaded) return store;
    loaded = true;
    try { store = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}') ?? {}; } catch { store = {}; }
    return store;
}
const save = () => AsyncStorage.setItem(KEY, JSON.stringify(store)).catch(() => undefined);

export function onTickPhotos(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

/** A habit's photos, newest day first (read after loadTickPhotos). */
export function photosOf(habitId: string): { day: string; photo: TickPhoto }[] {
    return Object.entries(store[habitId] ?? {}).map(([day, photo]) => ({ day, photo })).sort((a, b) => b.day.localeCompare(a.day));
}

/** The address friends can see the day's photo at, once uploaded. */
export function tickPhotoUrl(habitId: string, day: string): string | undefined {
    return store[habitId]?.[day]?.url;
}

/** Keeps a new photo for a habit's day: copied somewhere lasting, then sent up for friends. */
export async function keepTickPhoto(habitId: string, day: string, uri: string): Promise<void> {
    await loadTickPhotos();
    let kept = uri;
    try {
        const FileSystem = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
        const folder = `${FileSystem.documentDirectory}tick-photos/`;
        await FileSystem.makeDirectoryAsync(folder, { intermediates: true }).catch(() => undefined);
        kept = `${folder}${habitId}-${day}.jpg`;
        await FileSystem.deleteAsync(kept, { idempotent: true });
        await FileSystem.copyAsync({ from: uri, to: kept });
    } catch { kept = uri; }
    store[habitId] = { ...(store[habitId] ?? {}), [day]: { uri: kept } };
    await save();
    changed();
    void upload(habitId, day, kept);
}

async function upload(habitId: string, day: string, uri: string): Promise<void> {
    try {
        const { getSupabase } = require('./supabase') as typeof import('./supabase');
        const sb = getSupabase();
        const me = sb ? (await sb.auth.getSession()).data.session?.user?.id : null;
        if (!sb || !me) return;
        const { readLocalFile } = require('./profileSync') as typeof import('./profileSync');
        const bytes = await readLocalFile(uri);
        if (!bytes?.byteLength) return;
        const path = `${me}/ticks/${habitId}-${day}-${Date.now()}.jpg`;
        const { error } = await sb.storage.from('proofs').upload(path, bytes, { contentType: 'image/jpeg' });
        if (error) return;
        const url = sb.storage.from('proofs').getPublicUrl(path).data.publicUrl;
        if (!store[habitId]?.[day]) return;
        store[habitId][day] = { ...store[habitId][day], url };
        await save();
        changed();
    } catch { /* kept on the phone; friends just don't see it */ }
}
