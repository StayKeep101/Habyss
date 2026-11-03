// Copied from Habyss Mobile lib/sharedGate.ts @0fcd218. Keep in sync; do not re-derive rules.
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
 * and are cached here, so every stat can ask synchronously. On desktop the
 * caller fills the cache with setGate(); mobile's loadCachedGate/refreshGate
 * (AsyncStorage and Supabase reads) are not copied.
 */

export interface GateData {
    /** item id → the other people on it and the day the share began. */
    items: Record<string, { others: string[]; since: string }>;
    /** item id → day → user ids who did it. */
    done: Record<string, Record<string, string[]>>;
}

let gate: GateData = { items: {}, done: {} };
let version = 0;

export function setGate(next: GateData) {
    gate = next;
    version += 1;
    historyCache = null;
    tasksCache = null;
}

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
