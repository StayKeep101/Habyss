/**
 * useSounds Hook
 * Provides easy access to sound effects throughout the app
 * Respects the user's soundsEnabled setting
 */

import { useCallback, useEffect } from 'react';
import { useAppSettings } from '@/constants/AppSettingsContext';
import {
    playSound as playSoundService,
    preloadCommonSounds,
    initializeAudio,
    SoundEffect
} from '@/lib/soundService';

export const useSounds = () => {
    // Get global sound setting
    let soundsEnabled = true;
    try {
        const settings = useAppSettings();
        soundsEnabled = settings.soundsEnabled;
    } catch (e) {
        // Context not available, default to enabled
    }

    // Initialize audio on first render
    useEffect(() => {
        initializeAudio();
        preloadCommonSounds();
    }, []);

    // Generic play function that respects user settings
    const play = useCallback((effect: SoundEffect, volume: number = 0.7) => {
        if (soundsEnabled) {
            playSoundService(effect, volume);
        }
    }, [soundsEnabled]);

    // Convenience methods for common sounds
    const playComplete = useCallback(() => play('complete'), [play]);
    const playTap = useCallback(() => play('tap', 0.5), [play]);
    const playSuccess = useCallback(() => play('success'), [play]);
    const playError = useCallback(() => play('error', 0.6), [play]);
    const playStreak = useCallback(() => play('streak'), [play]);
    const playLevelUp = useCallback(() => play('levelUp'), [play]);
    const playNotification = useCallback(() => play('notification', 0.8), [play]);
    const playSwipe = useCallback(() => play('swipe', 0.4), [play]);
    const playToggle = useCallback(() => play('toggle', 0.5), [play]);
    const playCelebrate = useCallback(() => play('celebrate'), [play]);

    return {
        enabled: soundsEnabled,
        play,
        // Convenience methods
        playComplete,
        playTap,
        playSuccess,
        playError,
        playStreak,
        playLevelUp,
        playNotification,
        playSwipe,
        playToggle,
        playCelebrate,
    };
};

export type { SoundEffect };
