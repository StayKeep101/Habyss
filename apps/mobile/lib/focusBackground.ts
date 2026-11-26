import AsyncStorage from '@react-native-async-storage/async-storage';
import { FOCUS_BACKGROUNDS } from '@/theme/focusBackgrounds';

/**
 * Focus's background (Focus settings): None, plain black (the default, which
 * an OLED screen spends nothing on), or one of the pictures in
 * theme/focusBackgrounds.ts. A saved choice that is no longer there (the old
 * landscape, a picture taken out) reads as None.
 */
export type FocusBackground = string;
export const PLAIN: FocusBackground = 'plain';
const KEY = 'habyss_focus_background';
let choice: FocusBackground = PLAIN;
let loaded = false;
const listeners = new Set<() => void>();

const known = (id: string | null): id is string => !!id && (id === PLAIN || FOCUS_BACKGROUNDS.some(picture => picture.id === id));

export const currentFocusBackground = (): FocusBackground => choice;
export function subscribeFocusBackground(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
export async function loadFocusBackground(): Promise<void> {
    if (loaded) return;
    loaded = true;
    try {
        const saved = await AsyncStorage.getItem(KEY);
        if (known(saved) && saved !== choice) { choice = saved; listeners.forEach(listener => listener()); }
    } catch { /* None */ }
}
export function setFocusBackground(next: FocusBackground): void {
    if (choice === next || !known(next)) return;
    choice = next;
    listeners.forEach(listener => listener());
    void AsyncStorage.setItem(KEY, next).catch(() => undefined);
}

/** The picture chosen, or null for None. */
export const focusPicture = (id: FocusBackground) => FOCUS_BACKGROUNDS.find(picture => picture.id === id) ?? null;
