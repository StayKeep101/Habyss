import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDateKey } from './habitSchedule';
import { taskRank, tasksForDay, todayKey, type Task } from './tasks';
import { emit } from './appEvents';

/**
 * The three things that move the needle today.
 *
 * The idea is older than the app: pick a very small number of things that
 * matter, and spend the day getting them done. The number is small on purpose.
 * A list of twenty is a list nobody finishes and eventually nobody reads; a
 * list of three is a promise you can keep, and keeping it is the point.
 *
 * So the target is a count of tasks finished today, not a set of particular
 * tasks. Finishing three things that were not the three shown still counts —
 * the day's promise was three, and three got done. The rows on the card are
 * only a suggestion of where to start, taken in the order the roadmap already
 * ranks work: late first, then due today, then whatever has no date.
 */

export type DailyTarget = 3 | 5;

export const TARGETS: DailyTarget[] = [3, 5];
export const DEFAULT_TARGET: DailyTarget = 3;

const KEY = 'habyss_daily_focus_target';
/** Fired when the target changes, so open screens follow it. */
export const TARGET_CHANGED = 'daily_focus_target_changed';

export async function getDailyTarget(): Promise<DailyTarget> {
    try {
        const stored = Number(await AsyncStorage.getItem(KEY));
        return stored === 5 ? 5 : DEFAULT_TARGET;
    } catch {
        return DEFAULT_TARGET;
    }
}

export async function saveDailyTarget(target: DailyTarget): Promise<void> {
    try {
        await AsyncStorage.setItem(KEY, String(target));
    } catch {
        // The target is a preference; failing to store it is not worth an error.
    }
    emit(TARGET_CHANGED, target);
}

/** A task finished on this particular day, whatever day it was due. */
export const doneOnDay = (task: Task, day: string): boolean =>
    task.status === 'done' && !!task.completedAt && task.completedAt.slice(0, 10) === day;

export interface DailyFocus {
    /** The rows to show: what was finished today, then what to start next. */
    rows: Task[];
    /** How many were finished today, counted past the target. */
    done: number;
    target: DailyTarget;
    /** Done, capped at the target, for the ring. */
    progress: number;
    complete: boolean;
    /** Finished beyond the target — worth saying, never worth demanding. */
    extra: number;
}

export function dailyFocus(
    tasks: Task[],
    target: DailyTarget = DEFAULT_TARGET,
    day: string = todayKey(),
    today: string = todayKey(),
): DailyFocus {
    const finished = tasks
        .filter(task => doneOnDay(task, day))
        .sort((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? ''));

    const open = tasksForDay(tasks, day, today)
        .filter(task => task.status === 'open')
        .sort((a, b) => taskRank(a, day) - taskRank(b, day) || a.createdAt.localeCompare(b.createdAt));

    const done = finished.length;
    // The card always offers somewhere to start, even once the day is won.
    const room = Math.max(0, target - done);
    const rows = [...finished.slice(0, target), ...open.slice(0, Math.max(room, done >= target ? 1 : 0))];

    return {
        rows,
        done,
        target,
        progress: Math.min(done, target),
        complete: done >= target,
        extra: Math.max(0, done - target),
    };
}

export interface FocusDay {
    date: string;
    done: number;
    target: DailyTarget;
    hit: boolean;
}

/** The last `days` days, oldest first, for the dashboard. */
export function focusHistory(
    tasks: Task[],
    target: DailyTarget = DEFAULT_TARGET,
    days = 30,
    today: string = todayKey(),
): FocusDay[] {
    const out: FocusDay[] = [];
    for (let offset = days - 1; offset >= 0; offset--) {
        const date = new Date(`${today}T12:00:00`);
        date.setDate(date.getDate() - offset);
        const key = localDateKey(date);
        const done = tasks.filter(task => doneOnDay(task, key)).length;
        out.push({ date: key, done, target, hit: done >= target });
    }
    return out;
}

/**
 * The run of days ending today where the target was met.
 *
 * Today counts only once it is won, so an unfinished day does not read as a
 * broken streak while there is still time to finish it.
 */
export function focusStreak(history: FocusDay[]): number {
    let streak = 0;
    for (let index = history.length - 1; index >= 0; index--) {
        if (history[index].hit) { streak += 1; continue; }
        // The last day in the list is today; it has not been lost yet.
        if (index === history.length - 1) continue;
        break;
    }
    return streak;
}

export interface FocusInsights {
    /** Days the target was met, out of the days looked at. */
    hits: number;
    days: number;
    /** Share of those days, 0-100. */
    rate: number;
    streak: number;
    bestStreak: number;
    /** Tasks finished across the whole window. */
    finished: number;
    /** Average finished per day, to one decimal. */
    perDay: number;
    /** The weekday the target is met most often, or null without evidence. */
    bestWeekday: string | null;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function focusInsights(history: FocusDay[]): FocusInsights {
    const days = history.length;
    const hits = history.filter(day => day.hit).length;
    const finished = history.reduce((total, day) => total + day.done, 0);

    let bestStreak = 0;
    let run = 0;
    for (const day of history) {
        run = day.hit ? run + 1 : 0;
        if (run > bestStreak) bestStreak = run;
    }

    // Which weekday is won most often, and only once a weekday has been seen
    // enough times for the answer to mean anything.
    const byWeekday = WEEKDAYS.map(() => ({ hit: 0, seen: 0 }));
    for (const day of history) {
        const index = new Date(`${day.date}T12:00:00`).getDay();
        byWeekday[index].seen += 1;
        if (day.hit) byWeekday[index].hit += 1;
    }
    let bestWeekday: string | null = null;
    let bestShare = 0;
    byWeekday.forEach((entry, index) => {
        if (entry.seen < 2 || entry.hit === 0) return;
        const share = entry.hit / entry.seen;
        if (share > bestShare) { bestShare = share; bestWeekday = WEEKDAYS[index]; }
    });

    return {
        hits,
        days,
        rate: days === 0 ? 0 : Math.round((hits / days) * 100),
        streak: focusStreak(history),
        bestStreak,
        finished,
        perDay: days === 0 ? 0 : Math.round((finished / days) * 10) / 10,
        bestWeekday,
    };
}
