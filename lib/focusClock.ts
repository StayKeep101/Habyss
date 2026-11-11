import AsyncStorage from '@react-native-async-storage/async-storage';

/** How the focus clock looks (Settings → Focus clock). */
/** Two looks: the ring, or the digits alone. (Minimal, a third, was taken out.) */
export type ClockStyle = 'digital' | 'ring';
export const CLOCK_STYLES: { id: ClockStyle; label: string }[] = [
    { id: 'ring', label: 'Ring' }, { id: 'digital', label: 'Digital' },
];

const KEY = 'habyss_focus_clock';
// The ring, with Habyss's mark in it, unless you choose otherwise.
let style: ClockStyle = 'ring';
let loaded = false;
const listeners = new Set<() => void>();
export const currentClockStyle = (): ClockStyle => style;
export function subscribeClockStyle(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
export async function loadClockStyle(): Promise<ClockStyle> {
    if (loaded) return style;
    loaded = true;
    try {
        const stored = await AsyncStorage.getItem(KEY);
        // A Minimal chosen before it was taken out opens as the ring.
        if (stored === 'digital' || stored === 'ring') { style = stored; listeners.forEach(l => l()); }
    } catch { /* default */ }
    return style;
}
export async function setClockStyle(next: ClockStyle): Promise<void> {
    style = next;
    listeners.forEach(l => l());
    await AsyncStorage.setItem(KEY, next).catch(() => undefined);
}

/** "1:05:09", "25:00", "0:42": hours only when there are any. */
export function clockText(seconds: number): string {
    const total = Math.max(0, Math.floor(seconds));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const two = (n: number) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}
