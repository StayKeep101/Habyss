import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useAppSettings } from '@/context/AppSettingsContext';
import { setBackgroundMusic } from '@/lib/backgroundMusic';

/** Plays Habyss's music while the app is open and Music is on (lib/backgroundMusic.ts). */
export function useBackgroundMusic(): void {
    const { musicEnabled, isLoaded } = useAppSettings();
    const [active, setActive] = useState(AppState.currentState === 'active');
    useEffect(() => {
        const subscription = AppState.addEventListener('change', state => setActive(state === 'active'));
        return () => subscription.remove();
    }, []);
    useEffect(() => { setBackgroundMusic(isLoaded && musicEnabled && active); }, [isLoaded, musicEnabled, active]);
    useEffect(() => () => setBackgroundMusic(false), []);
}
