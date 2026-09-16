import type { Habit } from './habitsSQLite';

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
    if (!Number.isFinite(date.getTime())) return false;
    const start = parseHabitDate(habit.startDate) ?? parseHabitDate(habit.createdAt);
    if (!start) return false;
    const day = calendarDay(date);
    if (day < calendarDay(start)) return false;
    // Respect both the explicit end date and legacy target date, inclusively.
    for (const boundary of [habit.endDate, habit.targetDate]) {
        const end = parseHabitDate(boundary);
        if (end && day > calendarDay(end)) return false;
    }

    if (habit.frequency === 'monthly') {
        return date.getDate() === Math.min(start.getDate(), daysInMonth(date.getFullYear(), date.getMonth()));
    }
    if (habit.frequency === 'yearly') {
        return date.getMonth() === start.getMonth()
            && date.getDate() === Math.min(start.getDate(), daysInMonth(date.getFullYear(), start.getMonth()));
    }

    const interval = Math.max(1, Math.floor(habit.weekInterval || 1));
    if (interval > 1) {
        const weeksSinceStart = (startOfWeek(date) - startOfWeek(start)) / 7;
        if (weeksSinceStart % interval !== 0) return false;
    }

    if (habit.taskDays?.length) {
        return habit.taskDays.some(dayName => dayName.toLowerCase().slice(0, 3) === WEEKDAYS[date.getDay()]);
    }
    return true;
}
