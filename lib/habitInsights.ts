import type { Habit } from './habitsSQLite';
import { isHabitScheduledForDate, localDateKey } from './habitSchedule';

/**
 * Pattern insights and adaptive difficulty.
 *
 * Charts show what happened; this says what it means. Everything here is
 * computed from recorded completions against the schedule the user set, so an
 * insight can always be traced back to real occurrences.
 *
 * Rules:
 * - Nothing is reported below a minimum sample. Two missed days is not a
 *   pattern, and claiming otherwise trains people to distrust the app.
 * - A missing completion is described as "not logged", never as proof the user
 *   skipped it.
 * - Suggestions are proposals. Nothing here mutates a habit; the caller applies
 *   a change only when the user accepts it.
 * - Correlations we cannot compute are not guessed at. Habyss reads only
 *   mindfulness from Apple Health, so sleep- or step-based correlations are not
 *   available and are never implied.
 */

export type InsightKind = 'weekday_gap' | 'weekend_drop' | 'scale_down' | 'holding_well';

export interface ScaleDownSuggestion {
    habitId: string;
    fromValue: number;
    toValue: number;
    unit: string;
}

export interface Insight {
    id: string;
    kind: InsightKind;
    habitId?: string;
    title: string;
    /** Always states the numbers it is based on. */
    detail: string;
    /** Present only when there is something the user can accept. */
    suggestion?: ScaleDownSuggestion;
}

export interface DayRecord {
    date: string;
    completedIds: string[];
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Minimum evidence before anything is called a pattern. */
export const MIN_OCCURRENCES_PER_DAY = 3;
export const MIN_TOTAL_OCCURRENCES = 8;
export const MIN_WEEKEND_OCCURRENCES = 4;
/** Recent scheduled occurrences examined for adaptive difficulty. */
export const RECENT_WINDOW = 7;
export const MISSES_BEFORE_SCALING = 4;

const parseKey = (key: string): Date | null => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
};

const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 100));

/**
 * Reduces a target by a third, rounded down, never below 1.
 *
 * A third is a deliberate step rather than a guess: it is large enough to feel
 * easier and small enough that the habit keeps its shape.
 */
export function scaledDownTarget(value: number): number {
    return Math.max(1, Math.floor(value * (2 / 3)));
}

interface Occurrence { date: Date; key: string; completed: boolean }

/** Scheduled occurrences for one habit, with whether a completion was logged. */
export function occurrencesFor(habit: Habit, history: DayRecord[]): Occurrence[] {
    const result: Occurrence[] = [];
    for (const record of history) {
        const date = parseKey(record.date);
        if (!date) continue;
        if (!isHabitScheduledForDate(habit, date)) continue;
        result.push({ date, key: record.date, completed: record.completedIds.includes(habit.id) });
    }
    return result.sort((a, b) => a.key.localeCompare(b.key));
}

export function computeInsights(habits: Habit[], history: DayRecord[], today: Date = new Date()): Insight[] {
    const insights: Insight[] = [];
    const active = habits.filter(habit => !habit.isGoal && !habit.isArchived);
    const todayKey = localDateKey(today);
    // Today is still in progress, so an unlogged occurrence today is not a miss.
    const past = history.filter(record => record.date < todayKey);

    for (const habit of active) {
        const occurrences = occurrencesFor(habit, past);
        if (occurrences.length === 0) continue;

        /* ---------------------------------------------- weekday differences */
        if (occurrences.length >= MIN_TOTAL_OCCURRENCES) {
            const byDay = new Map<number, { total: number; done: number }>();
            for (const occurrence of occurrences) {
                const day = occurrence.date.getDay();
                const bucket = byDay.get(day) ?? { total: 0, done: 0 };
                bucket.total += 1;
                if (occurrence.completed) bucket.done += 1;
                byDay.set(day, bucket);
            }

            let worst: { day: number; rate: number; total: number; done: number } | null = null;
            for (const [day, bucket] of byDay) {
                if (bucket.total < MIN_OCCURRENCES_PER_DAY) continue;
                const rate = pct(bucket.done, bucket.total);
                if (!worst || rate < worst.rate) worst = { day, rate, total: bucket.total, done: bucket.done };
            }

            if (worst) {
                const others = occurrences.filter(occurrence => occurrence.date.getDay() !== worst!.day);
                const otherRate = pct(others.filter(o => o.completed).length, others.length);
                if (others.length >= MIN_OCCURRENCES_PER_DAY && worst.rate <= 50 && otherRate - worst.rate >= 30) {
                    insights.push({
                        id: `weekday_gap_${habit.id}`,
                        kind: 'weekday_gap',
                        habitId: habit.id,
                        title: `${habit.name} slips on ${DAY_NAMES[worst.day]}s`,
                        detail: `Logged ${worst.done} of ${worst.total} ${DAY_NAMES[worst.day]}s, against ${otherRate}% on other days.`,
                    });
                }
            }
        }

        /* ------------------------------------------------ adaptive difficulty */
        const recent = occurrences.slice(-RECENT_WINDOW);
        const misses = recent.filter(occurrence => !occurrence.completed).length;
        const isNumeric = habit.trackingMethod === 'numeric' && (habit.goalValue ?? 0) > 1;

        if (recent.length >= RECENT_WINDOW && misses >= MISSES_BEFORE_SCALING && isNumeric) {
            const toValue = scaledDownTarget(habit.goalValue);
            if (toValue < habit.goalValue) {
                insights.push({
                    id: `scale_down_${habit.id}`,
                    kind: 'scale_down',
                    habitId: habit.id,
                    title: `Make ${habit.name} easier to hit?`,
                    detail: `Logged ${recent.length - misses} of the last ${recent.length} times. A smaller target is easier to keep than a streak you have to restart.`,
                    suggestion: {
                        habitId: habit.id,
                        fromValue: habit.goalValue,
                        toValue,
                        unit: habit.unit ?? 'time',
                    },
                });
            }
        } else if (recent.length >= RECENT_WINDOW && misses === 0) {
            insights.push({
                id: `holding_well_${habit.id}`,
                kind: 'holding_well',
                habitId: habit.id,
                title: `${habit.name} is holding`,
                detail: `Logged every one of the last ${recent.length} times it was scheduled.`,
            });
        }
    }

    /* ------------------------------------------------------- weekend pattern */
    const allOccurrences = active.flatMap(habit => occurrencesFor(habit, past));
    const weekend = allOccurrences.filter(o => o.date.getDay() === 0 || o.date.getDay() === 6);
    const weekday = allOccurrences.filter(o => o.date.getDay() !== 0 && o.date.getDay() !== 6);

    if (weekend.length >= MIN_WEEKEND_OCCURRENCES && weekday.length >= MIN_WEEKEND_OCCURRENCES) {
        const weekendRate = pct(weekend.filter(o => o.completed).length, weekend.length);
        const weekdayRate = pct(weekday.filter(o => o.completed).length, weekday.length);
        if (weekdayRate - weekendRate >= 25) {
            insights.push({
                id: 'weekend_drop',
                kind: 'weekend_drop',
                title: 'Weekends are where it slips',
                detail: `${weekendRate}% logged at weekends against ${weekdayRate}% on weekdays, across ${weekend.length + weekday.length} scheduled days.`,
            });
        }
    }

    return insights;
}
