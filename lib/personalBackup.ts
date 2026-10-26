import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase } from './database';
import { getSupabase } from './supabase';

/**
 * The backup of everything that is yours but not a table row.
 *
 * Habits, completions and tasks sync row by row (lib/cloudSync.ts). The rest of
 * what makes the app yours lives in AsyncStorage on this phone: Echo's memory,
 * focus totals, check-ins, sleep, meals, the marks ledger, settings, and the
 * partial progress table. Signing out clears the phone, so without this,
 * signing back in (or a new phone) brought back the habits and lost all of it.
 *
 * One JSON document per account (`personal_backups`), written after a
 * successful sync when something changed, read once when an account arrives on
 * a phone. Device-only things (the local id, sync cursors, calendar ids, the
 * downloaded model, push tokens) are not in it.
 *
 * The phone only uploads once it has the account's document (or knows there
 * is none), so a fresh phone's defaults never overwrite a real backup.
 */

/** Stores backed up whole. */
export const BACKED_UP_KEYS = [
    'app_settings', 'profile_nickname',
    'habyss_accent_gradient', 'habyss_custom_colors', 'habyss_week_start', 'habyss_day_window',
    'habyss_notification_prefs', 'habyss_roadmap_filter', 'habyss_voice_destination',
    'habyss_daily_focus_target', 'habyss_onboarding_complete', 'habyss_focus_blocking', 'habyss_tilt_to_focus',
    'habyss_echo_config', 'habyss_echo_memory', 'habyss_echo_patterns', 'habyss_echo_experiments',
    'habyss_echo_written_lines', 'habyss_echo_eggs', 'echo_recent_lines',
    'habyss_check_ins', 'habyss_brain_dump', 'habyss_day_memory', 'habyss_sleep_log',
    'habyss_meals', 'habyss_meals_flexible', 'habyss_event_travel', 'habyss_goal_logs', 'habyss_moved_tasks', 'habyss_peak_targets',
    'habyss_marks_kept', 'marks_local_total', 'habyss_climb_state',
    'habyss_day_celebrated', 'habyss_goal_celebrated', 'habyss_focus_celebrated',
    'focus_all_time_best', 'focus_week_start', 'focus_weekly_total', 'focus_total_sessions_week',
    'focus_completed_sessions_week', 'focus_active_days_week', 'focus_month_start',
    'focus_monthly_total', 'focus_year_start', 'focus_yearly_total',
] as const;

/** Stores whose keys share a prefix (one per day or per session). */
const BACKED_UP_PREFIXES = ['focus_session_'];

/** Days of partial progress kept in the backup. */
const MEASUREMENT_DAYS = 120;

/** Which account this phone's stores belong to, once restored or first uploaded. */
const OWNER_KEY = 'habyss_personal_backup_owner';
/** The last document uploaded, so an unchanged one is not sent again. */
const SENT_KEY = 'habyss_personal_backup_sent';

interface Measurement { habit_id: string; date: string; value: number; updated_at: string }
export interface PersonalDocument {
    version: 1;
    stores: Record<string, string>;
    measurements?: Measurement[];
}

const isBackedUp = (key: string) =>
    (BACKED_UP_KEYS as readonly string[]).includes(key) || BACKED_UP_PREFIXES.some(prefix => key.startsWith(prefix));

/** This phone's personal stores and recent partial progress, as one document. */
export async function collectPersonal(userId: string, today = new Date()): Promise<PersonalDocument> {
    const keys = (await AsyncStorage.getAllKeys()).filter(isBackedUp);
    const stores: Record<string, string> = {};
    for (const [key, value] of await AsyncStorage.multiGet(keys)) {
        if (typeof value === 'string') stores[key] = value;
    }
    let measurements: Measurement[] = [];
    const db = await getDatabase();
    if (db) {
        const since = new Date(today.getTime() - MEASUREMENT_DAYS * 86400000).toISOString().slice(0, 10);
        measurements = (await db.getAllAsync(
            'SELECT habit_id, date, value, updated_at FROM habit_measurements WHERE user_id = ? AND date >= ?', userId, since,
        )) ?? [];
    }
    return { version: 1, stores, measurements };
}

