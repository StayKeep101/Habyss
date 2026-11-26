import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Task } from './tasks';

/**
 * A shared habit or task only counts once everybody on it has done it.
 *
 * Your tick still shows — you did your part — but streaks, Marks, the Streak
 * page, goals and task streaks all leave that day out until the others have
 * done theirs too. That is the point of sharing: somebody is relying on you.
 *
 * Only days from when the share was accepted are held back; what you did on
 * your own before that still counts. Items nobody else has accepted are never
 * held back.
 *
 * The facts come from the server (who is on what, who did what on which day)
 * and are cached here, so every stat can ask synchronously.
 */

export interface GateData {
    /** item id → the other people on it and the day the share began. */
    items: Record<string, { others: string[]; since: string }>;
    /** item id → day → user ids who did it. */
    done: Record<string, Record<string, string[]>>;
}

const KEY = 'habyss_shared_gate';
let gate: GateData = { items: {}, done: {} };
let version = 0;

export function setGate(next: GateData) {
    gate = next;
    version += 1;
    historyCache = null;
    tasksCache = null;
}

/** Who else is on this item (user ids), for "with Sam" on the day card. */
export const othersOn = (itemId: string): string[] => gate.items[itemId]?.others ?? [];

/** Whether what was done on this item on this day counts yet. */
export function counts(itemId: string, day: string): boolean {
    const item = gate.items[itemId];
    if (!item || item.others.length === 0 || day < item.since) return true;
    const by = gate.done[itemId]?.[day] ?? [];
    return item.others.every(person => by.includes(person));
}

let historyCache: { input: Record<string, string[]>; version: number; output: Record<string, string[]> } | null = null;

/** Check-ins by day, without shared habits whose others have not finished that day. */
export function countedHistory(history: Record<string, string[]>): Record<string, string[]> {
    if (Object.keys(gate.items).length === 0) return history;
    if (historyCache && historyCache.input === history && historyCache.version === version) return historyCache.output;
    const output: Record<string, string[]> = {};
    for (const [day, ids] of Object.entries(history)) {
        output[day] = ids.filter(id => counts(id, day));
    }
    historyCache = { input: history, version, output };
    return output;
}

let tasksCache: { input: Task[]; version: number; output: Task[] } | null = null;

const doneDay = (task: Task): string | null => {
    const stamp = task.completedAt;
    if (!stamp) return null;
    const date = new Date(stamp);
    if (!Number.isFinite(date.getTime())) return stamp.slice(0, 10);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** Tasks, with a shared one still open for the stats until the others are done too. */
export function countedTasks(tasks: Task[]): Task[] {
    if (Object.keys(gate.items).length === 0) return tasks;
    if (tasksCache && tasksCache.input === tasks && tasksCache.version === version) return tasksCache.output;
    const output = tasks.map(task => {
        if (task.status !== 'done' || !gate.items[task.id]) return task;
        const day = doneDay(task);
        return day && !counts(task.id, day) ? { ...task, status: 'open' as const, completedAt: undefined } : task;
    });
    tasksCache = { input: tasks, version, output };
    return output;
}

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
