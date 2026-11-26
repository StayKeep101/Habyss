import type { SleepNight } from './sleepMath';
import type { ActivityDay } from './activityLog';

/**
 * The week's figures under the sleep and activity charts, worked out once here
 * so the cards only draw them. Days with nothing recorded are left out of
 * averages (a night the watch was charging is not a night of 0 hours).
 */

export interface SleepWeek {
    /** Average minutes asleep over the nights recorded; null with none. */
    average: number | null;
    /** Nights at or over the goal, and nights recorded. */
    met: number;
    recorded: number;
    /** When you usually fell asleep, as minutes after midnight (can be negative: before midnight); null without bed times. */
    bedtime: number | null;
    /** How much that moves night to night: the average distance from it, in minutes. */
    spread: number | null;
}

/** Minutes from midnight, before midnight negative, so 23:40 and 00:20 average to 00:00, not noon. */
export const clockMinutes = (at: number): number => {
    const date = new Date(at);
    const minutes = date.getHours() * 60 + date.getMinutes();
    return minutes >= 12 * 60 ? minutes - 24 * 60 : minutes;
};

export function sleepWeek(keys: string[], nights: Record<string, number>, details: Record<string, SleepNight> | undefined, target: number): SleepWeek {
    const recorded = keys.map(key => nights[key]).filter((value): value is number => value !== undefined && value > 0);
    const beds = keys.map(key => details?.[key]?.bed).filter((value): value is number => typeof value === 'number').map(clockMinutes);
    const bedtime = beds.length ? Math.round(beds.reduce((sum, value) => sum + value, 0) / beds.length) : null;
    return {
        average: recorded.length ? Math.round(recorded.reduce((sum, value) => sum + value, 0) / recorded.length) : null,
        met: recorded.filter(value => value >= target).length,
        recorded: recorded.length,
        bedtime,
        spread: bedtime !== null && beds.length > 1 ? Math.round(beds.reduce((sum, value) => sum + Math.abs(value - bedtime), 0) / beds.length) : null,
    };
}

export interface ActivityWeek {
    averageMinutes: number | null;
    averageSteps: number | null;
    met: number;
    recorded: number;
}

export function activityWeek(keys: string[], days: Record<string, ActivityDay>, target: number): ActivityWeek {
    const recorded = keys.map(key => days[key]).filter((day): day is ActivityDay => !!day);
    const mean = (values: number[]) => (values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null);
    return {
        averageMinutes: mean(recorded.map(day => day.minutes)),
        averageSteps: mean(recorded.map(day => day.steps)),
        met: recorded.filter(day => day.minutes >= target).length,
        recorded: recorded.length,
    };
}

/** "11:48 PM" for minutes from midnight (negative: the evening before). */
export const formatClockMinutes = (minutes: number): string => {
    const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440;
    return new Date(2000, 0, 1, Math.floor(wrapped / 60), wrapped % 60).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};
