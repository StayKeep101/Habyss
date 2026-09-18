import { useCallback } from 'react';
import { useAppSettings } from '@/constants/AppSettingsContext';
import { playSound, type SoundEffect } from '@/lib/soundService';

/**
 * Sound effects for screens that were written against this older hook.
 *
 * There used to be two sound implementations: this one, with its own remote
 * soundjay.com URLs and playback commented out, and lib/soundService.ts, which
 * streamed different remote files and was wired into Home. Keeping both meant
 * the same tap could behave differently depending on the screen.
 *
 * This now delegates to soundService, which plays bundled audio and stays
 * silent until any is added, so every screen behaves the same way.
 */
export const useSoundEffects = () => {
    const { soundsEnabled } = useAppSettings();

    const play = useCallback((effect: SoundEffect, volume?: number) => {
        if (!soundsEnabled) return;
        void playSound(effect, volume);
    }, [soundsEnabled]);

    return {
        playClick: useCallback(() => play('tap', 0.5), [play]),
        playSuccess: useCallback(() => play('success'), [play]),
        playComplete: useCallback(() => play('complete'), [play]),
        playPop: useCallback(() => play('toggle', 0.5), [play]),
    };
};
