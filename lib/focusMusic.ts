import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import type { AudioPlayer } from 'expo-audio';

/**
 * Music to focus to, only in Focus: the focus page's music button turns it on
 * or off, and its settings (the gear) choose where it comes from:
 *   - Habyss: the app's own track, on repeat while the clock runs;
 *   - Spotify or Apple Music: turning it on opens that app on your library,
 *     the focus clock running on.
 * Nothing plays anywhere else in the app.
 */
export type FocusMusicSource = 'habyss' | 'spotify' | 'apple';
export const MUSIC_SOURCES: { id: FocusMusicSource; label: string; icon: string; color?: string; url?: string; store?: string }[] = [
    { id: 'habyss', label: 'Habyss music', icon: 'musical-notes' },
    // Their own brand colours, as their apps show them.
    { id: 'spotify', label: 'Spotify', icon: 'musical-notes', color: '#1DB954', url: 'spotify:', store: 'https://apps.apple.com/app/id324684580' },
    { id: 'apple', label: 'Apple Music', icon: 'musical-notes', color: '#FA2D48', url: 'music://', store: 'https://apps.apple.com/app/id1108187390' },
];

const KEY = 'habyss_focus_music';
let state: { on: boolean; source: FocusMusicSource } = { on: false, source: 'habyss' };
let loaded = false;
const listeners = new Set<() => void>();
const publish = () => listeners.forEach(listener => listener());
const save = () => { void AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => undefined); };

export const currentFocusMusic = () => state;
export function subscribeFocusMusic(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
export async function loadFocusMusic(): Promise<void> {
    if (loaded) return;
    loaded = true;
    try {
        const saved = JSON.parse((await AsyncStorage.getItem(KEY)) ?? 'null');
        if (saved && typeof saved.on === 'boolean' && MUSIC_SOURCES.some(source => source.id === saved.source)) { state = saved; publish(); }
    } catch { /* off */ }
}

/** Opens Spotify or Apple Music (or its App Store page when it is not installed). */
async function openApp(source: FocusMusicSource): Promise<void> {
    const app = MUSIC_SOURCES.find(item => item.id === source);
    if (!app?.url) return;
    try {
        if (await Linking.canOpenURL(app.url)) await Linking.openURL(app.url);
        else if (app.store) await Linking.openURL(app.store);
    } catch { /* nothing to open */ }
}

/** The music button: on or off. Turning on Spotify or Apple Music opens it. */
export function setFocusMusicOn(on: boolean): void {
    if (state.on === on) return;
    state = { ...state, on };
    publish();
    save();
    if (on && state.source !== 'habyss') void openApp(state.source);
}
/** Where the music comes from (Focus settings). Choosing your own app turns music on and opens it. */
export function setFocusMusicSource(source: FocusMusicSource): void {
    const changed = state.source !== source;
    state = { on: source === 'habyss' ? state.on : true, source };
    publish();
    save();
    if (source !== 'habyss' && changed) void openApp(source);
}

// Loaded only when the music really plays (see lib/soundService.ts for why).
const audio = (): typeof import('expo-audio') | null => {
    try { return require('expo-audio'); } catch { return null; }
};
const TRACK = require('../assets/sounds/background-music.m4a');
let player: AudioPlayer | null = null;

/** Habyss's track plays while it is on, chosen, and the clock is running; it stops otherwise. */
export function playFocusMusic(running: boolean): void {
    const expo = audio();
    if (!expo) return;
    try {
        if (!running || !state.on || state.source !== 'habyss') { player?.pause(); return; }
        if (!player) {
            // Plays with the ringer switch off too: you turned it on.
            void expo.setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers', shouldPlayInBackground: true });
            player = expo.createAudioPlayer(TRACK);
            player.loop = true;
            player.volume = 0.6;
        }
        player.play();
    } catch { /* music that cannot play is not worth an alert */ }
}

/** Leaving Focus: the track stops and lets go of the audio. */
export function stopFocusMusic(): void {
    try { player?.remove(); } catch { /* already gone */ }
    player = null;
}
