import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Where your focus time goes: every focus session saved on this phone, and
 * what can be said about them.
 *
 * Sessions are written by the focus timer (`FocusTimeContext.saveFocusSession`)
 * as `focus_session_<ms>` keys. This file reads them back into one in-memory
 * list, reloaded whenever a session is saved, and the pure functions below
 * turn that list into the numbers on the Focus page: today, this week against
 * last week, day by day, days in a row, the longest session, how often a
 * session is finished rather than abandoned, the hour you focus best, and
 * which habits and tasks took the time.
 */

export interface FocusRecord {
    /** The habit or task focused on. */
    itemId: string;
    startedAt: string;
    /** Local day the session started (YYYY-MM-DD). */
    date: string;
    seconds: number;
    completed: boolean;
    mode: string;
}

const PREFIX = 'focus_session_';

const dayKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
/** The day `by` days from `day` (YYYY-MM-DD). */
export const shiftDay = (day: string, by: number): string => shift(day, by);
const shift = (day: string, by: number) => {
    const date = new Date(`${day}T12:00:00`);
    date.setDate(date.getDate() + by);
    return dayKey(date);
};

/** One stored session, or null when it is unreadable or empty. */
export function parseRecord(raw: string | null): FocusRecord | null {
    if (!raw) return null;
    try {
        const row = JSON.parse(raw) as Record<string, unknown>;
        const seconds = Number(row.actual_duration);
        const started = typeof row.started_at === 'string' ? new Date(row.started_at) : null;
        if (!started || Number.isNaN(started.getTime()) || !Number.isFinite(seconds) || seconds <= 0) return null;
        return {
            itemId: String(row.habit_id ?? ''),
            startedAt: started.toISOString(),
            date: dayKey(started),
            seconds: Math.round(seconds),
            completed: row.completed === true,
            mode: typeof row.mode === 'string' ? row.mode : 'deep_focus',
        };
    } catch {
        return null;
    }
}

let records: FocusRecord[] = [];
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
export const currentFocusRecords = (): FocusRecord[] => records;
export function subscribeFocusRecords(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

/** Reads every saved session again (called on open and after each save). */
export function loadFocusRecords(): Promise<void> {
    loading ??= (async () => {
        try {
            const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(PREFIX));
            const rows = keys.length ? await AsyncStorage.multiGet(keys) : [];
            records = rows.map(([, raw]) => parseRecord(raw)).filter((row): row is FocusRecord => !!row)
                .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
            listeners.forEach(listener => listener());
        } catch { /* keeps what it had */ } finally {
            loading = null;
        }
    })();
    return loading;
}

export interface FocusDay { date: string; seconds: number }
export interface FocusItemTotal { itemId: string; seconds: number; sessions: number }
export interface FocusSummary {
    today: number;
    week: number;
    lastWeek: number;
    /** Change against the same days of last week, in seconds. */
    change: number;
    days: FocusDay[];
    /** Days in a row with any focus, ending today (or yesterday, if today has none yet). */
    streak: number;
    sessions: number;
    longest: number;
    average: number;
    /** Share of sessions finished rather than ended early, 0–100; null with none. */
    finishedRate: number | null;
    /** The hour most focus starts in, with at least three sessions; null otherwise. */
    bestHour: number | null;
    items: FocusItemTotal[];
    total: number;
}

/**
 * Everything the Focus page shows, from the sessions. `range` is how many days
 * the day-by-day bars cover (and what the totals by item count over).
 */
export function focusSummary(all: FocusRecord[], today: string, range = 7): FocusSummary {
    const byDay = new Map<string, number>();
    for (const row of all) byDay.set(row.date, (byDay.get(row.date) ?? 0) + row.seconds);
    const sumDays = (from: number, to: number) => {
        let sum = 0;
        for (let i = from; i <= to; i++) sum += byDay.get(shift(today, -i)) ?? 0;
        return sum;
    };
    const week = sumDays(0, 6);
    const lastWeek = sumDays(7, 13);

    const days: FocusDay[] = [];
    for (let i = range - 1; i >= 0; i--) {
        const date = shift(today, -i);
        days.push({ date, seconds: byDay.get(date) ?? 0 });
    }

    let streak = 0;
    let cursor = byDay.get(today) ? today : shift(today, -1);
    while (byDay.get(cursor)) { streak += 1; cursor = shift(cursor, -1); }

    const floor = shift(today, -(range - 1));
    const inRange = all.filter(row => row.date >= floor && row.date <= today);
    const items = new Map<string, FocusItemTotal>();
    for (const row of inRange) {
        const item = items.get(row.itemId) ?? { itemId: row.itemId, seconds: 0, sessions: 0 };
        item.seconds += row.seconds;
        item.sessions += 1;
        items.set(row.itemId, item);
    }

    const hours = Array(24).fill(0) as number[];
    for (const row of all) hours[new Date(row.startedAt).getHours()] += row.seconds;
    const peak = hours.indexOf(Math.max(...hours));

    const total = all.reduce((sum, row) => sum + row.seconds, 0);
    return {
        today: byDay.get(today) ?? 0,
        week,
        lastWeek,
        change: week - lastWeek,
        days,
        streak,
        sessions: all.length,
        longest: Math.max(0, ...all.map(row => row.seconds)),
        average: all.length ? Math.round(total / all.length) : 0,
        finishedRate: all.length ? Math.round(all.filter(row => row.completed).length / all.length * 100) : null,
        bestHour: all.length >= 3 && hours[peak] > 0 ? peak : null,
        items: [...items.values()].sort((a, b) => b.seconds - a.seconds),
        total,
    };
}

/** "1h 25m", "25m", "40s". */
export function focusDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
    if (minutes) return `${minutes}m`;
    return seconds > 0 ? `${Math.round(seconds)}s` : '0m';
}

/** "9 am", "2 pm". */
export const hourLabel = (hour: number) => `${hour % 12 || 12} ${hour < 12 ? 'am' : 'pm'}`;
