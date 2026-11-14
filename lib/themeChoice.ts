import AsyncStorage from '@react-native-async-storage/async-storage';
import { currentRankLook, shownRankLook } from './rankLook';

/**
 * Settings → Appearance → Theme: Default (Habyss's original palette, always)
 * or Hourglass (the palette of the hourglass in use, theme/palettes.ts).
 * Default to start with. Picking an hourglass to use turns Hourglass on.
 */
export type ThemeChoice = 'default' | 'hourglass';
const KEY = 'habyss_theme_choice';

let choice: ThemeChoice = 'default';
let loaded = false;
const listeners = new Set<() => void>();

export const currentThemeChoice = (): ThemeChoice => choice;
export function subscribeThemeChoice(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
export async function loadThemeChoice(): Promise<void> {
    if (loaded) return;
    loaded = true;
    try {
        const saved = await AsyncStorage.getItem(KEY);
        if (saved === 'hourglass' && choice !== 'hourglass') { choice = 'hourglass'; listeners.forEach(listener => listener()); }
    } catch { /* first launch: Default */ }
}
export function setThemeChoice(next: ThemeChoice): void {
    if (choice === next) return;
    choice = next;
    listeners.forEach(listener => listener());
    void AsyncStorage.setItem(KEY, next).catch(() => undefined);
}

/**
 * The rank whose palette the app wears, or null for the Default (original)
 * palette. A Developer preview always shows; otherwise the hourglass in use,
 * when the Hourglass theme is on.
 */
export function themeRank(): string | null {
    const { preview } = currentRankLook();
    if (preview) return preview;
    return choice === 'hourglass' ? shownRankLook() : null;
}
