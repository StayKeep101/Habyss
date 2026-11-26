// Copied from Habyss Mobile lib/habitSchedule.ts @f48c4da4. Keep in sync; do not re-derive rules.
import type { Habit } from './habitsSQLite';
import { matches as recurrenceMatches, parseRecurrence } from './recurrence';
import { versionOn, withEra } from './scheduleHistory';
// Desktop: the history comes from today's cloud data (src/shared/dataStore.ts) instead of the phone's store.
import { getData } from './dataStore';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export const localDateKey = (date: Date): string =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Date-only schedules stay on their calendar day; timestamps use local time. */
export function parseHabitDate(value: string | undefined): Date | null {
    if (!value) return null;
    const calendarDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (calendarDate) {
        const [, year, month, day] = calendarDate;
        const parsed = new Date(Number(year), Number(month) - 1, Number(day), 12);
        return localDateKey(parsed) === value ? parsed : null;
    }
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) return null;
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12);
}

// UTC is used only for calendar arithmetic, avoiding 23/25-hour DST days.
const calendarDay = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY;
// Weeks start on Monday, as in lib/recurrence.ts (RFC 5545's default WKST=MO), so every rule agrees which fortnight it is.
const startOfWeek = (date: Date) => calendarDay(date) - ((date.getDay() + 6) % 7);
const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

/**
 * Whether a habit is on the day's list: the calendar's answer, and for a
 * "3 times a week" habit, whether the week still needs it (or it was done
 * that day). Home, the timeline, widgets and reminders all read this. What
 * counts as due, and as missed, is habitRequirement below.
 */
export function isHabitScheduledForDate(habit: Habit, date: Date): boolean {
    if (!createHabitSchedule(habit)(date)) return false;
    // The schedule that day, not today's (lib/scheduleHistory.ts).
    const quota = quotaOf(versionOn(habit, localDateKey(date)));
    if (!quota) return true;
    return quotaState(habit, quota, localDateKey(date), historyDone(habit.id)).offered;
}

type Quota = { times: number; period: 'week' | 'month' };
/** A "3 times a week" habit: done on any days, due only once it cannot wait. */
export const isQuotaHabit = (habit: Habit): boolean => parseRecurrence(habit.recurrence)?.kind === 'quota';
const quotaOf = (habit: Habit): Quota | null => {
    const rule = parseRecurrence(habit.recurrence);
    return rule?.kind === 'quota' ? { times: rule.times, period: rule.period } : null;
};

/** Ticks from the app's one copy of history (lib/dataStore.ts), for display. */
function historyDone(habitId: string): (key: string) => boolean {
    try {
        const history = getData().history;
        return key => !!history[key]?.includes(habitId);
    } catch {
        return () => false;
    }
}

const keyAt = (day: number) => {
    const date = new Date(day * MS_PER_DAY);
    return localDateKey(new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12));
};

/**
 * Where a quota habit stands on a day: how many its week (Monday to Sunday)
 * or month still needs before that day, and the days left in it.
 * - offered: the period still needs it, or it was done that day;
 * - required: it can no longer wait. Needing 3 with Friday, Saturday and
 *   Sunday left makes each of them due; Monday to Thursday never were.
 */
function quotaState(habit: Habit, quota: Quota, key: string, doneOn: (key: string) => boolean): { offered: boolean; required: boolean } {
    const date = parseHabitDate(key);
    const start = parseHabitDate(habit.startDate) ?? parseHabitDate(habit.createdAt);
    if (!date || !start) return { offered: false, required: false };
    const day = calendarDay(date);
    let from: number;
    let to: number;
    if (quota.period === 'week') {
        from = day - ((date.getDay() + 6) % 7);
        to = from + 6;
    } else {
        from = calendarDay(new Date(date.getFullYear(), date.getMonth(), 1, 12));
        to = calendarDay(new Date(date.getFullYear(), date.getMonth() + 1, 0, 12));
    }
    const ends = [habit.endDate].map(parseHabitDate).filter((value): value is Date => value !== null);
    if (ends.length) to = Math.min(to, ...ends.map(calendarDay));
    const periodLength = to - from + 1;
    // A habit started part-way through its first week or month asks for its share
    // of it ("3 a week" started on Saturday: 1), never more than the days it had.
    const startDay = calendarDay(start);
    const times = startDay > from ? Math.ceil(quota.times * (to - startDay + 1) / periodLength) : quota.times;
    from = Math.max(from, startDay);
    let done = 0;
    for (let at = from; at < day; at++) if (doneOn(keyAt(at))) done++;
    const needed = times - done;
    const daysLeft = to - day + 1;
    return { offered: needed > 0 || doneOn(key), required: needed > 0 && needed >= daysLeft };
}

/**
 * How far a "3 times a week" habit is through its period on a day: the ticks
 * so far (that day included) against the times it asks for. Null for any
 * other habit. The row says it, so which days counted is never a guess.
 */
