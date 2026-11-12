import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Travel time around a calendar event: an hour to get to school and an hour
 * back means 11:30–12:50 School keeps 10:30–1:50 free of work. Kept per event
 * name ("School"), so every School in the calendar gets it, or for one event
 * on one day only (a trip somewhere new), which wins over the name. The
 * timeline shows the travel as its own fixed rows, which nothing is planned
 * inside, and a notification says when to leave (and, if asked, a heads-up
 * a few minutes before that).
 */
export interface Travel {
    /** Minutes to get there. */
    before: number;
    /** Minutes to get back. */
    after: number;
    /** A heads-up this many minutes before it is time to leave (none when 0 or unset). */
    warn?: number;
}

const KEY = 'habyss_event_travel';
/** The longest trip either way, and the earliest heads-up: four hours. */
export const TRAVEL_MAX = 240;
let state: Record<string, Travel> = {};
let loaded = false;
const listeners = new Set<() => void>();

/** Every event with this name. */
export const travelKey = (title: string) => title.trim().toLowerCase().replace(/\s+/g, ' ');
/** This one event, on this day only. */
export const onceKey = (eventId: string, day: string) => `#${day}#${eventId}`;
export const currentTravel = (): Record<string, Travel> => state;
export function subscribeTravel(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

/** The travel an event has: its own for that day first, else the one for its name. Pure. */
export function travelOf(all: Record<string, Travel> | undefined, event: { id: string; title: string }, day?: string): Travel | undefined {
    if (!all) return undefined;
    return (day ? all[onceKey(event.id, day)] : undefined) ?? all[travelKey(event.title)];
}

/** Whether this event's travel is its own (this day only) rather than its name's. */
export const isOnce = (all: Record<string, Travel>, eventId: string, day: string): boolean => !!all[onceKey(eventId, day)];

export async function loadTravel(): Promise<Record<string, Travel>> {
    if (loaded) return state;
    try {
        const raw = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}');
        if (raw && typeof raw === 'object') state = raw;
    } catch { /* none set */ }
    loaded = true;
    listeners.forEach(listener => listener());
    return state;
}

export function travelFor(title: string, all: Record<string, Travel> = state): Travel {
    return all[travelKey(title)] ?? { before: 0, after: 0 };
}

const minutes = (value: number | undefined) => Math.max(0, Math.min(TRAVEL_MAX, Math.round(value ?? 0)));

async function write(change: (next: Record<string, Travel>) => void): Promise<void> {
    await loadTravel();
    const next = { ...state };
    change(next);
    state = next;
    listeners.forEach(listener => listener());
    await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
}

/**
 * Sets an event's travel: for every event with its name, or (`once`) for this
 * event on this day only. Choosing one scope clears the other for this event,
 * so what is shown is always what is used.
 */
export async function setTravel(event: { id?: string; title: string }, travel: Travel, once?: { day: string }): Promise<void> {
    const clean: Travel = { before: minutes(travel.before), after: minutes(travel.after), ...(travel.warn ? { warn: minutes(travel.warn) } : null) };
    const empty = !clean.before && !clean.after;
    await write(next => {
        const own = once && event.id ? onceKey(event.id, once.day) : null;
        if (own) {
            // Its own, even when none: "no travel this time" must win over the name's.
            next[own] = clean;
        } else {
            if (event.id) for (const key of Object.keys(next)) if (key.endsWith(`#${event.id}`)) delete next[key];
            if (empty) delete next[travelKey(event.title)];
            else next[travelKey(event.title)] = clean;
        }
    });
}

/** Back to what every event with its name has: this day's own travel is dropped. */
export async function clearOnce(eventId: string, day: string): Promise<void> {
    await write(next => { delete next[onceKey(eventId, day)]; });
}
