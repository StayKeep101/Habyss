import type { Habit } from './types';

/**
 * A habit's past schedules, so changing one never rewrites history.
 *
 * Every day used to be judged by the schedule the habit has now. Move "every
 * day" to "weekdays" and last month's weekends stopped being misses; move it
 * back and they came back. Streaks, Marks and the heat map all shifted under a
 * change that was only ever meant for the days ahead.
 *
 * Now a change keeps the schedule it replaces, with the last day it applied
 * to (yesterday). Each era covers the days after the one before it, up to and
 * including its `until`; today and every day after follow the habit's own
 * fields. Changing a schedule twice in one day keeps the first: yesterday was
 * still under that one.
 */
export interface ScheduleEra {
    /** The last day this schedule applied to (YYYY-MM-DD). */
    until: string;
    recurrence?: string | null;
    frequency?: Habit['frequency'] | null;
    taskDays?: string[] | null;
    weekInterval?: number | null;
}

/** What makes up a schedule; anything else on a habit can change freely. */
export const SCHEDULE_KEYS = ['recurrence', 'frequency', 'taskDays', 'weekInterval'] as const;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseScheduleHistory(raw: unknown): ScheduleEra[] | undefined {
    let value = raw;
    if (typeof value === 'string') {
        try { value = JSON.parse(value); } catch { return undefined; }
    }
    if (!Array.isArray(value)) return undefined;
    const eras = value
        .filter((era): era is ScheduleEra => !!era && typeof era === 'object' && typeof era.until === 'string' && DATE.test(era.until))
        .map(era => ({
            until: era.until,
            recurrence: typeof era.recurrence === 'string' ? era.recurrence : null,
            frequency: typeof era.frequency === 'string' ? era.frequency : null,
            taskDays: Array.isArray(era.taskDays) ? era.taskDays.filter(day => typeof day === 'string') : null,
            weekInterval: typeof era.weekInterval === 'number' && Number.isFinite(era.weekInterval) ? era.weekInterval : null,
        }))
        .sort((a, b) => a.until.localeCompare(b.until));
    return eras.length ? eras : undefined;
}

export const storeScheduleHistory = (eras: ScheduleEra[] | undefined): string | null => (eras?.length ? JSON.stringify(eras) : null);

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Whether a patch changes what days the habit falls on. */
export function changesSchedule(before: Habit, patch: Partial<Habit>): boolean {
    return SCHEDULE_KEYS.some(key => Object.prototype.hasOwnProperty.call(patch, key) && !same(patch[key], before[key]));
}

const dayBefore = (key: string) => {
    const [year, month, day] = key.split('-').map(Number);
    const date = new Date(year, month - 1, day - 1, 12);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/**
 * The history to save with a patch, or null when it stays as it is: the
 * schedule is not changing, the habit has no past days yet, or yesterday's
 * schedule is already kept.
 */
export function historyAfterChange(before: Habit, patch: Partial<Habit>, today: string): ScheduleEra[] | null {
    if (!changesSchedule(before, patch)) return null;
    const yesterday = dayBefore(today);
    const start = (before.startDate || before.createdAt || '').slice(0, 10);
    if (!DATE.test(start) || start > yesterday) return null;
    const eras = before.scheduleHistory ?? [];
    const last = eras[eras.length - 1];
    if (last && last.until >= yesterday) return null;
    return [...eras, {
        until: yesterday,
        recurrence: before.recurrence ?? null,
        frequency: before.frequency ?? null,
        taskDays: before.taskDays ?? [],
        weekInterval: before.weekInterval ?? null,
    }];
}

/** The habit as its schedule stood on a day. */
export function versionOn(habit: Habit, key: string): Habit {
    const era = habit.scheduleHistory?.find(item => key <= item.until);
    return era ? withEra(habit, era) : habit;
}

export function withEra(habit: Habit, era: ScheduleEra): Habit {
    return {
        ...habit,
        recurrence: era.recurrence ?? undefined,
        frequency: era.frequency ?? undefined,
        taskDays: era.taskDays ?? [],
        weekInterval: era.weekInterval ?? undefined,
    };
}
