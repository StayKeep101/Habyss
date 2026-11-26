import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDateKey } from './habitSchedule';

/**
 * Time off: sick, or on vacation. Life happens, and a habit app that punishes
 * a fever or a trip is one people delete. While time off runs:
 *
 *   - the streak is kept, as a freeze keeps it (lib/dayComplete.ts streakFrom):
 *     the days neither add to the run nor break it; anything you still do counts;
 *   - a habit left undone is not missed (lib/habitDays.ts treats it as skipped),
 *     so no "missed twice" and no dent in completion rates;
 *   - nothing buzzes about habits or the day (lib/notificationService.ts);
 *     a task's own reminder, which you set yourself, still rings.
 *
 * Sick runs until you say you're back; a vacation until its last day. Kept on
 * this phone, like the days a freeze covered.
 */
export type TimeOffKind = 'sick' | 'vacation';
export interface TimeOff {
    kind: TimeOffKind;
    /** First day off (YYYY-MM-DD). */
    from: string;
    /** Last day off, inclusive; null while it runs until you're back. */
    until: string | null;
}

const KEY = 'habyss_time_off';
/** Never more than this many days at once, so a forgotten "sick" cannot hold a streak for ever. */
export const TIME_OFF_MAX_DAYS = 60;

let periods: TimeOff[] = [];
let off = new Set<string>();
let loaded = false;
const listeners = new Set<() => void>();

const shift = (day: string, by: number) => {
    const date = new Date(`${day}T12:00:00`);
    date.setDate(date.getDate() + by);
    return localDateKey(date);
};

/** Every day a list of periods covers; an open one runs to today, at most TIME_OFF_MAX_DAYS. */
export function daysOff(list: TimeOff[], today: string = localDateKey(new Date())): Set<string> {
    const days = new Set<string>();
    for (const period of list) {
        const last = period.until ?? today;
        for (let day = period.from, count = 0; day <= last && count < TIME_OFF_MAX_DAYS; day = shift(day, 1), count++) days.add(day);
    }
    return days;
}

/** The time off running on a day, if any. */
export function timeOffOn(list: TimeOff[], day: string, today: string = localDateKey(new Date())): TimeOff | null {
    return list.find(period => period.from <= day && day <= (period.until ?? today)
        && daysOff([period], today).has(day)) ?? null;
}

const publish = (next: TimeOff[]) => {
    periods = next;
    off = daysOff(next);
    listeners.forEach(listener => listener());
    void AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
    // Everything counted from the days (streak, missed, stats) counts again.
    try { (require('./appEvents') as typeof import('./appEvents')).emit('habit_updated', {}); } catch { /* not ready yet */ }
    // Reminders follow at once: silenced when it starts, back when it ends.
    try {
        void (require('./notificationService') as typeof import('./notificationService')).NotificationService.refreshHabitReminders().catch(() => undefined);
    } catch { /* not ready yet */ }
};

export async function loadTimeOff(): Promise<TimeOff[]> {
    if (loaded) return periods;
    loaded = true;
    try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) { periods = parsed; off = daysOff(parsed); listeners.forEach(listener => listener()); }
        }
    } catch { /* none yet */ }
    return periods;
}

/** Every day off so far and ahead: the streak treats them as kept, the missed list as skipped. */
export const offDays = (): Set<string> => off;
/** Every period, as stored (the same array until one changes). */
export const timeOffPeriods = (): TimeOff[] => periods;
export const isDayOff = (day: string): boolean => off.has(day);
/** The time off running today, if any. */
export const currentTimeOff = (today: string = localDateKey(new Date())): TimeOff | null => timeOffOn(periods, today, today);

export function subscribeTimeOff(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

/** Starts time off today (replacing one already running): sick until you're back, or a vacation to its last day. */
export function startTimeOff(kind: TimeOffKind, until: string | null, today: string = localDateKey(new Date())): void {
    const kept = endedBefore(periods, today);
    const last = until && until < today ? today : until;
    publish([...kept, { kind, from: today, until: last }]);
}

/** You're back: today is a normal day again. Days already off stay off. */
export function endTimeOff(today: string = localDateKey(new Date())): void {
    publish(endedBefore(periods, today));
}

/** Each period cut to end the day before `today`; one starting today or later is dropped. */
export function endedBefore(list: TimeOff[], today: string): TimeOff[] {
    const yesterday = shift(today, -1);
    return list
        .filter(period => period.from < today)
        .map(period => period.until === null || period.until >= today ? { ...period, until: yesterday } : period);
}

/** "Sick since Monday", "On vacation until Nov 20": what Home and Settings say while it runs. */
export function timeOffLabel(period: TimeOff, today: string = localDateKey(new Date())): string {
    const name = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (period.kind === 'sick') return period.from === today ? 'Sick today' : `Sick since ${name(period.from)}`;
    return period.until ? `On vacation until ${name(period.until)}` : 'On vacation';
}

/** Test seam: forget the in-memory copy. */
export function __resetTimeOff(list: TimeOff[] = []): void {
    periods = list;
    off = daysOff(list);
    loaded = true;
}
