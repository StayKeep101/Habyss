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
    | 'celebrate'     // Celebration/confetti
    | 'select'        // A choice made: switches, chips, tabs, menu items
    | 'open'          // Something appears over the page: a sheet, a popup, a menu
    | 'transition';   // A whole new place: entering Focus

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
    // ── The interface: one sound per kind of control ──────────────────────
    // Change a file here and every control of that kind changes with it.
    // The controls in components/ui play these through hooks/useUISound.ts.
    //
    // Buttons and choices (taps, switches, chips, tabs, menu items) are silent:
    // only a window opening, entering Focus and something done are heard.
    // To give them a sound again, map `tap` and `select` here.
    //
    // A window appearing over the page: VoidSheet, PopupCard, a ⋯ menu opening.
    // The Focus whoosh, cut so its peak lands at 0.2 s, as the window settles
    // (it opens in OVERLAY.in, 260 ms): the full whoosh peaks at 0.5 s, after it.
    open: require('../assets/sounds/ui-open.m4a'),
    // A whole new place: entering Focus.
    transition: require('../assets/sounds/ui-transition.m4a'),
    // Done: a habit or task ticked (Home, Roadmap, habit and goal pages, Receipt).
    complete: require('../assets/sounds/ui-done.m4a'),

    // ── The app's bigger moments ─────────────────────────────────────────
    // Original tones made for Habyss (soft pentatonic chimes), bundled so they
    // work offline and need no licence.
    success: require('../assets/sounds/success.m4a'),
    error: require('../assets/sounds/error.m4a'),
    streak: require('../assets/sounds/streak.m4a'),
    levelUp: require('../assets/sounds/levelUp.m4a'),
    notification: require('../assets/sounds/notification.m4a'),
    celebrate: require('../assets/sounds/celebrate.m4a'),
};

/**
 * How loud each kind is (0–1), in the same one place. The interface stays quiet
 * under what you are doing; a thing done is heard.
 */
export const SOUND_VOLUME: Partial<Record<SoundEffect, number>> = {
    open: 0.4,
    transition: 0.5,
    complete: 0.6,
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
    // Respects the mute switch, and plays over whatever music is on rather
    // than stopping it: a tick should never pause somebody's playlist.
    audioReady ??= expo.setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' })
        .then(() => undefined)
        .catch(error => { console.warn('Failed to initialize audio mode:', error); });
    return audioReady;
}

/**
 * Pre-load a sound effect for faster playback
 */
export async function preloadSound(effect: SoundEffect): Promise<void> {
    try {
        // Once per sound: many controls on a screen ask for the same one.
        if (playerCache.get(effect)) return;
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
    // The ones the app actually plays, loaded ahead so the first is not silent.
    const commonSounds: SoundEffect[] = ['tap', 'select', 'open', 'complete', 'streak', 'celebrate', 'levelUp'];
    await Promise.all(commonSounds.map(preloadSound));
}

/**
 * Play a sound effect
 */
export async function playSound(effect: SoundEffect, volume: number = SOUND_VOLUME[effect] ?? 0.7): Promise<void> {
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
            // Rewound first, then played: calling play while the rewind was
            // still in flight is what made the same sound play one time and
            // not the next.
            await player.seekTo(0).catch(() => undefined);
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

