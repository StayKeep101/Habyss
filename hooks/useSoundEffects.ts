import { Audio } from 'expo-av';
import { useCallback, useState, useEffect } from 'react';

// Using remote URLs for immediate demonstration. 
// For production, download these files to assets/sounds/ and require() them.
const SOUNDS = {
    click: 'https://www.soundjay.com/buttons/sounds/button-16.mp3',
    success: 'https://www.soundjay.com/buttons/sounds/button-3.mp3',
    complete: 'https://www.soundjay.com/misc/sounds/magic-chime-01.mp3',
    pop: 'https://www.soundjay.com/buttons/sounds/button-09.mp3',
};

import { useAppSettings } from '@/constants/AppSettingsContext';

export const useSoundEffects = () => {
    const { soundsEnabled } = useAppSettings();
    const [sound, setSound] = useState<Audio.Sound>();

    const playSound = useCallback(async (soundUrl: string) => {
        if (!soundsEnabled) return;
        try {
            // Unload previous sound if any
            if (sound) {
                await sound.unloadAsync();
            }

            /* 
            // Commenting out actual playback to prevent -1102 errors until assets are local
            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: soundUrl },
                { shouldPlay: true }
            );
            setSound(newSound);
            await newSound.playAsync(); 
            */
            // Mock success for now
            return;
        } catch (error) {
            console.log('Error playing sound:', error);
        }
    }, [sound]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (sound) {
                sound.unloadAsync();
            }
        };
    }, [sound]);

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
