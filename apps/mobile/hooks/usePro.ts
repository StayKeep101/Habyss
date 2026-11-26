import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { getPro, onProChange, refreshPro } from '@/lib/access';

let asked = false;

/** Whether Habyss Pro (desktop sync) is active (lib/access.ts), asked once and again whenever the app comes back. */
export function usePro() {
    const pro = useSyncExternalStore(onProChange, getPro);
    useEffect(() => {
        if (!asked) { asked = true; void refreshPro(); }
        const sub = AppState.addEventListener('change', next => { if (next === 'active') void refreshPro(); });
        return () => sub.remove();
    }, []);
    return pro;
}
