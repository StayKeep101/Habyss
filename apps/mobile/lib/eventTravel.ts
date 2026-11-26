import AsyncStorage from '@react-native-async-storage/async-storage';
// The rules (what travel an event has, on which reach) are shared with the Mac: packages/core/src/eventTravel.ts.
// Keeping them on this phone is this file's part.
import { onceKey, travelKey, weekdayKey, TRAVEL_MAX, type Travel, type TravelScope } from '@habyss/core/eventTravel';

export * from '@habyss/core/eventTravel';

/**
 * Travel time around a calendar event: an hour to get to school and an hour
 * back means 11:30–12:50 School keeps 10:30–1:50 free of work. Kept at three
 * reaches, the narrowest winning: every event with its name ("School"); that
 * name on one weekday (every Tuesday's School, when Tuesday's class is in
 * another building than Thursday's); or one event on one day (a trip
 * somewhere new). The
 * timeline shows the travel as its own fixed rows, which nothing is planned
 * inside, and a notification says when to leave (and, if asked, a heads-up
 * a few minutes before that).
 */
const KEY = 'habyss_event_travel';
let state: Record<string, Travel> = {};
let loaded = false;
const listeners = new Set<() => void>();

export const currentTravel = (): Record<string, Travel> => state;
export function subscribeTravel(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

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
    void (require('./dayInputsSync') as typeof import('./dayInputsSync')).markDayInputsDirty('habyss_event_travel');
}

/** The stored travel changed underneath (another device): read it again. */
export async function reloadTravel(): Promise<void> {
    loaded = false;
    state = {};
    await loadTravel();
}

/**
 * Sets an event's travel: for every event with its name; (`weekday`) for that
 * name on this day's weekday; or (`once`) for this event on this day only.
 * Choosing a reach clears the narrower ones that would hide it on this day, so
 * what is shown is always what is used; other weekdays keep their own.
 */
export async function setTravel(event: { id?: string; title: string }, travel: Travel, scope?: { day: string; reach?: TravelScope }): Promise<void> {
    const clean: Travel = { before: minutes(travel.before), after: minutes(travel.after), ...(travel.warn ? { warn: minutes(travel.warn) } : null) };
    const empty = !clean.before && !clean.after;
    await write(next => {
        // A day with no reach named is this day only (how it was first called).
        const reach: TravelScope = scope ? scope.reach ?? 'once' : 'every';
        const own = reach === 'once' && scope && event.id ? onceKey(event.id, scope.day) : null;
        if (scope && reach === 'weekday') {
            // That weekday's own, even when none: "no travel on Thursdays" must win over the name's.
            if (event.id) delete next[onceKey(event.id, scope.day)];
            next[weekdayKey(event.title, scope.day)] = clean;
        } else if (own) {
            // Its own, even when none: "no travel this time" must win over the name's.
            next[own] = clean;
        } else {
            if (event.id) for (const key of Object.keys(next)) if (key.endsWith(`#${event.id}`)) delete next[key];
            // What the sheet showed for this day was the weekday's: setting every one replaces it here.
            if (scope?.day) delete next[weekdayKey(event.title, scope.day)];
            if (empty) delete next[travelKey(event.title)];
            else next[travelKey(event.title)] = clean;
        }
    });
}

/** Back to what every event with its name has: this day's own travel is dropped. */
export async function clearOnce(eventId: string, day: string): Promise<void> {
    await write(next => { delete next[onceKey(eventId, day)]; });
}
