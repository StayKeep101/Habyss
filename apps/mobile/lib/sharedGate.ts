import AsyncStorage from '@react-native-async-storage/async-storage';
// Shared with the Mac: packages/core/src/sharedGate.ts (the rules). What stays here is the phone's own part.
import { gate, setGate, type GateData } from '@habyss/core/sharedGate';
export * from '@habyss/core/sharedGate';

const KEY = 'habyss_shared_gate';

/** The cached copy, so stats are right from the first frame after a launch. */
export async function loadCachedGate(): Promise<void> {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) setGate(JSON.parse(raw) as GateData);
    } catch { /* starts open */ }
}

/**
 * Reads who is on each shared item and who did it on which day.
 * Returns true when anything changed, so callers can recompute.
 */
export async function refreshGate(): Promise<boolean> {
    try {
        const { getSupabase } = require('./supabase') as typeof import('./supabase');
        const sb = getSupabase();
        if (!sb) return false;
        const { data: session } = await sb.auth.getSession();
        const me = session.session?.user?.id;
        if (!me) return false;

        const mine = `owner_id.eq.${me},shared_with_id.eq.${me}`;
        const [habits, tasks] = await Promise.all([
            sb.from('shared_habits').select('habit_id, owner_id, shared_with_id, created_at').eq('status', 'accepted').is('deleted_at', null).or(mine),
            sb.from('shared_tasks').select('task_id, owner_id, shared_with_id, created_at').eq('status', 'accepted').is('deleted_at', null).or(mine),
        ]);
        const items: GateData['items'] = {};
        const add = (id: string | undefined, row: any) => {
            if (!id) return;
            const item = items[id] ?? (items[id] = { others: [], since: '9999-12-31' });
            for (const person of [row.owner_id, row.shared_with_id]) {
                if (person && person !== me && !item.others.includes(person)) item.others.push(person);
            }
            const start = String(row.created_at ?? '').slice(0, 10);
            if (start && start < item.since) item.since = start;
        };
        for (const row of habits.data ?? []) add(row.habit_id, row);
        for (const row of tasks.data ?? []) add(row.task_id, row);

        const ids = Object.keys(items);
        const done: GateData['done'] = {};
        if (ids.length) {
            const earliest = ids.map(id => items[id].since).sort()[0];
            const { data } = await sb.from('shared_completions').select('user_id, item_id, day')
                .in('item_id', ids).gte('day', earliest);
            for (const row of data ?? []) {
                const byDay = done[row.item_id] ?? (done[row.item_id] = {});
                (byDay[row.day] ?? (byDay[row.day] = [])).push(row.user_id);
            }
        }

        const next = { items, done };
        const changed = JSON.stringify(next) !== JSON.stringify(gate);
        if (changed) {
            setGate(next);
            await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
        }
        return changed;
    } catch {
        return false;
    }
}
