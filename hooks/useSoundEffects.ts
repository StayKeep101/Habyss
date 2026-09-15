import { useCallback } from 'react';
import { useAppSettings } from '@/constants/AppSettingsContext';

// Using remote URLs for immediate demonstration.
// For production, download these files to assets/sounds/ and require() them.
const SOUNDS = {
    click: 'https://www.soundjay.com/buttons/sounds/button-16.mp3',
    success: 'https://www.soundjay.com/buttons/sounds/button-3.mp3',
    complete: 'https://www.soundjay.com/misc/sounds/magic-chime-01.mp3',
    pop: 'https://www.soundjay.com/buttons/sounds/button-09.mp3',
};

export const useSoundEffects = () => {
    const { soundsEnabled } = useAppSettings();

    const playSound = useCallback(async (soundUrl: string) => {
        if (!soundsEnabled) return;
        // Playback stays disabled until these sounds are bundled locally (remote URLs caused -1102 errors).
        // When enabling, play soundUrl through lib/soundService.ts, which already uses expo-audio.
    }, [soundsEnabled]);

    const playClick = () => playSound(SOUNDS.click);
    const playSuccess = () => playSound(SOUNDS.success);
    const playComplete = () => playSound(SOUNDS.complete);
    const playPop = () => playSound(SOUNDS.pop);

    return {
        playClick,
        playSuccess,
        playComplete,
        playPop
    };
};
