/**
 * Sound Service using expo-audio
 * Provides fun sound effects for the app
 */

import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';

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
 * Initialize the audio mode for the app
 */
export async function initializeAudio(): Promise<void> {
    try {
        await setAudioModeAsync({
            playsInSilentMode: false, // Respect silent mode
        });
    } catch (error) {
        console.warn('Failed to initialize audio mode:', error);
    }
}

/**
 * Pre-load a sound effect for faster playback
 */
export async function preloadSound(effect: SoundEffect): Promise<void> {
    try {
        const source = sourceFor(effect);
        if (source === null) return;

        const player = createAudioPlayer(source);
        playerCache.set(effect, player);
    } catch (error) {
        console.warn(`Failed to preload sound ${effect}:`, error);
    }
}

/**
 * Pre-load all common sound effects
 */
export async function preloadCommonSounds(): Promise<void> {
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

        // Try to use cached player
        let player = playerCache.get(effect);

        if (!player) {
            // Create new player if not cached
            player = createAudioPlayer(source);
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

