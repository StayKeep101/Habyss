import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { getAccess, refreshAccess, subscribeAccess } from '@/lib/access';

let asked = false;

/** Whether Habyss is open to you (lib/access.ts), asked once and again whenever the app comes back. */
export function useAccess() {
    const state = useSyncExternalStore(subscribeAccess, getAccess);
    useEffect(() => {
        if (!asked) { asked = true; void refreshAccess(); }
        const sub = AppState.addEventListener('change', next => { if (next === 'active') void refreshAccess(); });
        return () => sub.remove();
    }, []);
    return state;
}
