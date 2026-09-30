/**
 * Sound Service using expo-audio
 * Provides fun sound effects for the app
 */

import type { AudioPlayer } from 'expo-audio';

/**
 * Loaded on the first sound that will really play, and never before.
 *
 * This was a plain top-level import, and that alone was the problem: pulling
 * expo-audio in sets up its native side, which claims an AVAudioSession, which
 * is what filled the console with
 * `HALC_ProxyObjectMap::_CreateSystemObject: there is no system object` on
 * every launch. Not calling into it was not enough — importing it was the call.
 *
 * With no bundled audio this never runs, so a habit tracker with no sounds
 * never touches CoreAudio at all.
 */
function audio(): typeof import('expo-audio') | null {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require('expo-audio');
    } catch {
        return null;
    }
}

// Sound effect types
export type SoundEffect =
    | 'complete'      // Habit/Goal completion
    | 'tap'           // Button tap
    | 'success'       // Success action
    | 'error'         // Error action
    | 'streak'        // Streak milestone
    | 'levelUp'       // Achievement unlocked
    | 'notification'  // Notification received
    | 'swipe'         // Swipe action
    | 'toggle'        // Toggle on/off
    | 'celebrate';    // Celebration/confetti

/**
 * Bundled sound effects.
 *
 * Every effect used to stream from assets.mixkit.co. That meant no sound
 * offline in an offline-first app, which is what the FigFilePlayer -12864 and
 * -1102 load failures in the device log were; it hotlinked a third party's
 * preview files from a shipped app; and it put a network request behind a tap
 * in an app whose privacy policy says nothing leaves the device.
 *
 * Sound is therefore off until the audio ships inside the app. To turn it back
 * on, drop licensed files into assets/sounds/ and map them here. Nothing else
 * needs to change: every function below already no-ops on a missing entry.
 */
const SOUND_ASSETS: Partial<Record<SoundEffect, number>> = {
    // complete: require('../assets/sounds/complete.mp3'),
    // tap: require('../assets/sounds/tap.mp3'),
};

let warnedAboutMissingSounds = false;

/** Whether any audio actually ships. Everything below is pointless without it. */
export const hasBundledSounds = (): boolean => Object.keys(SOUND_ASSETS).length > 0;

/** Asked for once per launch at most, rather than once per screen mount. */
let audioReady: Promise<void> | null = null;

function sourceFor(effect: SoundEffect): number | null {
    const asset = SOUND_ASSETS[effect];
    if (asset === undefined) {
        if (__DEV__ && !warnedAboutMissingSounds) {
            warnedAboutMissingSounds = true;
            console.log('[Sound] No bundled audio, so sound effects are silent. See lib/soundService.ts.');
        }
        return null;
    }
    return asset;
}

// Cache for audio players
const playerCache: Map<SoundEffect, AudioPlayer | null> = new Map();

/**
 * Claims an audio session, but only if there is any audio to play.
 *
 * This used to run from a `useEffect` on Home, so every mount asked CoreAudio
 * to build a session for sound effects that do not exist — which is where the
 * endless `HALC_ProxyObjectMap::_CreateSystemObject: there is no system object`
 * in the console came from. A habit tracker with no bundled audio has no
 * business holding an audio session at all.
 *
 * Also memoised: the session is a property of the process, not of a screen.
 */
export async function initializeAudio(): Promise<void> {
    if (!hasBundledSounds()) return;
    const expo = audio();
    if (!expo) return;
    audioReady ??= expo.setAudioModeAsync({ playsInSilentMode: false })
        .then(() => undefined)
        .catch(error => { console.warn('Failed to initialize audio mode:', error); });
    return audioReady;
}

/**
 * Pre-load a sound effect for faster playback
 */
export async function preloadSound(effect: SoundEffect): Promise<void> {
    try {
        const source = sourceFor(effect);
        if (source === null) return;

        const expo = audio();
        if (!expo) return;
        playerCache.set(effect, expo.createAudioPlayer(source));
    } catch (error) {
        console.warn(`Failed to preload sound ${effect}:`, error);
    }
}

/**
 * Pre-load all common sound effects
 */
export async function preloadCommonSounds(): Promise<void> {
    if (!hasBundledSounds()) return;
    const commonSounds: SoundEffect[] = ['complete', 'tap', 'success', 'toggle'];
    await Promise.all(commonSounds.map(preloadSound));
}

/**
 * Play a sound effect
 */
export async function playSound(effect: SoundEffect, volume: number = 0.7): Promise<void> {
    try {
        const source = sourceFor(effect);
        if (source === null) return;
        // The session is claimed on the first sound that will really play.
        await initializeAudio();

        // Try to use cached player
        let player = playerCache.get(effect);

        if (!player) {
            const expo = audio();
            if (!expo) return;
            player = expo.createAudioPlayer(source);
            playerCache.set(effect, player);
        }

        if (player) {
            player.volume = volume;
            player.seekTo(0);
            player.play();
        }
    } catch (error) {
        console.warn(`Failed to play sound ${effect}:`, error);
    }
}

/**
 * Stop all playing sounds
 */
export function stopAllSounds(): void {
    playerCache.forEach((player) => {
        if (player) {
            player.pause();
        }
    });
}

/**
 * Cleanup all cached sounds
 */
export function cleanupSounds(): void {
    playerCache.forEach((player) => {
        if (player) {
            player.remove();
        }
    });
    playerCache.clear();
}