export function quotaProgress(habit: Habit, key: string, doneOn: (key: string) => boolean = historyDone(habit.id)): { done: number; times: number; period: 'week' | 'month' } | null {
    const quota = quotaOf(versionOn(habit, key));
    const date = parseHabitDate(key);
    const start = parseHabitDate(habit.startDate) ?? parseHabitDate(habit.createdAt);
    if (!quota || !date || !start) return null;
    const day = calendarDay(date);
    const from = Math.max(calendarDay(start), quota.period === 'week'
        ? day - ((date.getDay() + 6) % 7)
        : calendarDay(new Date(date.getFullYear(), date.getMonth(), 1, 12)));
    let done = 0;
    for (let at = from; at <= day; at++) if (doneOn(keyAt(at))) done++;
    return { done, times: quota.times, period: quota.period };
}

/**
 * Whether a habit was due on a day, for everything that counts kept and
 * missed (streaks, Marks, perfect days, goal progress). The calendar's answer
 * for every habit except a quota one, which is due only once it cannot wait
 * (see quotaState). `doneOn` reads that habit's ticks; by default the app's history.
 */
export function createHabitRequirement(habit: Habit): (key: string, doneOn?: (key: string) => boolean) => boolean {
    const schedule = createHabitSchedule(habit);
    const current = quotaOf(habit);
    const past = habit.scheduleHistory;
    return (key, doneOn) => {
        const date = parseHabitDate(key);
        if (!date || !schedule(date)) return false;
        const quota = past?.length ? quotaOf(versionOn(habit, key)) : current;
        if (!quota) return true;
        return quotaState(habit, quota, key, doneOn ?? historyDone(habit.id)).required;
    };
}

/**
 * The first day a habit is due, on or after its start: what its start date
 * should be. As in every calendar (RFC 5545, where DTSTART is the series' first
 * occurrence), "every 4 weeks on Thursday" made on a Sunday starts on the coming
 * Thursday and counts its 4 weeks from there, not from the week it was made in.
 * Null when nothing is due within ten years (or the dates do not parse).
 */
export function firstDueDay(habit: Pick<Habit, 'startDate' | 'createdAt' | 'recurrence' | 'frequency' | 'taskDays' | 'weekInterval' | 'endDate'>): string | null {
    const start = parseHabitDate(habit.startDate) ?? parseHabitDate(habit.createdAt);
    if (!start) return null;
    const from = localDateKey(start);
    // Try each day as the start: the first one the rule itself asks for, counted from that day.
    for (let offset = 0; offset < 3660; offset++) {
        const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset, 12);
        const key = localDateKey(day);
        if (createHabitSchedule({ ...habit, startDate: key } as Habit)(day)) return offset === 0 ? from : key;
    }
    return null;
}

/**
 * Compile once when evaluating years of history for the same habit. Each day
 * is judged by the schedule the habit had then (lib/scheduleHistory.ts), so
 * changing it only changes the days ahead.
 */
export function createHabitSchedule(habit: Habit): (date: Date) => boolean {
    const current = compileSchedule(habit);
    const past = habit.scheduleHistory;
    if (!past?.length) return current;
    const eras = past.map(era => ({ until: era.until, test: compileSchedule(withEra(habit, era)) }));
    return date => {
        if (!Number.isFinite(date.getTime())) return false;
        const key = localDateKey(date);
        return (eras.find(era => key <= era.until)?.test ?? current)(date);
    };
}

function compileSchedule(habit: Habit): (date: Date) => boolean {
    const start = parseHabitDate(habit.startDate) ?? parseHabitDate(habit.createdAt);
    if (!start) return () => false;

    // A habit written with the fuller grammar carries its rule; anything older
    // keeps the weekday-and-interval reading below, which is what it was saved
    // with. A rule that will not parse falls back rather than failing.
    const rule = parseRecurrence(habit.recurrence);
    if (rule) {
        const ends = [habit.endDate].map(parseHabitDate).filter((date): date is Date => date !== null);
        const endDay = ends.length ? Math.min(...ends.map(calendarDay)) : Infinity;
        return date => {
            if (!Number.isFinite(date.getTime())) return false;
            if (calendarDay(date) > endDay) return false;
            return recurrenceMatches(rule, date, start);
        };
    }

    const startDay = calendarDay(start);
    const startWeek = startOfWeek(start);
    const startMonth = start.getMonth();
    const startDate = start.getDate();
    const ends = [habit.endDate].map(parseHabitDate).filter((date): date is Date => date !== null);
    const endDay = ends.length ? Math.min(...ends.map(calendarDay)) : Infinity;
    const interval = Math.max(1, Math.floor(habit.weekInterval || 1));
    const weekdays = new Set((habit.taskDays ?? []).map(day => day.toLowerCase().slice(0, 3)));
    const frequency = habit.frequency;

    return date => {
        if (!Number.isFinite(date.getTime())) return false;
        const day = calendarDay(date);
        if (day < startDay || day > endDay) return false;
        if (frequency === 'monthly') {
            return date.getDate() === Math.min(startDate, daysInMonth(date.getFullYear(), date.getMonth()));
        }
        if (frequency === 'yearly') {
            return date.getMonth() === startMonth
                && date.getDate() === Math.min(startDate, daysInMonth(date.getFullYear(), startMonth));
        }
        if (interval > 1 && ((startOfWeek(date) - startWeek) / 7) % interval !== 0) return false;
        return weekdays.size === 0 || weekdays.has(WEEKDAYS[date.getDay()]);
    };
}
