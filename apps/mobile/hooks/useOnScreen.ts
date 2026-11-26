import { useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { NavigationContext } from 'expo-router/react-navigation';

/**
 * Whether what calls it can be seen right now: its screen is the one in front
 * (not a tab behind another, not under a page pushed on top) and the app is
 * open. Endless motion (a twinkle, drifting specks, a breathing orb) runs only
 * while this is true: a loop nobody sees still redraws the screen up to 120
 * times a second, and that is what warms the phone.
 *
 * Works outside a navigator too (a sheet, a test): there it follows the app alone.
 */
export function useOnScreen(): boolean {
    const navigation = useContext(NavigationContext);
    const [focused, setFocused] = useState(() => navigation?.isFocused() ?? true);
    const [active, setActive] = useState(AppState.currentState === 'active');

    useEffect(() => {
        if (!navigation) return;
        setFocused(navigation.isFocused());
        const offFocus = navigation.addListener('focus', () => setFocused(true));
        const offBlur = navigation.addListener('blur', () => setFocused(false));
        return () => { offFocus(); offBlur(); };
    }, [navigation]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', state => setActive(state === 'active'));
        return () => subscription.remove();
    }, []);

    return focused && active;
}
