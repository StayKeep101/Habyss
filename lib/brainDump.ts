import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Thoughts written down to get them out of your head.
 *
 * Yours alone: never shared, never seen by a friend. Signed in, it is kept in
 * the account too (lib/brainDumpSync.ts, owner-only), so an AI assistant you
 * connect can add to it and read it back, and a new phone gets it.
 */
export interface Thought { id: string; text: string; createdAt: string }

const KEY = 'habyss_brain_dump';
/** Ids removed on this phone, for the account to remove too on the next sync. */
export const REMOVED_KEY = 'habyss_brain_dump_removed';
const LIMIT = 5000;

export async function getThoughts(): Promise<Thought[]> {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        const list = raw ? (JSON.parse(raw) as Thought[]) : [];
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
}

async function save(list: Thought[]) {
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
    // The weekly reminder counts what is waiting, so it follows every change.
    try { (require('./brainDumpReview') as typeof import('./brainDumpReview')).syncBrainDumpReview(); } catch { /* tests */ }
}

/** Newest first. Blank text is ignored. */
export async function addThought(text: string, now = new Date()): Promise<Thought | null> {
    const clean = text.trim().slice(0, LIMIT);
    if (!clean) return null;
    const thought = { id: `${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`, text: clean, createdAt: now.toISOString() };
    await save([thought, ...(await getThoughts())]);
    return thought;
}

async function markRemoved(ids: string[], removed: boolean): Promise<void> {
    try {
        const raw = await AsyncStorage.getItem(REMOVED_KEY);
        const list = new Set<string>(raw ? JSON.parse(raw) : []);
        for (const id of ids) { if (removed) list.add(id); else list.delete(id); }
        await AsyncStorage.setItem(REMOVED_KEY, JSON.stringify([...list]));
    } catch { /* the next sync brings it back; nothing is lost */ }
}

export async function removeThought(id: string): Promise<void> {
    await save((await getThoughts()).filter(thought => thought.id !== id));
    await markRemoved([id], true);
}

/**
 * What the account says changed (an assistant added, reworded or removed a
 * thought): applied here without counting as this phone's own changes.
 */
export async function applyRemoteThoughts(rows: { id: string; text: string; created_at: string; deleted_at: string | null }[]): Promise<number> {
    if (!rows.length) return 0;
    const byId = new Map((await getThoughts()).map(thought => [thought.id, thought]));
    let changed = 0;
    for (const row of rows) {
        const here = byId.get(row.id);
        if (row.deleted_at) { if (here) { byId.delete(row.id); changed++; } continue; }
        if (!here) { byId.set(row.id, { id: row.id, text: row.text, createdAt: row.created_at }); changed++; }
        else if (here.text !== row.text) { byId.set(row.id, { ...here, text: row.text }); changed++; }
    }
    if (!changed) return 0;
    // New ones slot in by when they were written; the person's own order is kept for the rest.
    const list = [...byId.values()];
    const known = new Set((await getThoughts()).map(thought => thought.id));
    const kept = list.filter(thought => known.has(thought.id));
    for (const thought of list.filter(item => !known.has(item.id))) {
        const at = kept.findIndex(other => other.createdAt < thought.createdAt);
        kept.splice(at === -1 ? kept.length : at, 0, thought);
    }
    await save(kept);
    return changed;
}

/** Rewords a thought; clearing it removes it. */
export async function updateThought(id: string, text: string): Promise<void> {
    const clean = text.trim().slice(0, LIMIT);
    const list = await getThoughts();
    await save(clean ? list.map(thought => (thought.id === id ? { ...thought, text: clean } : thought)) : list.filter(thought => thought.id !== id));
    if (!clean) await markRemoved([id], true);
}

/** Puts a thought back where it was (undo). */
export async function restoreThought(thought: Thought, index: number): Promise<void> {
    const list = (await getThoughts()).filter(item => item.id !== thought.id);
    list.splice(Math.max(0, Math.min(index, list.length)), 0, thought);
    await save(list);
    await markRemoved([thought.id], false);
}

/** Saves the order the person dragged them into. */
export async function reorderThoughts(ids: string[]): Promise<void> {
    const byId = new Map((await getThoughts()).map(thought => [thought.id, thought]));
    const ordered = ids.map(id => byId.get(id)).filter((thought): thought is Thought => !!thought);
    const rest = [...byId.values()].filter(thought => !ids.includes(thought.id));
    await save([...ordered, ...rest]);
}

/** Moves one item from one place to another in a list (a drag). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
    return next;
}

/** Thoughts grouped by the day they were written, newest day first. */
export function byDay(thoughts: Thought[], dayOf: (iso: string) => string): { day: string; thoughts: Thought[] }[] {
    const groups = new Map<string, Thought[]>();
    for (const thought of thoughts) {
        const day = dayOf(thought.createdAt);
        groups.set(day, [...(groups.get(day) ?? []), thought]);
    }
    return [...groups.entries()].map(([day, list]) => ({ day, thoughts: list }));
}

/**
 * The weekly clear: a thought from before this week started is let go. Anything
 * worth keeping was turned into a task, habit or goal when the review came.
 */
export function keptThisWeek(thoughts: Thought[], weekStartsAt: Date): Thought[] {
    const floor = weekStartsAt.getTime();
    return thoughts.filter(thought => new Date(thought.createdAt).getTime() >= floor);
}

/** Clears last week's thoughts. Returns how many were let go. */
export async function clearPastWeeks(weekStartsAt: Date): Promise<number> {
    const list = await getThoughts();
    const kept = keptThisWeek(list, weekStartsAt);
    if (kept.length !== list.length) await save(kept);
    return list.length - kept.length;
}
