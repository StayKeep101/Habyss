import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { router, usePathname } from 'expo-router';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { tiltToFocusOn } from '@/lib/tiltToFocus';

/** How long the phone must stay on its side before focus opens (ms). */
const HOLD_MS = 700;

/**
 * Turn the phone on its side and focus opens on whatever the day is on right
 * now: the habit or task due, or the meal or event under way
 * (hooks/useFocusDay.ts). The app itself stays upright; this reads the
 * accelerometer, only while the app is open, and fires once per turn: the
 * phone has to come back upright before it can open focus again. Lying flat
 * on a table never counts. Settings → Focus → Turn sideways to focus.
 */
export function useTiltToFocus(): void {
    const pathname = usePathname();
    const onFocusPage = pathname.startsWith('/focus');
    const here = useRef({ onFocusPage });
    here.current.onFocusPage = onFocusPage;

    useEffect(() => {
        // A build without the sensor module (older installs): nothing to read.
        if (!requireOptionalNativeModule('ExponentAccelerometer')) return;
        const { Accelerometer } = require('expo-sensors') as typeof import('expo-sensors');
        let subscription: { remove: () => void } | null = null;
        let sidewaysSince: number | null = null;
        let armed = true;

        const start = async () => {
            if (subscription || !(await tiltToFocusOn())) return;
            Accelerometer.setUpdateInterval(200);
            subscription = Accelerometer.addListener(({ x, y, z }) => {
                // On its side: gravity along the long edge's width (x), not lying flat (z).
                const sideways = Math.abs(x) > 0.75 && Math.abs(y) < 0.45 && Math.abs(z) < 0.6;
                const upright = Math.abs(y) > 0.7 && Math.abs(x) < 0.4;
                if (upright) { armed = true; sidewaysSince = null; return; }
                if (!sideways || !armed) { sidewaysSince = null; return; }
                sidewaysSince ??= Date.now();
                if (Date.now() - sidewaysSince < HOLD_MS || here.current.onFocusPage) return;
                armed = false;
                sidewaysSince = null;
                router.push({ pathname: '/(root)/focus', params: { day: '1' } });
            });
        };
        const stop = () => { subscription?.remove(); subscription = null; sidewaysSince = null; };

        if (AppState.currentState === 'active') void start();
        const appState = AppState.addEventListener('change', state => (state === 'active' ? void start() : stop()));
        const { on } = require('@/lib/appEvents') as typeof import('@/lib/appEvents');
        const setting = on('tilt_to_focus_changed', () => { stop(); if (AppState.currentState === 'active') void start(); });
        return () => { stop(); appState.remove(); setting.remove(); };
    }, []);
}

/** Mounts the listener without making its parent redraw on every navigation. */
export function TiltToFocus() {
    useTiltToFocus();
    return null;
}
