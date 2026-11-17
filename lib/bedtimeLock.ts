import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import { useEffect, useState } from 'react';

/**
 * Bedtime lock: when the day is done (bedtime, from your day window in
 * lib/echo.ts), Habyss falls asleep: one quiet screen over the whole app until
 * wake. With Screen Time allowed, every app is blocked for the same hours, by
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
    try { on = (await AsyncStorage.getItem(KEY)) === 'on'; } catch { on = false; }
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
    const [value, setValue] = useState(on ?? false);
    useEffect(() => {
        const read = () => { void bedtimeLockOn().then(setValue); };
        read();
        listeners.add(read);
        return () => { listeners.delete(read); };
    }, []);
    return value;
}

/** Whether Habyss is asleep now, and when it wakes ("07:00"). Re-read exactly at bedtime and at wake. */
export function useAsleep(): { asleep: boolean; wake: string } {
    const lock = useBedtimeLock();
    const [state, setState] = useState({ asleep: false, wake: '07:00' });
    useEffect(() => {
        if (!lock) return;
        let alive = true;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const { getDayWindow, minutesOf } = require('./echo') as typeof import('./echo');
        const read = async () => {
            const day = await getDayWindow();
            if (!alive) return;
            const now = new Date();
            const wake = minutesOf(day.wake);
            const sleep = minutesOf(day.sleep);
            setState({ asleep: isNight(now.getHours() * 60 + now.getMinutes(), wake, sleep), wake: day.wake });
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => void read(), msToNextEdge(now, wake, sleep) + 500);
        };
        void read();
        // Timers stop while the phone sleeps: read again whenever the app comes back.
        const { AppState } = require('react-native') as typeof import('react-native');
        const sub = AppState.addEventListener('change', next => { if (next === 'active') void read(); });
        return () => { alive = false; if (timer) clearTimeout(timer); sub.remove(); };
    }, [lock]);
    // Switched off, it is awake at once, whatever was last read.
    return lock ? state : { asleep: false, wake: state.wake };
}
