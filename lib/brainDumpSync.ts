import AsyncStorage from '@react-native-async-storage/async-storage';
import { REMOVED_KEY, applyRemoteThoughts, getThoughts } from './brainDump';

/**
 * The brain dump between this phone and the account (`brain_dump`, owner
 * only), so an AI assistant can add to it and read it, and a new phone gets it.
 *
 * In this order, each sync:
 *  1. removals made here go up;
 *  2. what changed in the account comes down (an assistant's additions,
 *     rewordings and removals; on a new phone, everything), which also tells
 *     this phone what the account already has;
 *  3. what is new or reworded here goes up.
 * Coming down before going up means a thought restored from an old backup,
 * since removed elsewhere, is removed here rather than brought back.
 */
type Remote = { id: string; text: string; created_at: string; updated_at: string; deleted_at: string | null };

const PAGE = 500;
const sentKey = (userId: string) => `brain_dump_sent_${userId}`;
const cursorKey = (userId: string) => `brain_dump_cursor_${userId}`;

async function readJson<T>(key: string, fallback: T): Promise<T> {
    try { const raw = await AsyncStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}

const missingTable = (error: any) => ['PGRST205', '42P01'].includes(String(error?.code)) || /could not find the table|does not exist/i.test(String(error?.message));

/** Returns how many thoughts changed on this phone. Never throws: the brain dump still works here. */
export async function syncBrainDump(sb: any, userId: string): Promise<number> {
    try {
        /** What the account holds for each thought, as far as this phone knows. */
        const sent = await readJson<Record<string, string>>(sentKey(userId), {});

        // 1. Removed here.
        const removed = await readJson<string[]>(REMOVED_KEY, []);
        if (removed.length) {
            const { error } = await sb.from('brain_dump').update({ deleted_at: new Date().toISOString() })
                .eq('user_id', userId).in('id', removed).is('deleted_at', null);
            if (error) throw error;
            for (const id of removed) delete sent[id];
            await AsyncStorage.removeItem(REMOVED_KEY);
        }

        // 2. Changed in the account.
        let cursor = await AsyncStorage.getItem(cursorKey(userId));
        let changed = 0;
        for (;;) {
            let query = sb.from('brain_dump').select('id, text, created_at, updated_at, deleted_at').eq('user_id', userId);
            if (cursor) query = query.gt('updated_at', cursor);
            const { data, error } = await query.order('updated_at', { ascending: true }).limit(PAGE);
            if (error) throw error;
            const rows = (data ?? []) as Remote[];
            changed += await applyRemoteThoughts(rows);
            for (const row of rows) { if (row.deleted_at) delete sent[row.id]; else sent[row.id] = row.text; }
            if (rows.length) cursor = rows[rows.length - 1].updated_at;
            if (rows.length < PAGE) break;
        }

        // 3. New or reworded here.
        const local = await getThoughts();
        const fresh = local.filter(thought => sent[thought.id] === undefined);
        if (fresh.length) {
            const { error } = await sb.from('brain_dump').upsert(fresh.map(thought => ({
                id: thought.id, user_id: userId, text: thought.text, created_at: thought.createdAt, deleted_at: null,
            })), { onConflict: 'user_id,id' });
            if (error) throw error;
        }
        for (const thought of local.filter(item => sent[item.id] !== undefined && sent[item.id] !== item.text)) {
            const { error } = await sb.from('brain_dump').update({ text: thought.text }).eq('user_id', userId).eq('id', thought.id);
            if (error) throw error;
        }
        for (const thought of local) sent[thought.id] = thought.text;

        // Our own uploads move updated_at too; reading them back next time is harmless (nothing differs).
        await AsyncStorage.setItem(sentKey(userId), JSON.stringify(sent));
        if (cursor) await AsyncStorage.setItem(cursorKey(userId), cursor);
        return changed;
    } catch (error: any) {
        if (!missingTable(error)) console.warn('[Backup] brain dump:', error?.message);
        return 0;
    }
}
