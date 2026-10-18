import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Colours the person made with the wheel and chose to keep, offered next to
 * the presets on every habit and goal. Newest first, at most twelve.
 */
const KEY = 'habyss_custom_colors';
const MAX = 12;
let colors: string[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const publish = (next: string[]) => { colors = next; listeners.forEach(listener => listener()); };

export const currentCustomColors = (): string[] => colors;
export function subscribeCustomColors(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export async function loadCustomColors(): Promise<string[]> {
    if (loaded) return colors;
    loaded = true;
    try {
        const parsed = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]');
        if (Array.isArray(parsed)) publish(parsed.filter((item): item is string => typeof item === 'string' && /^#[0-9A-F]{6}$/i.test(item)));
    } catch { /* none yet */ }
    return colors;
}

/** Keeps a colour (moved to the front if already kept). */
export function withColor(list: string[], color: string): string[] {
    const hex = color.toUpperCase();
    return [hex, ...list.filter(item => item.toUpperCase() !== hex)].slice(0, MAX);
}

export async function saveCustomColor(color: string): Promise<void> {
    await loadCustomColors();
    const next = withColor(colors, color);
    publish(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
}

export async function removeCustomColor(color: string): Promise<void> {
    await loadCustomColors();
    const next = colors.filter(item => item.toUpperCase() !== color.toUpperCase());
    publish(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
}
