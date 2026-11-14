import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Focus's background (Focus settings): the landscape, the same scene as Home,
 * so stepping in from Home is seamless; or the default, plain black, which an
 * OLED screen spends nothing on. The landscape to start with.
 */
export type FocusBackground = 'landscape' | 'plain';
const KEY = 'habyss_focus_background';
let choice: FocusBackground = 'landscape';
let loaded = false;
const listeners = new Set<() => void>();

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
        if (saved === 'plain' || saved === 'landscape') { choice = saved; listeners.forEach(listener => listener()); }
    } catch { /* the landscape */ }
}
export function setFocusBackground(next: FocusBackground): void {
    if (choice === next) return;
    choice = next;
    listeners.forEach(listener => listener());
    void AsyncStorage.setItem(KEY, next).catch(() => undefined);
}
