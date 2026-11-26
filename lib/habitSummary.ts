import type { Habit } from './habitsSQLite';
import { createHabitRequirement, isHabitScheduledForDate, isQuotaHabit, localDateKey, parseHabitDate } from './habitSchedule';

/**
 * A habit at a glance, and the plain date helpers everything uses: how it
 * repeats in words, its last seven days, its 30-day rate, its streak and the
 * next day it is due.
 */
export type DayMark = 'done' | 'missed' | 'pending' | 'off' | 'skipped';

export interface HabitSummary {
    habit: Habit;
    schedule: string;
    /** Next day it is due and not yet done; null once it has ended. */
    nextDate: string | null;
    scheduledToday: boolean;
    doneToday: boolean;
    /** Oldest first, ending today. */
    last7: DayMark[];
    /** Share of scheduled days done over the last 30 days; null with none scheduled. */
    rate30: number | null;
    streak: number;
}

const NEXT_DATE_HORIZON = 400;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function dateAt(key: string): Date {
    return new Date(`${key}T12:00:00`);
}

export function addDays(key: string, days: number): string {
    const date = dateAt(key);
    date.setDate(date.getDate() + days);
    return localDateKey(date);
}

export function daysBetween(from: string, to: string): number {
    return Math.round((dateAt(to).getTime() - dateAt(from).getTime()) / 86_400_000);
}

const wasSkipped = (skips: Record<string, string[]> | undefined, day: string, habitId: string): boolean =>
    !!skips?.[day]?.includes(habitId);

export function summarizeHabit(
    habit: Habit,
    history: Record<string, string[]>,
    today: string,
    skips?: Record<string, string[]>,
): HabitSummary {
    const isDone = (day: string) => !!history[day]?.includes(habit.id);
    const isSkipped = (day: string) => wasSkipped(skips, day, habit.id);
    // Due that day, or (a "3 times a week" one) done on a day it was free.
    const required = createHabitRequirement(habit);
    const quota = isQuotaHabit(habit);
    const isScheduled = (day: string) => (required(day, isDone) || (quota && isDone(day))) && !isSkipped(day);

    // A "3 times a week" habit can be done any day the week still needs it.
    const scheduledToday = isScheduled(today) || (quota && !isSkipped(today) && isHabitScheduledForDate(habit, dateAt(today)));
    const doneToday = isDone(today);

    const last7: DayMark[] = [];
    for (let offset = 6; offset >= 0; offset--) {
        const day = addDays(today, -offset);
        if (isDone(day)) last7.push('done');
        else if (isSkipped(day)) last7.push('skipped');
        else if (!isScheduled(day)) last7.push('off');
        else last7.push(day === today ? 'pending' : 'missed');
    }

    // Today counts once it is done; until then it is not a miss.
    let scheduled = 0;
    let done = 0;
    for (let offset = 0; offset < 30; offset++) {
        const day = addDays(today, -offset);
        if (!isScheduled(day)) continue;
        if (day === today && !isDone(day)) continue;
        scheduled++;
        if (isDone(day)) done++;
    }

    let streak = 0;
    const start = parseHabitDate(habit.startDate) ?? parseHabitDate(habit.createdAt) ?? dateAt(today);
    const trackedDays = Math.max(0, daysBetween(localDateKey(start), today) + 1);
    for (let offset = 0; offset < trackedDays; offset++) {
        const day = addDays(today, -offset);
        if (!isScheduled(day)) continue;
        if (isDone(day)) streak++;
        else if (day === today) continue;
        else break;
    }

    let nextDate: string | null = null;
    for (let offset = doneToday || isSkipped(today) ? 1 : 0; offset < NEXT_DATE_HORIZON; offset++) {
        const day = addDays(today, offset);
        if (isScheduled(day)) { nextDate = day; break; }
    }

    return {
        habit,
        schedule: describeSchedule(habit),
        nextDate,
        scheduledToday,
        doneToday,
        last7,
        rate30: scheduled ? Math.round((done / scheduled) * 100) : null,
        streak,
    };
}

/**
 * How a habit repeats, in words, read from the same place its schedule is
 * (createHabitSchedule in lib/habitSchedule.ts): its rule when it has one
 * ("Weekdays", "3 times a week"), else the days and interval it was saved
 * with. The one description every card, sheet and list uses.
 */
export function describeSchedule(habit: Habit): string {
    const time = habit.startTime ? ` · ${habit.startTime}` : '';
    const { describe, parseRecurrence } = require('./recurrence') as typeof import('./recurrence');
    const rule = parseRecurrence(habit.recurrence);
    if (rule) return describe(rule) + time;
    const start = parseHabitDate(habit.startDate) ?? parseHabitDate(habit.createdAt);
    if (habit.frequency === 'monthly') {
        return `Monthly${start ? ` on the ${ordinal(start.getDate())}` : ''}${time}`;
    }
    if (habit.frequency === 'yearly') {
        return `Yearly${start ? ` on ${start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}${time}`;
    }

    const days = (habit.taskDays ?? []).map(day => day.toLowerCase().slice(0, 3));
    const indexes = DAY_NAMES.map(name => name.toLowerCase()).map((name, index) => (days.includes(name) ? index : -1)).filter(i => i >= 0);
    let label: string;
    if (indexes.length === 0 || indexes.length === 7) label = 'Every day';
    else if (indexes.length === 5 && [1, 2, 3, 4, 5].every(i => indexes.includes(i))) label = 'Weekdays';
    else if (indexes.length === 2 && indexes.includes(0) && indexes.includes(6)) label = 'Weekends';
    else label = [...indexes.filter(i => i > 0), ...indexes.filter(i => i === 0)].map(i => DAY_NAMES[i]).join(', ');

    const interval = Math.max(1, Math.floor(habit.weekInterval || 1));
    if (interval > 1) label += `, every ${interval} weeks`;
    return label + time;
}

const ordinal = (n: number): string => {
    const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
    return `${n}${suffix}`;
};

/** "Today", "Tomorrow", "Fri", or "12 Oct", relative to today. */
export function friendlyDate(day: string, today: string): string {
    const diff = daysBetween(today, day);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff > 1 && diff < 7) return dateAt(day).toLocaleDateString(undefined, { weekday: 'short' });
    return dateAt(day).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
