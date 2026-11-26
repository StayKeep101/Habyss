import { AppState } from 'react-native';
import { useSyncExternalStore } from 'react';

/**
 * Low Power Mode, read from iOS (a build from runtime 1.0.4 on; before it,
 * always off). While it is on the app treats motion as Reduce Motion does:
 * no looping breath, slower clocks, so a throttled phone is not asked to
 * animate what does not matter. Read when the app comes back and every minute.
 */
let on = false;
const listeners = new Set<() => void>();
let started = false;

function read() {
    try {
        const module = (require('@/modules/habyss-live-activity') as typeof import('@/modules/habyss-live-activity')).default;
        const next = !!module?.isLowPowerMode?.();
        if (next !== on) { on = next; listeners.forEach(listener => listener()); }
    } catch { /* no module: off */ }
}

function start() {
    if (started) return;
    started = true;
    read();
    AppState.addEventListener('change', state => { if (state === 'active') read(); });
    setInterval(read, 60_000);
}

export const lowPowerOn = (): boolean => { start(); return on; };
const subscribe = (listener: () => void) => { start(); listeners.add(listener); return () => { listeners.delete(listener); }; };

export function useLowPower(): boolean {
    return useSyncExternalStore(subscribe, lowPowerOn, lowPowerOn);
}
