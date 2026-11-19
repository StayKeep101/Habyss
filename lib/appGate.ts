import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Earn your scroll: the apps chosen in App blocking are always blocked. The
 * only way in is Shards: an hour costs 100, spent on the server
 * (buy_scroll_hour), and the block comes back by itself. Shards come from
 * finishing habits, tasks and goals, so the fun is earned every day.
 *
 * The block itself is native (ios/Gate/GateShared.swift and three Screen Time
 * extensions); this sends it what the block screen says, and keeps the Shards
 * it can spend current.
 */

/** What an hour costs, and how long it lasts. The server holds the same price. */
export const GATE_PRICE = 100;
export const GATE_MINUTES = 60;

/**
 * What the block screen says: the joke in the title, one short line for each
 * fact under it, and buttons of two or three words so iOS never wraps them. Pure.
 */
export function shieldWords(): { title: string; lines: string[]; primary: string; secondary: string } {
    return {
        title: 'Nice try.',
        lines: ['You blocked this. Good call.', `An hour costs ${GATE_PRICE} Shards.`],
        primary: 'Back to work',
        secondary: 'Unlock 1 hour',
    };
}

/**
 * Sends the block to iOS: always on, never earned, open only within an hour
 * bought. Called when the app opens or comes back, and whenever a habit or task
 * changes (app/_layout.tsx), which also keeps the Shards current.
 */
export async function syncGate(now = new Date()): Promise<void> {
    try {
        const { localDateKey } = require('./habitSchedule') as typeof import('./habitSchedule');
        const { ScreenTimeService } = require('./ScreenTimeService') as typeof import('./ScreenTimeService');
        const words = shieldWords();
        ScreenTimeService.setGate({
            on: true, day: localDateKey(now), earned: false, planned: 1, remaining: [], unlockedUntil: 0,
            title: words.title, lines: words.lines, primary: words.primary, secondary: words.secondary,
        });
        void settleShards();
    } catch { /* tried again on the next sync */ }
}

/**
 * The block screen buys an hour on the spot from what the server last said you
 * can spend; this keeps that number current, charges on the server any hour
 * bought there since, and puts the countdown on the Dynamic Island while the
 * apps are open. Runs whenever the gate is synced (the app opening, coming back,
 * a tick). Read from the server at most every two minutes.
 */
let walletAt = 0;
async function settleShards(): Promise<void> {
    const { ScreenTimeService } = require('./ScreenTimeService') as typeof import('./ScreenTimeService');
    if (!ScreenTimeService.gateSupported()) return;
    try {
        const pending = await ScreenTimeService.takePendingUnlocks();
        if (pending.length) {
            const { getSupabase } = require('./supabase') as typeof import('./supabase');
            const sb = getSupabase();
            // One charge per hour bought on the block screen. Short by then (spent elsewhere): it stays free.
            if (sb) for (let index = 0; index < pending.length; index++) await sb.rpc('buy_scroll_hour').then(() => undefined, () => undefined);
            walletAt = 0;
        }
        if (Date.now() - walletAt > 2 * 60_000) {
            const { myWallet } = require('./market') as typeof import('./market');
            const wallet = await myWallet();
            if (wallet.spendable !== null) { ScreenTimeService.setWallet(wallet.spendable); walletAt = Date.now(); }
        }
        const openUntil = await ScreenTimeService.gateOpenUntil();
        if (openUntil && openUntil * 1000 > Date.now()) await showOpenCountdown(openUntil * 1000);
    } catch { /* tried again on the next sync */ }
}

const COUNTDOWN_KEY = 'habyss_gate_countdown';
/** The hour bought, counting down on the Dynamic Island and the Lock Screen, until the apps lock again. */
export async function showOpenCountdown(until: number): Promise<void> {
    try {
        const shown = Number(await AsyncStorage.getItem(COUNTDOWN_KEY).catch(() => null));
        if (shown === until) return;
        const { Platform } = require('react-native') as typeof import('react-native');
        if (Platform.OS !== 'ios') return;
        const LiveActivity = (require('@/modules/habyss-live-activity') as typeof import('@/modules/habyss-live-activity')).default;
        if (!LiveActivity?.startActivity) return;
        const at = new Date(until);
        const { clockLabel } = require('./dayFlow') as typeof import('./dayFlow');
        LiveActivity.startActivity(
            { name: 'Habyss Live Activity', totalDurationSeconds: Math.max(60, (until - Date.now()) / 1000) },
            { title: 'Your apps are open', subtitle: `Locked again at ${clockLabel(at.getHours() * 60 + at.getMinutes())}`, timerEndDateInMilliseconds: until, progress: 0 },
        );
        await AsyncStorage.setItem(COUNTDOWN_KEY, String(until)).catch(() => undefined);
    } catch { /* the hour still runs; only the countdown is missing */ }
}

/**
 * An hour for 100 Shards: spent on the server first (it checks the balance),
 * then the block lifts and comes back by itself an hour later.
 * Returns when it closes again (ms), or throws with what went wrong.
 */
export async function buyScrollHour(): Promise<number> {
    const { getSupabase } = require('./supabase') as typeof import('./supabase');
    const sb = getSupabase();
    const { data } = sb ? await sb.auth.getSession() : { data: null };
    if (!sb || !data?.session?.user?.id) throw new Error('Sign in to spend Shards.');
    const { error } = await sb.rpc('buy_scroll_hour');
    if (error) throw new Error(error.message || 'Could not spend the Shards. Please try again.');
    const { ScreenTimeService } = require('./ScreenTimeService') as typeof import('./ScreenTimeService');
    const until = await ScreenTimeService.unlockGate(GATE_MINUTES);
    const at = until ? until * 1000 : Date.now() + GATE_MINUTES * 60_000;
    walletAt = 0;
    await showOpenCountdown(at);
    return at;
}
