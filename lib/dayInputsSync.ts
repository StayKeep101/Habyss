import AsyncStorage from '@react-native-async-storage/async-storage';
import { DAY_STORES, rowsFromStores, staleKeys, storesFromRows, type DayInputRows } from './dayInputs';

/**
 * The day's settings between this phone and the account (`day_inputs`, owner
 * only, one row per setting), so the desktop builds the same day.
 *
 * Each sync:
 *  1. what changed in the account comes down. A setting changed here and not
 *     sent yet stays as it is here (it goes up in step 2). On the first sync
 *     for an account, the account's settings win, so a new device never sends
 *     its defaults over yours;
 *  2. what differs here from what the account last had goes up, one row per
 *     setting; a travel time removed here is removed there;
 *  3. dated rows older than two weeks are removed from the account.
 *
 * "What the account last had" is kept per key (`sent`), so a change is noticed
 * whichever screen made it, and an edit made offline is sent once back online.
 */

type Remote = { key: string; value: unknown; updated_at: string; deleted_at: string | null };
type Stores = Partial<Record<string, string>>;

const PAGE = 500;
const sentKey = (userId: string) => `day_inputs_sent_${userId}`;
const cursorKey = (userId: string) => `day_inputs_cursor_${userId}`;
/** Calendar slots this phone publishes for the desktop, by day (lib/calendarEvents.ts publishEvents). */
export const PUBLISHED_EVENTS_KEY = 'habyss_published_events';

