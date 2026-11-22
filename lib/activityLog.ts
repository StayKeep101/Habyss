import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDateKey } from './habitSchedule';

/**
 * Your activity, from Apple Health, kept on this phone: exercise minutes (the
 * green ring, from the Watch and from workouts any app saves) and steps, by
 * day, and the exercise goal. Moving is one of the surest ways to a good
 * mood, a clear head and a productive day, so it sits beside sleep on Home.
 *
 * One copy in memory for every screen, like sleep (lib/sleepLog.ts). Only read
 * once Health is connected; the first read on a phone that connected for
 * sleep only asks iOS once for the activity types too.
 */
/** A day: exercise minutes, steps, and active energy (kcal, when Health has it). */
export interface ActivityDay { minutes: number; steps: number; energy?: number }
export interface ActivityState {
    days: Record<string, ActivityDay>;
    /** Exercise goal, in minutes a day. */
    target: number;
    connected: boolean;
    /** Whether Home shows the activity card (Settings). On by default. */
    showCard?: boolean;
    /** The day activity began to count here (the account's, not Health's years). */
    since?: string;
    /** Activity types asked for once on this phone. */
    asked?: boolean;
}

const KEY = 'habyss_activity_log';
const DAYS = 14;
export const DEFAULT_EXERCISE_TARGET = 30;
export const EXERCISE_GOALS = [15, 30, 45, 60];

let state: ActivityState = { days: {}, target: DEFAULT_EXERCISE_TARGET, connected: false };
let loaded = false;
let refreshing: Promise<void> | null = null;
const listeners = new Set<() => void>();
const publish = (next: ActivityState) => { state = next; listeners.forEach(listener => listener()); };

export const currentActivity = (): ActivityState => state;
export function subscribeActivity(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

async function save(next: ActivityState) {
    publish(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
}

async function loadStored(): Promise<void> {
    if (loaded) return;
    loaded = true;
    try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) publish({ ...state, ...(JSON.parse(raw) as Partial<ActivityState>) });
    } catch { /* starts empty */ }
}

/** Reads the last two weeks from Health; this week again every time (a watch syncs late). */
export function refreshActivity(): Promise<void> {
    refreshing ??= (async () => {
        await loadStored();
        const { HealthKitService } = require('./HealthKitService') as typeof import('./HealthKitService');
        if (!HealthKitService.isAvailable || !(await HealthKitService.authorised())) {
            if (state.connected) await save({ ...state, connected: false });
            return;
        }
        // Connected for sleep before activity was read: iOS asks once for the new types.
        if (!state.asked) { await HealthKitService.init().catch(() => false); state = { ...state, asked: true }; }
        const today = new Date();
        const since = state.since ?? localDateKey(today);
        const days: Record<string, ActivityDay> = {};
        for (const [key, value] of Object.entries(state.days)) if (key >= since) days[key] = value;
        for (let back = 0; back < DAYS; back++) {
            const date = new Date(today);
            date.setDate(today.getDate() - back);
            const key = localDateKey(date);
            if (key < since) break;
            if (back > 7 && days[key] !== undefined) continue;
            const [minutes, steps, energy] = await Promise.all([
                HealthKitService.exerciseMinutes(date).catch(() => null),
                HealthKitService.steps(date).catch(() => null),
                HealthKitService.activeEnergy(date).catch(() => null),
            ]);
            if (minutes === null && steps === null) continue;
            days[key] = { minutes: minutes ?? 0, steps: steps ?? 0, ...(energy !== null ? { energy } : null) };
        }
        const oldest = new Date(today);
        oldest.setDate(today.getDate() - 60);
        const floor = localDateKey(oldest);
        for (const key of Object.keys(days)) if (key < floor) delete days[key];
        await save({ ...state, days, connected: true, since });
    })().finally(() => { refreshing = null; });
    return refreshing;
}

export async function setActivityCardVisible(show: boolean): Promise<void> {
    await loadStored();
    await save({ ...state, showCard: show });
}

export async function setExerciseTarget(minutes: number): Promise<void> {
    await loadStored();
    await save({ ...state, target: Math.max(5, Math.min(240, Math.round(minutes))) });
}

/** Days the exercise goal was reached (+20 Marks and Shards each, like a good night). Missing it costs nothing. */
export const activeDays = (activity: ActivityState): string[] =>
    Object.entries(activity.days).filter(([, day]) => day.minutes >= activity.target).map(([date]) => date);
