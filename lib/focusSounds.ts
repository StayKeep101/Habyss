import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AudioPlayer } from 'expo-audio';

/**
 * Sounds to focus to, chosen from the focus page: made for Habyss (seamless
 * loops of soft rain, slow waves and a warm, even noise), bundled so they work
 * offline. One choice, remembered; it plays while a session runs and stops
 * when it is paused or ends.
 */
export type FocusSound = 'off' | 'rain' | 'waves' | 'deep';
export const FOCUS_SOUNDS: { id: FocusSound; label: string; icon: string }[] = [
    { id: 'off', label: 'Silence', icon: 'volume-mute' },
    { id: 'rain', label: 'Rain', icon: 'rainy' },
    { id: 'waves', label: 'Waves', icon: 'water' },
    { id: 'deep', label: 'Deep noise', icon: 'radio' },
];
const SOURCES: Record<Exclude<FocusSound, 'off'>, number> = {
    rain: require('../assets/sounds/focus-rain.m4a'),
    waves: require('../assets/sounds/focus-waves.m4a'),
    deep: require('../assets/sounds/focus-deep.m4a'),
};

const KEY = 'habyss_focus_sound';
let choice: FocusSound = 'off';
let loaded = false;
const listeners = new Set<() => void>();
export const currentFocusSound = (): FocusSound => choice;
export function subscribeFocusSound(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
export async function loadFocusSound(): Promise<FocusSound> {
    if (loaded) return choice;
    loaded = true;
    try {
        const saved = await AsyncStorage.getItem(KEY);
        if (saved && FOCUS_SOUNDS.some(sound => sound.id === saved)) { choice = saved as FocusSound; listeners.forEach(l => l()); }
    } catch { /* silence */ }
    return choice;
}
export async function setFocusSound(next: FocusSound): Promise<void> {
    choice = next;
    listeners.forEach(l => l());
    await AsyncStorage.setItem(KEY, next).catch(() => undefined);
}

// Loaded only when a sound really plays (see lib/soundService.ts for why).
const audio = (): typeof import('expo-audio') | null => {
    try { return require('expo-audio'); } catch { return null; }
};
let player: AudioPlayer | null = null;
let playing: FocusSound = 'off';

/** Plays the chosen loop, or stops it: called with whatever the page shows now. */
export async function playFocusSound(sound: FocusSound, on: boolean): Promise<void> {
    const expo = audio();
    if (!expo) return;
    try {
        if (!on || sound === 'off') { player?.pause(); return; }
        if (playing !== sound || !player) {
            player?.remove();
            // Plays with the ringer switch off too: you chose to hear it.
            await expo.setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers', shouldPlayInBackground: true });
            player = expo.createAudioPlayer(SOURCES[sound]);
            player.loop = true;
            player.volume = 0.7;
            playing = sound;
        }
        player.play();
    } catch { /* a sound that cannot play is not worth an alert */ }
}

export function stopFocusSound(): void {
    try { player?.pause(); player?.remove(); } catch { /* gone already */ }
    player = null;
    playing = 'off';
}
