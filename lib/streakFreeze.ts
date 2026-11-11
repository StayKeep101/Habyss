import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase } from './supabase';
import { localDateKey } from './habitSchedule';

/**
 * Streak freezes: friends can gift them (Echo's "help your friend out"), and
 * one covers a day you miss so the streak you built survives it.
 *
 * The server holds the count and the rules (supabase migration
 * 20261018000100). Here: one in-memory copy (count and the days covered),
 * cached for offline, and the automatic use when yesterday was missed.
 */
export interface FreezeState { count: number; days: string[] }

const KEY = 'habyss_streak_freezes';
let state: FreezeState = { count: 0, days: [] };
let frozen = new Set<string>();
let loaded = false;
const listeners = new Set<() => void>();
const publish = (next: FreezeState) => {
    state = next;
    frozen = new Set(next.days);
    listeners.forEach(listener => listener());
    void AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
};

export const currentFreezes = (): FreezeState => state;
/** Days a freeze covered: the streak treats them as kept. */
export const frozenDays = (): Set<string> => frozen;
export function subscribeFreezes(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export async function loadFreezes(): Promise<FreezeState> {
    if (!loaded) {
        loaded = true;
        try {
            const raw = await AsyncStorage.getItem(KEY);
            if (raw) { const parsed = JSON.parse(raw) as FreezeState; state = parsed; frozen = new Set(parsed.days ?? []); listeners.forEach(l => l()); }
        } catch { /* none yet */ }
    }
    await refreshFreezes();
    return state;
}

export async function refreshFreezes(): Promise<void> {
    const sb = getSupabase();
    if (!sb) return;
    try {
        const { data, error } = await sb.rpc('my_streak_freezes');
        if (error || !data) return;
        publish({ count: Number(data.count) || 0, days: Array.isArray(data.days) ? data.days.map(String) : [] });
    } catch { /* offline: keep the cached copy */ }
}

export type GiftResult = 'sent' | 'too_soon' | 'full' | 'not_friends' | 'signed_out' | 'offline';

/** Sends a friend a freeze. The server enforces friends-only, once a week each, five at most. */
export async function giftFreeze(friendId: string): Promise<GiftResult> {
    const sb = getSupabase();
    if (!sb) return 'offline';
    try {
        const { data, error } = await sb.rpc('gift_streak_freeze', { p_friend: friendId });
        if (error) return 'offline';
        return (data as GiftResult) ?? 'offline';
    } catch {
        return 'offline';
    }
}

/**
 * When yesterday was missed and a freeze is held, spend it on yesterday so
 * the streak carries on. `didOn(day)` says whether anything was done that day;
 * `runBefore` is the streak up to the day before yesterday (no point freezing
 * a day when there is no streak to keep).
 */
export async function coverYesterdayIfMissed(didOn: (day: string) => boolean, runBefore: number, today = new Date()): Promise<boolean> {
    if (state.count < 1 || runBefore < 1) return false;
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const day = localDateKey(yesterday);
    if (frozen.has(day) || didOn(day)) return false;
    const sb = getSupabase();
    if (!sb) return false;
    try {
        const { data } = await sb.rpc('use_streak_freeze', { p_day: day });
        if (data !== true) return false;
        publish({ count: Math.max(0, state.count - 1), days: [...state.days, day].sort() });
        return true;
    } catch {
        return false;
    }
}

export type EarnResult = 'earned' | 'too_soon' | 'full' | 'not_yet' | 'signed_out' | 'offline';

/** A freeze is earned on each 7th day of a run: day 7, 14, 21… */
export const earnsFreeze = (streak: number): boolean => streak >= 7 && streak % 7 === 0;

/**
 * On a 7th day in a row, asks the server for the freeze it earned (the server
 * allows one a week and five held). Refreshes the count when one came.
 */
export async function earnFreezeIfDue(streak: number): Promise<EarnResult> {
    if (!earnsFreeze(streak)) return 'not_yet';
    const sb = getSupabase();
    if (!sb) return 'offline';
    try {
        const { data, error } = await sb.rpc('earn_streak_freeze', { p_streak: streak });
        if (error) return 'offline';
        if (data === 'earned') publish({ count: Math.min(5, state.count + 1), days: state.days });
        return (data as EarnResult) ?? 'offline';
    } catch {
        return 'offline';
    }
}
