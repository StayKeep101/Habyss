import type { Habit } from './habitsSQLite';
import { matches as recurrenceMatches, parseRecurrence } from './recurrence';

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
const startOfWeek = (date: Date) => calendarDay(date) - date.getDay();
const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

/** The same local calendar schedule is shared by Home, Roadmap and statistics. */
export function isHabitScheduledForDate(habit: Habit, date: Date): boolean {
    return createHabitSchedule(habit)(date);
}

/** Compile once when evaluating years of history for the same habit. */
export function createHabitSchedule(habit: Habit): (date: Date) => boolean {
    const start = parseHabitDate(habit.startDate) ?? parseHabitDate(habit.createdAt);
    if (!start) return () => false;

    // A habit written with the fuller grammar carries its rule; anything older
    // keeps the weekday-and-interval reading below, which is what it was saved
    // with. A rule that will not parse falls back rather than failing.
    const rule = parseRecurrence(habit.recurrence);
    if (rule) {
        const ends = [habit.endDate, habit.targetDate].map(parseHabitDate).filter((date): date is Date => date !== null);
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
    const ends = [habit.endDate, habit.targetDate].map(parseHabitDate).filter((date): date is Date => date !== null);
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
