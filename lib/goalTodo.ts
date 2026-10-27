import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Task } from './tasks';

/**
 * A goal's to-do list: everything the plan needs doing, written down once,
 * under headings you name ("Research", "Build", "Launch"), then placed on the
 * days you will do it.
 *
 * A to-do is an ordinary task of the goal. Its heading is the task's
 * `section`; the order of the headings, and headings with nothing under them
 * yet, are kept here per goal. Planning one on a day sets its `dueDate`, so it
 * shows on that day across Habyss (the goal's plan, Home, the timeline) while
 * staying in the list, marked with its day.
 */

const KEY = (goalId: string) => `habyss_goal_sections:${goalId}`;

let cache: Record<string, string[]> = {};
const listeners = new Set<() => void>();
const publish = (goalId: string, sections: string[]) => {
    cache = { ...cache, [goalId]: sections };
    listeners.forEach(listener => listener());
};

export const cachedSections = (goalId: string): string[] | undefined => cache[goalId];
export function subscribeSections(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export async function loadSections(goalId: string): Promise<string[]> {
    if (cache[goalId]) return cache[goalId];
    let sections: string[] = [];
    try {
        const raw = await AsyncStorage.getItem(KEY(goalId));
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) sections = parsed.filter((name): name is string => typeof name === 'string' && !!name.trim());
    } catch { /* none yet */ }
    publish(goalId, sections);
    return sections;
}

export async function saveSections(goalId: string, sections: string[]): Promise<void> {
    const clean = [...new Set(sections.map(name => name.trim()).filter(Boolean))];
    publish(goalId, clean);
    await AsyncStorage.setItem(KEY(goalId), JSON.stringify(clean)).catch(() => undefined);
}

/** A heading's name, tidied: trimmed, at most 40 characters. Empty is no name. */
export const sectionName = (raw: string): string => raw.trim().replace(/\s+/g, ' ').slice(0, 40);

export interface TodoGroup {
    /** Null: the to-dos under no heading, shown first. */
    section: string | null;
    tasks: Task[];
}

/**
 * The list as it is shown: to-dos with no heading first, then each heading in
 * its saved order (headings only found on tasks come after, in the order
 * first seen). Inside a group, open to-dos come first, unplanned before
 * planned and planned by day, then done ones; cancelled ones are left out.
 */
export function todoGroups(tasks: Task[], sections: string[]): TodoGroup[] {
    const live = tasks.filter(task => task.status !== 'cancelled');
    const order = [...sections];
    for (const task of live) if (task.section && !order.includes(task.section)) order.push(task.section);
    const rank = (task: Task) => (task.status === 'done' ? 2 : task.dueDate ? 1 : 0);
    const sort = (list: Task[]) => [...list].sort((a, b) => rank(a) - rank(b)
        || (a.dueDate ?? '').localeCompare(b.dueDate ?? '')
        || a.createdAt.localeCompare(b.createdAt));
    const loose = live.filter(task => !task.section || !order.includes(task.section));
    return [
        { section: null, tasks: sort(loose) },
        ...order.map(section => ({ section, tasks: sort(live.filter(task => task.section === section)) })),
    ];
}

/** To-dos not on any day yet and not done: what can still be planned. */
export const unplanned = (tasks: Task[]): Task[] =>
    tasks.filter(task => task.status === 'open' && !task.dueDate)
        .sort((a, b) => (a.section ?? '').localeCompare(b.section ?? '') || a.createdAt.localeCompare(b.createdAt));

/** The days a to-do can be planned on: today up to the goal's deadline (with none, the next 90 days). */
export function plannableDays(today: string, deadline: string | null): { from: string; to: string } {
    const date = new Date(`${today}T12:00:00`);
    date.setDate(date.getDate() + 90);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const to = deadline ?? key;
    return { from: today, to: to < today ? today : to };
}
