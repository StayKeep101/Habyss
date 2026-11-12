import type { AudioPlayer } from 'expo-audio';

/**
 * Habyss's music: one track, on repeat, quietly under the app while it is open
 * (Settings → Appearance → Music; hooks/useBackgroundMusic.ts drives it).
 *
 * It is ambient, the way a game's music is: the ringer switch on Silent mutes
 * it, it plays alongside a podcast or playlist rather than stopping it, and it
 * pauses when the app goes to the background. A focus sound the person chose
 * (lib/focusSounds.ts) takes its place while it plays.
 */
const SOURCE = require('../assets/sounds/background-music.m4a');
/** Under everything: heard, never in the way of Echo or a sound effect. */
const VOLUME = 0.35;

// Loaded only when the music really plays (see lib/soundService.ts for why).
const audio = (): typeof import('expo-audio') | null => {
    try { return require('expo-audio'); } catch { return null; }
};

let player: AudioPlayer | null = null;
let wanted = false;
let focusPlaying = false;

function apply(): void {
    const expo = audio();
    if (!expo) return;
    try {
        if (!wanted || focusPlaying) { player?.pause(); return; }
        // Ambient every time: a focus sound may have left the session playing through Silent.
        void expo.setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false });
        if (!player) {
            player = expo.createAudioPlayer(SOURCE);
            player.loop = true;
            player.volume = VOLUME;
        }
        player.play();
    } catch { /* music that cannot play is not worth an alert */ }
}

/** On when the setting is on and the app is in front; off otherwise. */
export function setBackgroundMusic(on: boolean): void {
    if (wanted === on) return;
    wanted = on;
    apply();
}

/** A focus sound started or stopped: the music steps aside for it, then comes back. */
export function setFocusSoundPlaying(on: boolean): void {
    if (focusPlaying === on) return;
    focusPlaying = on;
    apply();
}
