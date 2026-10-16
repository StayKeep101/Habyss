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

/** Thoughts grouped by the day they were written, newest day first. */
export function byDay(thoughts: Thought[], dayOf: (iso: string) => string): { day: string; thoughts: Thought[] }[] {
    const groups = new Map<string, Thought[]>();
    for (const thought of thoughts) {
        const day = dayOf(thought.createdAt);
        groups.set(day, [...(groups.get(day) ?? []), thought]);
    }
    return [...groups.entries()].map(([day, list]) => ({ day, thoughts: list }));
}
