import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { lineOrder, type FlowInput } from './dayFlow';

/**
 * Earn your scroll: the apps chosen in Settings (the same ones Focus blocks)
 * stay blocked until today's top 3 are done. Then they open for the rest of
 * the day ("You earned it"). Before that, an hour costs 100 Shards, spent on
 * the server (buy_scroll_hour), and the block comes back by itself.
 *
 * The top 3 are today's three most important habits and tasks, in the
 * timeline's own order (lib/dayFlow.ts lineOrder): tasks first, then urgent,
 * then hard. Nothing planned is not a way out: the block asks you to plan.
 * Once earned, the day stays open even if something new comes in.
 *
 * The block itself is native (ios/Gate/GateShared.swift and three Screen Time
 * extensions); this works out what it should say and sends it there.
 */

const ON_KEY = 'habyss_app_gate';
const EARNED_KEY = 'habyss_app_gate_earned';
/** What an hour costs, and how long it lasts. The server holds the same price. */
export const GATE_PRICE = 100;
export const GATE_MINUTES = 60;

export interface GateView {
    /** The three that open the day, done or not, in order. */
    top: { id: string; title: string; done: boolean }[];
    /** Today's top 3 are done (or were, earlier today). */
    earned: boolean;
    /** How many habits and tasks today has: none means "plan your day first". */
    planned: number;
}

/** Today's top 3 and whether the day is earned. `earnedDay`: the day it was last earned. */
export function gateView(items: FlowInput[], today: string, earnedDay: string | null): GateView {
    const doable = items.filter(item => item.kind === 'habit' || item.kind === 'task');
    const top = [...doable].sort(lineOrder).slice(0, 3).map(item => ({ id: item.id, title: item.title, done: item.done }));
    const earned = earnedDay === today || (top.length > 0 && top.every(item => item.done));
    return { top, earned, planned: doable.length };
}

export async function gateOn(): Promise<boolean> {
    try { return (await AsyncStorage.getItem(ON_KEY)) === 'on'; } catch { return false; }
}

let listeners: (() => void)[] = [];
const changed = () => listeners.forEach(listener => listener());

export async function setGateOn(on: boolean): Promise<void> {
    await AsyncStorage.setItem(ON_KEY, on ? 'on' : 'off').catch(() => undefined);
    changed();
    await syncGate();
}

/** Today's habits and tasks as the timeline sees them. */
async function todayItems(now: Date): Promise<{ items: FlowInput[]; today: string }> {
    const { getHabits, getCompletions, isHabitScheduledForDate } = require('./habitsSQLite') as typeof import('./habitsSQLite');
    const { getTasks, tasksForDay } = require('./tasks') as typeof import('./tasks');
    const { localDateKey } = require('./habitSchedule') as typeof import('./habitSchedule');
    const { flowInputs } = require('./dayFlow') as typeof import('./dayFlow');
    const today = localDateKey(now);
    const [habits, tasks, done] = await Promise.all([getHabits(), getTasks({ includeDone: true }), getCompletions(today)]);
    const items = flowInputs({
        habits: habits.filter(habit => !habit.isGoal && !habit.isArchived && isHabitScheduledForDate(habit, now)),
        tasks: tasksForDay(tasks, today, today), done, day: today, today,
    });
    return { items, today };
}

let last: GateView | null = null;
export const currentGate = (): GateView | null => last;

/**
 * Works out today's gate and sends it to the block screen. Called when the app
 * opens or comes back, and whenever a habit or task changes (app/_layout.tsx).
 * The first time the day is earned, it says so.
 */
export async function syncGate(now = new Date()): Promise<GateView | null> {
    try {
        const on = await gateOn();
        const { items, today } = await todayItems(now);
        const earnedDay = await AsyncStorage.getItem(EARNED_KEY).catch(() => null);
        const view = gateView(items, today, earnedDay);
        if (on && view.earned && earnedDay !== today) {
            await AsyncStorage.setItem(EARNED_KEY, today).catch(() => undefined);
            void tellEarned();
        }
        last = view;
        changed();
        if (on) void settleShards();
        const { ScreenTimeService } = require('./ScreenTimeService') as typeof import('./ScreenTimeService');
        const words = shieldWords(view);
        ScreenTimeService.setGate({
            on, day: today, earned: view.earned, planned: view.planned,
            remaining: view.top.filter(item => !item.done).map(item => item.title), unlockedUntil: 0,
            title: words.title, lines: words.lines,
        });
        return view;
    } catch {
        return null;
    }
}

/**
 * What the block screen says (the Focus Gate, drawn like the app's own page,
 * app/(root)/unlock.tsx): a title, the line under it, today's top 3 as a
 * list with the done ones ticked, and the count. Apple centres every line and
 * draws only text there, so the rings are characters. Pure.
 */
export function shieldWords(view: GateView): { title: string; lines: string[] } {
    if (view.planned === 0) {
        return { title: 'Plan your day first', lines: ['Add what matters in Habyss,', 'then finish your top 3.'] };
    }
    const done = view.top.filter(item => item.done).length;
    return {
        title: 'Earn your scroll',
        lines: [
            'Complete your priorities or redeem Shards.',
            '',
            ...view.top.map(item => `${item.done ? '✓' : '○'}  ${item.title}`),
            '',
            `${done} / ${view.top.length} complete`,
        ],
    };
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

async function tellEarned() {
    try {
        const Notifications = require('expo-notifications') as typeof import('expo-notifications');
        await Notifications.scheduleNotificationAsync({
            content: { title: '🎉 You earned it', body: 'Your top 3 are done. Your apps are open for the rest of today.', data: { type: 'gate_earned' } },
            trigger: null,
        });
    } catch { /* the block is lifted either way */ }
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

/** The gate as Settings and the unlock page show it. */
export function useAppGate(): { on: boolean; view: GateView | null } {
    const [state, setState] = useState<{ on: boolean; view: GateView | null }>({ on: false, view: last });
    useEffect(() => {
        let alive = true;
        const read = () => { void gateOn().then(on => { if (alive) setState({ on, view: last }); }); };
        listeners.push(read);
        read();
        void syncGate();
        return () => { alive = false; listeners = listeners.filter(listener => listener !== read); };
    }, []);
    return state;
}
