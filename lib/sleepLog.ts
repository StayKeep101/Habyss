import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDateKey } from './habitSchedule';

/**
 * The last two weeks of sleep, from Apple Health, kept on this phone.
 *
 * One copy in memory for every screen (Home's card, Marks), like the profile
 * store. A night belongs to the morning it ends on. Only read when Health is
 * already connected, so nothing ever asks for permission by itself.
 */
export interface SleepState {
    /** Minutes asleep, by the date of the morning. */
    nights: Record<string, number>;
    /** The goal, in minutes. */
    target: number;
    connected: boolean;
}

const KEY = 'habyss_sleep_log';
const DAYS = 14;
export const DEFAULT_SLEEP_TARGET = 7 * 60;

let state: SleepState = { nights: {}, target: DEFAULT_SLEEP_TARGET, connected: false };
let loaded = false;
let refreshing: Promise<void> | null = null;
const listeners = new Set<() => void>();
const publish = (next: SleepState) => { state = next; listeners.forEach(listener => listener()); };

export const currentSleep = (): SleepState => state;
export function subscribeSleep(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

async function save(next: SleepState) {
    publish(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
}

async function loadStored(): Promise<void> {
    if (loaded) return;
    loaded = true;
    try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) publish({ ...state, ...(JSON.parse(raw) as Partial<SleepState>) });
    } catch { /* starts empty */ }
}

/**
 * Reads the last nights from Health. Older nights already known are kept; the
 * last three are read again, since a watch can sync a night late.
 */
export function refreshSleep(): Promise<void> {
    refreshing ??= (async () => {
        await loadStored();
        const { HealthKitService } = require('./HealthKitService') as typeof import('./HealthKitService');
        if (!HealthKitService.isAvailable || !(await HealthKitService.authorised())) {
            if (state.connected) await save({ ...state, connected: false });
            return;
        }
        const nights = { ...state.nights };
        const today = new Date();
        for (let back = 0; back < DAYS; back++) {
            const date = new Date(today);
            date.setDate(today.getDate() - back);
            const key = localDateKey(date);
            if (back > 2 && nights[key] !== undefined) continue;
            const minutes = await HealthKitService.read('sleep', date).catch(() => null);
            if (minutes !== null && minutes > 0) nights[key] = Math.round(minutes);
        }
        const oldest = new Date(today);
        oldest.setDate(today.getDate() - 60);
        const floor = localDateKey(oldest);
        for (const key of Object.keys(nights)) if (key < floor) delete nights[key];
        await save({ ...state, nights, connected: true });
    })().finally(() => { refreshing = null; });
    return refreshing;
}

export async function setSleepTarget(minutes: number): Promise<void> {
    await loadStored();
    await save({ ...state, target: Math.max(4 * 60, Math.min(11 * 60, Math.round(minutes / 30) * 30)) });
}

/** Nights that reached the goal, for Marks. */
export const goodNights = (sleep: SleepState): string[] =>
    Object.entries(sleep.nights).filter(([, minutes]) => minutes >= sleep.target).map(([date]) => date);

export const formatSleep = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const rest = Math.round(minutes % 60);
    return rest ? `${hours}h ${String(rest).padStart(2, '0')}m` : `${hours}h`;
};