async function readJson<T>(key: string, fallback: T): Promise<T> {
    try { const raw = await AsyncStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
async function readStores(): Promise<Stores> {
    const pairs = await AsyncStorage.multiGet([...DAY_STORES]);
    const out: Stores = {};
    for (const [key, value] of pairs) if (value != null) out[key] = value;
    return out;
}
const todayKey = (): string => (require('./habitSchedule') as typeof import('./habitSchedule')).localDateKey(new Date());
const same = (a: unknown, b: string | undefined) => b !== undefined && JSON.stringify(a) === b;
const missingTable = (error: any) => ['PGRST205', '42P01'].includes(String(error?.code)) || /could not find the table|does not exist/i.test(String(error?.message));

/** Each module keeps its own copy in memory; after the stores change underneath, they read again. */
async function reloadModules(changed: string[]): Promise<void> {
    const has = (key: string) => changed.includes(key);
    if (has('habyss_day_window')) (require('./echo') as typeof import('./echo')).forgetDayWindow();
    if (has('habyss_meals') || has('habyss_meals_flexible')) await (require('./meals') as typeof import('./meals')).reloadMeals();
    if (has('habyss_event_travel')) await (require('./eventTravel') as typeof import('./eventTravel')).reloadTravel();
    if (has('habyss_day_memory')) await (require('./dayMemory') as typeof import('./dayMemory')).reloadMemory();
    if (has('habyss_ended_early')) await (require('./endedEarly') as typeof import('./endedEarly')).reloadEndedEarly();
    if (has('habyss_reschedules')) await (require('./reschedule') as typeof import('./reschedule')).reloadReschedules();
    if (has('habyss_flow_peak')) (require('./todayFlow') as typeof import('./todayFlow')).forgetPeak();
}

let settle: ReturnType<typeof setTimeout> | null = null;
/** A day setting changed here: a sync follows shortly (bursts collapse into one). */
export function markDayInputsDirty(_store: string): void {
    if (settle) clearTimeout(settle);
    settle = setTimeout(() => { settle = null; void (require('./cloudSync') as typeof import('./cloudSync')).syncNow().catch(() => undefined); }, 1500);
}

/** Returns how many settings went up and came down. Never throws: the day still works here. */
export async function syncDayInputs(sb: any, userId: string): Promise<{ sent: number; received: number }> {
    try {
        // No record of what the account had: this device's first sync for the account.
        const first = (await AsyncStorage.getItem(sentKey(userId))) === null;
        const sent = await readJson<Record<string, string>>(sentKey(userId), {});
        let cursor = await AsyncStorage.getItem(cursorKey(userId));
        const today = todayKey();

        // 1. Changed in the account.
        const before = await readStores();
        const local = rowsFromStores(before, await readJson(PUBLISHED_EVENTS_KEY, {}));
        const merged: DayInputRows = { ...local };
        let received = 0;
        for (;;) {
            let query = sb.from('day_inputs').select('key, value, updated_at, deleted_at').eq('user_id', userId);
            if (cursor) query = query.gt('updated_at', cursor);
            const { data, error } = await query.order('updated_at', { ascending: true }).limit(PAGE);
            if (error) throw error;
            const rows = (data ?? []) as Remote[];
            for (const row of rows) {
                // Changed here and not sent yet; a travel time the account has but this phone dropped counts too (a removal to send).
                const unsent = !first && (row.key in local ? !same(local[row.key], sent[row.key]) : row.key.startsWith('travel:') && row.key in sent);
                if (row.deleted_at) {
                    delete sent[row.key];
                    if (!unsent && row.key.startsWith('travel:') && row.key in merged) { delete merged[row.key]; received++; }
                    continue;
                }
                if (unsent) continue;
                if (!same(merged[row.key], JSON.stringify(row.value))) received++;
                merged[row.key] = row.value;
                sent[row.key] = JSON.stringify(row.value);
            }
            if (rows.length) cursor = rows[rows.length - 1].updated_at;
            if (rows.length < PAGE) break;
        }
        if (received) {
            const next = storesFromRows(merged, today, before);
            // Travel is one store built from every travel row: all of them removed is an empty map, not "unknown".
            if (Object.keys(local).some(key => key.startsWith('travel:')) && next.habyss_event_travel === undefined) next.habyss_event_travel = '{}';
            const changed = Object.keys(next).filter(key => next[key] !== before[key]);
            if (changed.length) {
                await AsyncStorage.multiSet(changed.map(key => [key, next[key]!]));
                await reloadModules(changed);
            }
        }

        // 2. Different here.
        const now = rowsFromStores(await readStores(), await readJson(PUBLISHED_EVENTS_KEY, {}));
        // A day older than two weeks is never sent (the one-day stores keep the last day used, often long past):
        // sending it, then removing it as stale, would repeat on every sync.
        const tooOld = new Set(staleKeys(Object.keys(now), today));
        const up = Object.keys(now).filter(key => !tooOld.has(key) && !same(now[key], sent[key]));
        if (up.length) {
            const { error } = await sb.from('day_inputs').upsert(up.map(key => ({ user_id: userId, key, value: now[key], deleted_at: null })), { onConflict: 'user_id,key' });
            if (error) throw error;
            for (const key of up) sent[key] = JSON.stringify(now[key]);
        }
        const gone = Object.keys(sent).filter(key => key.startsWith('travel:') && !(key in now));
        // 3. Old days.
        const old = staleKeys(Object.keys(sent), today);
        const remove = [...gone, ...old];
        if (remove.length) {
            const { error } = await sb.from('day_inputs').update({ deleted_at: new Date().toISOString() }).eq('user_id', userId).in('key', remove);
            if (error) throw error;
            for (const key of remove) delete sent[key];
        }

        await AsyncStorage.setItem(sentKey(userId), JSON.stringify(sent));
        if (cursor) await AsyncStorage.setItem(cursorKey(userId), cursor);
        return { sent: up.length + remove.length, received };
    } catch (error: any) {
        if (!missingTable(error)) console.warn('[Sync] day settings:', error?.message);
        return { sent: 0, received: 0 };
    }
}

/**
 * While the app is open, another device's change to the day arrives within seconds:
 * the table is in Realtime, and any change to this account's rows starts a sync.
 */
export function watchDayInputs(sb: any, userId: string): () => void {
    const channel = sb.channel(`day_inputs:${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'day_inputs', filter: `user_id=eq.${userId}` }, () => markDayInputsDirty('remote'))
        .subscribe();
    return () => { void sb.removeChannel(channel); };
}
