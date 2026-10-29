import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase } from './supabase';

/**
 * Puts your Marks total where your friends can see it.
 *
 * Only the number — nothing about what earned it — and nothing at all when
 * you have switched off sharing your progress. Sent only when it changes, so
 * ticking things off costs no network call unless the total actually moved.
 */
const KEY = 'marks_published';
const LOCAL_KEY = 'marks_local_total';

/** Your own total as this phone last worked it out, for the Community board. */
export async function localMarks(): Promise<number | null> {
    try {
        const raw = await AsyncStorage.getItem(LOCAL_KEY);
        return raw === null ? null : Number(raw);
    } catch {
        return null;
    }
}

/** The last 60 days of the running total, for the graph on a profile without a cover. */
export const seriesForProfile = (series: { value: number }[] | undefined): number[] =>
    (series ?? []).slice(-60).map(point => Math.max(0, Math.round(point.value)));

export async function publishMarks(
    total: number,
    series?: { value: number }[],
    /** What a profile shows to be proud of: the longest streak and goals finished. */
    trophies?: { bestStreak: number; goalsCompleted: number },
): Promise<void> {
    AsyncStorage.setItem(LOCAL_KEY, String(Math.max(0, Math.round(total)))).catch(() => { });
    try {
        const sb = getSupabase();
        if (!sb) return;
        const { data } = await sb.auth.getSession();
        const me = data.session?.user?.id;
        if (!me) return;
        const { getSharing } = require('./profileSync') as typeof import('./profileSync');
        const allowed = (await getSharing()).progress;
        const value = allowed ? Math.max(0, Math.round(total)) : null;
        const history = allowed ? seriesForProfile(series) : null;
        const best = allowed && trophies ? trophies.bestStreak : null;
        const goals = allowed && trophies ? trophies.goalsCompleted : null;
        const stamp = `${me}:${value}:${history?.length ?? 0}:${history?.[0] ?? ''}:${best}:${goals}`;
        if ((await AsyncStorage.getItem(KEY)) === stamp) return;
        const { error } = await sb.from('profiles')
            .update({
                marks: value, marks_series: history, marks_updated_at: new Date().toISOString(),
                ...(trophies ? { best_streak: best, goals_completed: goals } : {}),
            }).eq('id', me);
        // A server without the column yet is not an error worth retrying hard.
        if (!error) {
            await AsyncStorage.setItem(KEY, stamp);
            // Friends looking at the board see it move.
            const { announceChange } = require('./livePulse') as typeof import('./livePulse');
            announceChange();
        }
    } catch {
        // Friends see a slightly older total; nothing on this phone is affected.
    }
}

/**
 * What doing has earned in Shards (lib/shards.ts), for the server to check
 * bets against. Private: friends never read it, and the server caps it by the
 * account's age. Sent only when it changes.
 */
const SHARDS_KEY = 'shards_published';
export async function publishShards(earned: number): Promise<void> {
    try {
        const sb = getSupabase();
        if (!sb) return;
        const { data } = await sb.auth.getSession();
        const me = data.session?.user?.id;
        if (!me) return;
        const value = Math.max(0, Math.round(earned));
        const stamp = `${me}:${value}`;
        if ((await AsyncStorage.getItem(SHARDS_KEY)) === stamp) return;
        const { error } = await sb.from('profiles').update({ shards_earned: value }).eq('id', me);
        if (!error) await AsyncStorage.setItem(SHARDS_KEY, stamp);
    } catch { /* bets read a slightly older number; nothing here is affected */ }
}
