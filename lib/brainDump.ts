import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Thoughts written down to get them out of your head.
 *
 * Kept on this phone only: a brain dump is for things you would not show
 * anybody, so it never syncs and never reaches a friend.
 */
export interface Thought { id: string; text: string; createdAt: string }

const KEY = 'habyss_brain_dump';
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
}

/** Newest first. Blank text is ignored. */
export async function addThought(text: string, now = new Date()): Promise<Thought | null> {
    const clean = text.trim().slice(0, LIMIT);
    if (!clean) return null;
    const thought = { id: `${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`, text: clean, createdAt: now.toISOString() };
    await save([thought, ...(await getThoughts())]);
    return thought;
}

export async function removeThought(id: string): Promise<void> {
    await save((await getThoughts()).filter(thought => thought.id !== id));
}

/** Rewords a thought; clearing it removes it. */
export async function updateThought(id: string, text: string): Promise<void> {
    const clean = text.trim().slice(0, LIMIT);
    const list = await getThoughts();
    await save(clean ? list.map(thought => (thought.id === id ? { ...thought, text: clean } : thought)) : list.filter(thought => thought.id !== id));
}

/** Puts a thought back where it was (undo). */
export async function restoreThought(thought: Thought, index: number): Promise<void> {
    const list = (await getThoughts()).filter(item => item.id !== thought.id);
    list.splice(Math.max(0, Math.min(index, list.length)), 0, thought);
    await save(list);
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
