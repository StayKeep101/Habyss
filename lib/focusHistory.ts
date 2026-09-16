import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Focus history and the user's active day.
 *
 * Individual sessions are already persisted by FocusTimeContext under
 * `focus_session_<timestamp>` keys; the context itself only keeps rolling
 * aggregates. These helpers read those records back so the app can show focus
 * per day rather than just today's total.
 */

export const FOCUS_SESSION_PREFIX = 'focus_session_';
export const DAY_WINDOW_KEY = 'focus_day_window';

/** The stretch of the day the user actually intends to be productive. */
export interface DayWindow {
    /** "HH:MM", 24 hour. */
    start: string;
    end: string;
}

export const DEFAULT_DAY_WINDOW: DayWindow = { start: '08:30', end: '22:00' };

export interface StoredFocusSession {
    habit_id?: string;
    started_at?: string;
    ended_at?: string;
    planned_duration?: number;
    actual_duration?: number;
    completed?: boolean;
    /** Local YYYY-MM-DD written when the session was saved. */
    date?: string;
    mode?: string;
}

export interface DayFocus {
    /** Local YYYY-MM-DD. */
    date: string;
    seconds: number;
    sessions: number;
    completedSessions: number;
    bestSeconds: number;
}

/** Minutes since midnight, or null when the value is not a usable HH:MM. */
export function parseTimeToMinutes(value: string): number | null {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value?.trim() ?? '');
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
}

export function formatWindowLabel(window: DayWindow): string {
    return `${window.start} – ${window.end}`;
}

/**
 * Minutes remaining in the active day.
 *
 * Before the day opens this returns the whole window, so the number reads as
 * "time available today" rather than jumping once the day starts. After it
 * closes, it is zero rather than negative.
 */
export function minutesLeftInDay(now: Date, window: DayWindow = DEFAULT_DAY_WINDOW): number {
    const start = parseTimeToMinutes(window.start) ?? parseTimeToMinutes(DEFAULT_DAY_WINDOW.start)!;
    const end = parseTimeToMinutes(window.end) ?? parseTimeToMinutes(DEFAULT_DAY_WINDOW.end)!;
    if (end <= start) return 0;

    const current = now.getHours() * 60 + now.getMinutes();
    if (current <= start) return end - start;
    if (current >= end) return 0;
    return end - current;
}

/** "3h 20m" / "45m" / "0m" — compact enough for a stat tile. */
export function formatMinutes(totalMinutes: number): string {
    const safe = Math.max(0, Math.round(totalMinutes));
    const hours = Math.floor(safe / 60);
    const minutes = safe % 60;
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
}

/** Groups raw session records into per-day totals, newest day first. */
export function groupSessionsByDate(sessions: StoredFocusSession[]): DayFocus[] {
    const byDate = new Map<string, DayFocus>();

    for (const session of sessions) {
        const date = session.date || session.started_at?.slice(0, 10);
        if (!date) continue;
        const seconds = Math.max(0, Math.round(session.actual_duration ?? 0));

        const entry = byDate.get(date) ?? { date, seconds: 0, sessions: 0, completedSessions: 0, bestSeconds: 0 };
        entry.seconds += seconds;
        entry.sessions += 1;
        if (session.completed) entry.completedSessions += 1;
        if (seconds > entry.bestSeconds) entry.bestSeconds = seconds;
        byDate.set(date, entry);
    }

    return Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));
}

/** Reads every stored session. Malformed records are skipped, not thrown. */
export async function readFocusSessions(): Promise<StoredFocusSession[]> {
    try {
        const keys = await AsyncStorage.getAllKeys();
        const sessionKeys = keys.filter(key => key.startsWith(FOCUS_SESSION_PREFIX));
        if (sessionKeys.length === 0) return [];

        const pairs = await AsyncStorage.multiGet(sessionKeys);
        const sessions: StoredFocusSession[] = [];
        for (const [, value] of pairs) {
            if (!value) continue;
            try {
                sessions.push(JSON.parse(value) as StoredFocusSession);
            } catch {
                // A single corrupt record should not hide the rest of the history.
            }
        }
        return sessions;
    } catch {
        return [];
    }
}

export async function readFocusHistory(): Promise<DayFocus[]> {
    return groupSessionsByDate(await readFocusSessions());
}

export async function getDayWindow(): Promise<DayWindow> {
    try {
        const raw = await AsyncStorage.getItem(DAY_WINDOW_KEY);
        if (!raw) return DEFAULT_DAY_WINDOW;
        const parsed = JSON.parse(raw) as Partial<DayWindow>;
        const start = typeof parsed.start === 'string' && parseTimeToMinutes(parsed.start) !== null
            ? parsed.start : DEFAULT_DAY_WINDOW.start;
        const end = typeof parsed.end === 'string' && parseTimeToMinutes(parsed.end) !== null
            ? parsed.end : DEFAULT_DAY_WINDOW.end;
        return { start, end };
    } catch {
        return DEFAULT_DAY_WINDOW;
    }
}

export async function setDayWindow(window: DayWindow): Promise<void> {
    await AsyncStorage.setItem(DAY_WINDOW_KEY, JSON.stringify(window));
}
