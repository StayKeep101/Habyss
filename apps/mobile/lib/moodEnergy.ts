import type { Habit } from './habitsSQLite';
import { habitDays, keptRate, shiftDay, type HistoryDay } from './habitDays';
import { checkInDay, type CheckIn, type CheckInKind } from './checkIns';

/**
 * Mood and energy, worked out from the one-tap answers (lib/checkIns.ts).
 *
 * Per day, the average of that day's answers (1–5). Over the week, the
 * average and the change from the week before. When there is enough of it,
 * how habits go on good days against hard ones, counted from the record,
 * and the time of day energy is reported highest. Deterministic, and
 * nothing is said without the data behind it.
 */

export interface DayScore { date: string; mood: number | null; energy: number | null }
export interface MoodEnergy {
    days: DayScore[];
    week: Record<CheckInKind, number | null>;
    lastWeek: Record<CheckInKind, number | null>;
    /** Kept rate on high-energy days (4–5) against low ones (1–2), when both have three days or more. */
    energyEffect: { high: number; low: number; highDays: number; lowDays: number } | null;
    /** When energy answers are highest, with three answers or more in that part of the day. */
    bestTime: 'morning' | 'afternoon' | 'evening' | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const average = (values: number[]) => values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : null;

export function dayScores(entries: CheckIn[]): DayScore[] {
    const byDay = new Map<string, { mood: number[]; energy: number[] }>();
    for (const entry of entries) {
        const day = checkInDay(entry.at);
        const bucket = byDay.get(day) ?? { mood: [], energy: [] };
        bucket[entry.kind].push(entry.value);
        byDay.set(day, bucket);
    }
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b))
        .map(([date, values]) => ({ date, mood: average(values.mood), energy: average(values.energy) }));
}

export function moodEnergy(entries: CheckIn[], today: string, habits: Habit[] = [], history: HistoryDay[] = []): MoodEnergy {
    const days = dayScores(entries);
    const inRange = (from: string, to: string, kind: CheckInKind) =>
        average(days.filter(day => day.date >= from && day.date <= to && day[kind] !== null).map(day => day[kind] as number));
    const weekStart = shiftDay(today, -6);
    const lastStart = shiftDay(today, -13);
    const lastEnd = shiftDay(today, -7);

    let energyEffect: MoodEnergy['energyEffect'] = null;
    if (habits.length) {
        // Only days something was due: an empty day kept nothing and missed nothing.
        const record = habitDays(habits, history, {}, 90, shiftDay(today, -1), today).filter(day => day.scheduled.length > 0);
        const energyOn = new Map(days.filter(day => day.energy !== null).map(day => [day.date, day.energy as number]));
        const high = record.filter(day => (energyOn.get(day.date) ?? 0) >= 4);
        const low = record.filter(day => { const e = energyOn.get(day.date); return e !== undefined && e <= 2; });
        const h = keptRate(high);
        const l = keptRate(low);
        if (high.length >= 3 && low.length >= 3 && h.countable && l.countable) {
            energyEffect = { high: h.rate, low: l.rate, highDays: high.length, lowDays: low.length };
        }
    }

    // The same window and the same bar as Echo's pattern (lib/echoPatterns.ts),
    // so the two never name different peaks, and a tenth of a point is not one.
    const parts = { morning: [] as number[], afternoon: [] as number[], evening: [] as number[] };
    const floor = shiftDay(today, -60);
    for (const entry of entries) {
        if (entry.kind !== 'energy' || checkInDay(entry.at) < floor) continue;
        const hour = new Date(entry.at).getHours();
        parts[hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'].push(entry.value);
    }
    const ranked = (Object.entries(parts) as ['morning' | 'afternoon' | 'evening', number[]][])
        .filter(([, values]) => values.length >= 3)
        .map(([part, values]) => ({ part, avg: values.reduce((a, b) => a + b, 0) / values.length }))
        .sort((a, b) => b.avg - a.avg);

    return {
        days,
        week: { mood: inRange(weekStart, today, 'mood'), energy: inRange(weekStart, today, 'energy') },
        lastWeek: { mood: inRange(lastStart, lastEnd, 'mood'), energy: inRange(lastStart, lastEnd, 'energy') },
        energyEffect,
        bestTime: ranked.length >= 2 && ranked[0].avg - ranked[ranked.length - 1].avg >= 0.7 ? ranked[0].part : null,
    };
}
