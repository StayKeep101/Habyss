import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Crashes, reported so they can be fixed.
 *
 * Any error nothing else caught (a tap handler, a callback, a promise chain
 * that throws on the JS thread) is written down before the app goes, then
 * sent the next time it opens, as a feedback row marked `kind: crash` with
 * the message, where in the code it happened, and what the app was doing.
 * Nothing personal: no habits, no names, no account data.
 *
 * With a Sentry key in the build (EXPO_PUBLIC_SENTRY_DSN), crashes also go to
 * Sentry, which catches what this cannot: native crashes, promises nobody
 * handled, and every crash rather than the latest. Without a key, or on a
 * build without its native module, only the record here is kept.
 */
const KEY = 'habyss_pending_crash';
let installed = false;

interface Crash { message: string; stack: string; fatal: boolean; at: string; where?: string }

function record(error: unknown, fatal: boolean, where?: string): Promise<void> {
    const err = error instanceof Error ? error : new Error(String(error));
    const crash: Crash = {
        message: err.message.slice(0, 500),
        stack: (err.stack ?? '').split('\n').slice(0, 12).join('\n').slice(0, 1500),
        fatal,
        at: new Date().toISOString(),
        where,
    };
    return AsyncStorage.setItem(KEY, JSON.stringify(crash)).catch(() => undefined);
}

type SentryModule = typeof import('@sentry/react-native');
let sentry: SentryModule | null = null;

function startSentry(): void {
    const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
    if (!dsn || __DEV__) return;
    try {
        const module = require('@sentry/react-native') as SentryModule;
        let environment = 'production';
        try { environment = (require('expo-updates') as typeof import('expo-updates')).channel || environment; } catch { /* keep production */ }
        module.init({
            dsn,
            environment,
            // Crashes only: no screen recording, no performance tracing, no
            // personal data (the policy promises no analytics).
            sendDefaultPii: false,
            tracesSampleRate: 0,
            enableAutoSessionTracking: false,
            attachScreenshot: false,
        });
        sentry = module;
    } catch {
        sentry = null;
    }
}

/** Catches what nothing else did. Called once, as early as the app starts. */
export function installCrashReporting(): void {
    if (installed) return;
    installed = true;
    startSentry();
    const utils = (globalThis as { ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void } }).ErrorUtils;
    if (!utils) return;
    const previous = utils.getGlobalHandler();
    utils.setGlobalHandler((error, fatal) => {
        // Write it down first; give the write a moment before the default
        // handler takes the app down, so the report survives the crash.
        void record(error, !!fatal);
        if (fatal) setTimeout(() => previous(error, fatal), 400);
        else previous(error, fatal);
    });
}

/** For error boundaries: a render error the screen recovered from. */
export function reportCaught(error: unknown, where: string): void {
    void record(error, false, where);
    try { sentry?.captureException(error, { tags: { where } }); } catch { /* recorded above */ }
}

/** Sends a crash written down last time, then forgets it. */
export async function sendPendingCrash(): Promise<void> {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        if (!raw) return;
        const crash = JSON.parse(raw) as Crash;
        const { sendFeedback } = require('./feedback') as typeof import('./feedback');
        await sendFeedback(`[crash] ${crash.message}\n\n${crash.stack}`, { screen: crash.where ?? 'crash', kind: 'crash', fatal: crash.fatal, at: crash.at } as never);
        await AsyncStorage.removeItem(KEY);
    } catch { /* tried; next launch tries again */ }
}
