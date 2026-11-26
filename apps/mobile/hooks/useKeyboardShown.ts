import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/** Whether the keyboard is up, from the moment it starts to rise (iOS) or appears (Android). */
export function useKeyboardShown(): boolean {
    const [shown, setShown] = useState(false);
    useEffect(() => {
        const up = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setShown(true));
        const down = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setShown(false));
        return () => { up.remove(); down.remove(); };
    }, []);
    return shown;
}
