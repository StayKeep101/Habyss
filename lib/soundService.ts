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

// Sound URLs - Using free sound effects from online sources
// These are placeholder URLs - replace with your own hosted sounds or local assets
const SOUND_URLS: Record<SoundEffect, string> = {
    complete: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3', // Pop sound
    tap: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3', // Soft click
    success: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3', // Success chime
    error: 'https://assets.mixkit.co/active_storage/sfx/2955/2955-preview.mp3', // Error buzz
    streak: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3', // Achievement
    levelUp: 'https://assets.mixkit.co/active_storage/sfx/1997/1997-preview.mp3', // Level up
    notification: 'https://assets.mixkit.co/active_storage/sfx/2309/2309-preview.mp3', // Notification ping
    swipe: 'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3', // Swipe whoosh
    toggle: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3', // Toggle click
    celebrate: 'https://assets.mixkit.co/active_storage/sfx/1978/1978-preview.mp3', // Celebration fanfare
};

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
        const url = SOUND_URLS[effect];
        if (!url) return;

        const player = createAudioPlayer({ uri: url });
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
        const url = SOUND_URLS[effect];
        if (!url) return;

        // Try to use cached player
        let player = playerCache.get(effect);

        if (!player) {
            // Create new player if not cached
            player = createAudioPlayer({ uri: url });
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

// Export sound URLs for custom usage
export { SOUND_URLS };
