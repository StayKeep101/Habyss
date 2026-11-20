import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import { useEffect, useState } from 'react';

/**
 * Bedtime lock: when the day is done (bedtime, from your day window in
 * lib/echo.ts), every other app goes quiet until wake. Habyss itself stays
 * open, to plan tomorrow. With Screen Time allowed, every app is blocked for the same hours, by
 * iOS, whether or not Habyss is open (Night in ios/Gate/GateShared.swift); calls
 * and emergencies always work. Switching it off waits like removing an app
 * (lib/gateLock.ts): 24 hours, then an hour to do it.
 */

const KEY = 'habyss_bedtime_lock';

/** Night between `sleep` and `wake` (minutes from midnight); bedtime may be after midnight. */
export function isNight(minute: number, wake: number, sleep: number): boolean {
    if (sleep === wake) return false;
    return sleep > wake ? minute >= sleep || minute < wake : minute >= sleep && minute < wake;
}

/** Milliseconds until the night starts or ends, whichever is next (for one timer, not polling). */
export function msToNextEdge(now: Date, wake: number, sleep: number): number {
    const minute = now.getHours() * 60 + now.getMinutes();
    const edge = isNight(minute, wake, sleep) ? wake : sleep;
    let minutes = edge - minute;
    if (minutes <= 0) minutes += 1440;
    return minutes * 60_000 - now.getSeconds() * 1000 - now.getMilliseconds();
}

let on: boolean | null = null;
const listeners = new Set<() => void>();

export async function bedtimeLockOn(): Promise<boolean> {
    if (on != null) return on;
    // On unless switched off: the night is blocked by default.
    try { on = (await AsyncStorage.getItem(KEY)) !== 'off'; } catch { on = true; }
    return on;
}

export async function setBedtimeLock(next: boolean): Promise<void> {
    on = next;
    listeners.forEach(listener => listener());
    await AsyncStorage.setItem(KEY, next ? 'on' : 'off').catch(() => undefined);
    await syncBedtime();
}

/** This build can block apps at night (a build from before only puts Habyss to sleep). */
export function nightBlockSupported(): boolean {
    return Platform.OS === 'ios' && typeof NativeModules.ScreenTimeModule?.setNight === 'function';
}

/** Sends the night's hours to iOS. Called when the setting or the day window changes, and on launch. */
export async function syncBedtime(): Promise<void> {
    if (!nightBlockSupported()) return;
    const { getDayWindow, minutesOf } = require('./echo') as typeof import('./echo');
    const day = await getDayWindow();
    NativeModules.ScreenTimeModule.setNight(JSON.stringify({ on: await bedtimeLockOn(), sleep: minutesOf(day.sleep), wake: minutesOf(day.wake) }));
}

export function useBedtimeLock(): boolean {
    const [value, setValue] = useState(on ?? true);
    useEffect(() => {
        const read = () => { void bedtimeLockOn().then(setValue); };
        read();
        listeners.add(read);
        return () => { listeners.delete(read); };
    }, []);
    return value;
}