/**
 * Puts a document back on this phone. Stores are replaced by the backup's;
 * partial progress is added where this phone has none for that day.
 * Returns how many things were written.
 */
export async function applyPersonal(doc: PersonalDocument, userId: string): Promise<number> {
    const entries = Object.entries(doc.stores ?? {}).filter(([key, value]) => isBackedUp(key) && typeof value === 'string');
    if (entries.length) await AsyncStorage.multiSet(entries);
    let written = entries.length;
    const db = await getDatabase();
    if (db && doc.measurements?.length) {
        await db.withTransactionAsync(async () => {
            for (const m of doc.measurements ?? []) {
                const result = await db.runAsync(
                    `INSERT OR IGNORE INTO habit_measurements (user_id, habit_id, date, value, updated_at) VALUES (?, ?, ?, ?, ?)`,
                    userId, m.habit_id, m.date, Number(m.value) || 0, m.updated_at ?? new Date().toISOString(),
                );
                written += result?.changes ?? 0;
            }
        });
    }
    return written;
}

/**
 * When an account arrives on this phone: brings its personal backup down,
 * once. Returns how many things changed, so the caller can restart the app
 * and every screen reads the restored stores.
 */
export async function restorePersonal(userId: string): Promise<number> {
    const sb = getSupabase();
    if (!sb) return 0;
    if ((await AsyncStorage.getItem(OWNER_KEY)) === userId) return 0;
    const { data, error } = await sb.from('personal_backups').select('data').eq('user_id', userId).maybeSingle();
    // Not knowing is not "there is none": try again next time rather than
    // letting this phone's defaults be uploaded over a backup we could not read.
    if (error) {
        if (/personal_backups/.test(error.message ?? '') && /does not exist|schema cache/.test(error.message ?? '')) return 0;
        throw error;
    }
    const written = data?.data ? await applyPersonal(data.data as PersonalDocument, userId) : 0;
    await AsyncStorage.setItem(OWNER_KEY, userId);
    restored += written;
    return written;
}

let restored = 0;
/** How much restores wrote since last asked; screens holding the old values need a restart. */
export function takeRestored(): number {
    const count = restored;
    restored = 0;
    return count;
}

/** After a successful sync: sends the personal document if it changed. */
export async function backUpPersonal(userId: string): Promise<boolean> {
    const sb = getSupabase();
    if (!sb) return false;
    // Not this account's stores yet (restore has not run): never upload them.
    if ((await AsyncStorage.getItem(OWNER_KEY)) !== userId) return false;
    const doc = await collectPersonal(userId);
    const text = JSON.stringify(doc);
    if ((await AsyncStorage.getItem(SENT_KEY)) === text) return true;
    const { error } = await sb.from('personal_backups').upsert({ user_id: userId, data: doc }, { onConflict: 'user_id' });
    if (error) {
        console.warn('[Backup] personal stores were not backed up:', error.message);
        return false;
    }
    await AsyncStorage.setItem(SENT_KEY, text);
    return true;
}

/**
 * After every successful sync: the first time for this account on this phone,
 * restore (phones signed in before this backup existed get here first); after
 * that, back up. Returns how many things a restore wrote.
 */
export async function syncPersonal(userId: string): Promise<number> {
    if ((await AsyncStorage.getItem(OWNER_KEY)) !== userId) return restorePersonal(userId);
    await backUpPersonal(userId);
    return 0;
}

/** Caches of the signed-in person's friends and shares, not worth backing up. */
const SOCIAL_CACHE_KEYS = ['habyss_shared_gate', 'habyss_shared_item_ids', 'habyss_shared_people', 'habyss_inbox_notifications'];

/** Everything personal on this phone, cleared when a different account takes it over. */
export async function clearPersonal(): Promise<void> {
    const keys = (await AsyncStorage.getAllKeys())
        .filter(key => isBackedUp(key) || key === OWNER_KEY || key === SENT_KEY || SOCIAL_CACHE_KEYS.includes(key));
    if (keys.length) await AsyncStorage.multiRemove(keys);
}
