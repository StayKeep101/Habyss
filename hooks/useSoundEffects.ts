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

export const useSoundEffects = () => {
    const [sound, setSound] = useState<Audio.Sound>();

    const playSound = useCallback(async (soundUrl: string) => {
        try {
            // Unload previous sound if any
            if (sound) {
                await sound.unloadAsync();
            }

            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: soundUrl },
                { shouldPlay: true }
            );
            setSound(newSound);

            // Verify it plays
            await newSound.playAsync();
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
