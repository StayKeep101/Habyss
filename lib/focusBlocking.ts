import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

/**
 * Whether focus blocks the apps you chose (Settings → Your plan). On unless
 * switched off: every focus session, from the timeline, a habit or the watch,
 * raises the Screen Time shield until it ends or is paused.
 */
const KEY = 'habyss_focus_blocking';
let listeners: ((on: boolean) => void)[] = [];

export async function focusBlockingOn(): Promise<boolean> {
    try { return (await AsyncStorage.getItem(KEY)) !== 'off'; } catch { return true; }
}

export async function setFocusBlocking(on: boolean): Promise<void> {
    await AsyncStorage.setItem(KEY, on ? 'on' : 'off').catch(() => undefined);
    listeners.forEach(listener => listener(on));
}

export function useFocusBlocking(): boolean {
    const [on, setOn] = useState(true);
    useEffect(() => {
        let alive = true;
        void focusBlockingOn().then(value => { if (alive) setOn(value); });
        listeners.push(setOn);
        return () => { alive = false; listeners = listeners.filter(listener => listener !== setOn); };
    }, []);
    return on;
}
