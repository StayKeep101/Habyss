// Copied from Habyss Mobile lib/eventTravel.ts @f48c4da4. Keep in sync; do not re-derive rules. Pure parts only: storage stays on mobile.
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
export interface Travel {
    /** Minutes to get there. */
    before: number;
    /** Minutes to get back. */
    after: number;
    /** A heads-up this many minutes before it is time to leave (none when 0 or unset). */
    warn?: number;
}

/** The longest trip either way, and the earliest heads-up: four hours. */
export const TRAVEL_MAX = 240;

/** Every event with this name. */
export const travelKey = (title: string) => title.trim().toLowerCase().replace(/\s+/g, ' ');

/** The weekday (0 Sunday … 6 Saturday) of a day key, at noon so no time zone moves it. */
export const weekdayOf = (day: string) => new Date(`${day}T12:00:00`).getDay();

/** Every event with this name on this weekday. */
export const weekdayKey = (title: string, day: string) => `@${weekdayOf(day)}@${travelKey(title)}`;

/** This one event, on this day only. */
export const onceKey = (eventId: string, day: string) => `#${day}#${eventId}`;

/** The travel an event has: its own for that day, else its name's on that weekday, else its name's. Pure. */
export function travelOf(all: Record<string, Travel> | undefined, event: { id: string; title: string }, day?: string): Travel | undefined {
    if (!all) return undefined;
    return (day ? all[onceKey(event.id, day)] ?? all[weekdayKey(event.title, day)] : undefined) ?? all[travelKey(event.title)];
}

export type TravelScope = 'every' | 'weekday' | 'once';

/** Which reach an event's travel on a day comes from (what the sheet shows chosen). */
export function scopeOf(all: Record<string, Travel>, event: { id: string; title: string }, day: string): TravelScope {
    if (all[onceKey(event.id, day)]) return 'once';
    if (all[weekdayKey(event.title, day)]) return 'weekday';
    return 'every';
}

/** Whether this event's travel is its own (this day only) rather than its name's. */
export const isOnce = (all: Record<string, Travel>, eventId: string, day: string): boolean => !!all[onceKey(eventId, day)];
