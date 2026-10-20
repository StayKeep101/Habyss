import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DayFlow } from './dayFlow';

/**
 * What the timeline remembers about today, so it moves only when it should.
 *
 * - Where each habit and task was last placed. Something done stays in the
 *   slot it was done in (cut short when it was finished early, which frees
 *   the rest of the slot for what comes next), instead of jumping to the
 *   start of the day. Something under way holds its slot until it runs out.
 * - What moved since you last opened it: the green dot on the timeline,
 *   gone once you open it, back if it moves again.
 *
 * - What had no room before bedtime, so a dated task can be carried over to
 *   the next day rather than turning up overdue (carryOver).
 *
 * Today only; a new day starts empty. Kept on this phone, one copy.
 */
export interface Slot { start: number; end: number }
export interface DayMemory {
    day: string;
    slots: Record<string, Slot>;
    /** Done when last seen, so a fresh tick can be told from an old one. */
    done: Record<string, true>;
    /** Moved since last opened. */
    moved: Record<string, true>;
    /** Had no room before bedtime when last seen. */
    unfit?: Record<string, true>;
}

/** Moving less than this is the flow breathing, not a change worth a dot. */
export const MOVE_MINUTES = 10;

export const emptyMemory = (day: string): DayMemory => ({ day, slots: {}, done: {}, moved: {} });

/** Today's memory, brought up to date with the flow as it is now. */
export function remember(prev: DayMemory, day: string, flow: DayFlow, now: number): DayMemory {
    const base = prev.day === day ? prev : emptyMemory(day);
    const slots: Record<string, Slot> = {};
    const done: Record<string, true> = {};
    const moved: Record<string, true> = { ...base.moved };
    for (const item of flow.timeline) {
        if (item.fixed) continue;
        const before = base.slots[item.id];
        if (item.done) {
            done[item.id] = true;
            delete moved[item.id];
            if (base.done[item.id] || !before) { slots[item.id] = before ?? { start: item.start, end: item.end }; continue; }
            // Just finished: it keeps its slot, ending when it was done. Done
            // before its slot came, it is placed where it was really done.
            const length = before.end - before.start;
            slots[item.id] = before.start <= now
                ? { start: before.start, end: Math.max(before.start + 5, Math.min(before.end, now)) }
                : { start: Math.max(0, now - length), end: now };
            continue;
        }
        slots[item.id] = { start: item.start, end: item.end };
        if (before && !base.done[item.id] && item.state !== 'now' && Math.abs(before.start - item.start) >= MOVE_MINUTES) moved[item.id] = true;
    }
    // No longer fits today: that is a change too.
    for (const item of flow.unfit) if (base.slots[item.id]) moved[item.id] = true;
    const unfit = Object.fromEntries(flow.unfit.map(item => [item.id, true as const]));
    return { day, slots, done, moved, unfit };
}

/**
 * A new day: the dated tasks that had no room before bedtime on the last day
 * seen, still open and still due then, move to today rather than read as
 * overdue. Habits come back on their own days anyway.
 */
export function carryOver(memory: DayMemory, today: string, tasks: { id: string; status: string; dueDate?: string | null }[]): string[] {
    if (!memory.day || memory.day >= today || !memory.unfit) return [];
    return tasks.filter(task => memory.unfit![task.id] && task.status === 'open' && !!task.dueDate && task.dueDate <= memory.day && task.dueDate < today).map(task => task.id);
}

/** Opened: no dot until it moves again. */
export function seen(memory: DayMemory, id: string): DayMemory {
    if (!memory.moved[id]) return memory;
    const moved = { ...memory.moved };
    delete moved[id];
    return { ...memory, moved };
}

const KEY = 'habyss_day_memory';
let state: DayMemory = emptyMemory('');
let loading = false;
/** The stored copy has been read: until then nothing is remembered or carried over. */
let loaded = false;
const listeners = new Set<() => void>();

export const currentMemory = (): DayMemory => state;
export const memoryReady = (): boolean => loaded;
export function subscribeMemory(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export async function loadMemory(): Promise<DayMemory> {
    if (loaded || loading) return state;
    loading = true;
    try {
        const raw = JSON.parse((await AsyncStorage.getItem(KEY)) ?? 'null');
        if (raw && typeof raw.day === 'string' && raw.slots && raw.done && raw.moved) state = raw;
    } catch { /* start empty */ }
    loaded = true;
    listeners.forEach(listener => listener());
    return state;
}

function store(next: DayMemory) {
    if (JSON.stringify(next) === JSON.stringify(state)) return;
    state = next;
    listeners.forEach(listener => listener());
    void AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => undefined);
}

/** Called with today's flow whenever it changes. Waits for the stored copy first. */
export function rememberFlow(day: string, flow: DayFlow, now: number): void {
    if (!loaded) return;
    store(remember(state, day, flow, now));
}

export function markSeen(id: string): void {
    store(seen(state, id));
}
