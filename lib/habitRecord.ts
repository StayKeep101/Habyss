/**
 * One habit's record, from its days: the run it is on, its best run, how many
 * days it was done, how often it is kept (all along, and the last 30 days
 * against the 30 before), the days of this week, and the weekday it is kept
 * best on. One rule for the habit page and its calendar.
 *
 * A day counts when the habit was due on it and not skipped; today does not
 * break a run until it is over.
 */
export interface RecordDay {
    date: string; completed: boolean; skipped: boolean; scheduled: boolean;
    /** Several people on a shared habit, together: the share of them who did it that day (0–1). */
    share?: number;
}
export type DayState = 'done' | 'missed' | 'skipped' | 'off' | 'today' | 'future';

export interface HabitRecord {
    streak: number;
    best: number;
    /** Days done, all along. */
    done: number;
    /** Share of due days done, all along; null before any was due. */
    rate: number | null;
    /** The last 30 days, and the 30 before them. */
    rate30: number | null;
    ratePrev30: number | null;
    /** This week, its first day from Settings, with each day's state. */
    week: { date: string; state: DayState }[];
    /** 0 Sunday … 6 Saturday, once there are enough days to say. */
    bestWeekday: number | null;
    /** The last twelve weeks, oldest first: due days kept, by the same count as everything above. */
    weeks: { from: string; done: number; due: number; share: number | null }[];
    /**
     * Consistency, day by day for the last eight weeks, oldest first: the share
     * of due days kept in the seven days ending on each day (null while
     * nothing was due in them). A rolling week reads as a trend, not as noise.
     */
    consistency: { date: string; share: number | null }[];
}

const shift = (day: string, by: number) => {
    const date = new Date(`${day}T12:00:00`);
    date.setDate(date.getDate() + by);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const pct = (done: number, due: number) => (due ? Math.round((done / due) * 100) : null);
/** How many weeks the habit's graph looks back. */
const WEEKS = 12;
/** How many days the consistency line covers, and the window each point looks back over. */
export const CONSISTENCY_DAYS = 56;
const ROLLING = 7;

export function habitRecord(history: RecordDay[], today: string, startDate?: string, weekStartsMonday = true): HabitRecord {
    const byDate = new Map(history.map(day => [day.date, day]));
    const days = [...history].filter(day => (!startDate || day.date >= startDate) && day.date <= today)
        .sort((a, b) => a.date.localeCompare(b.date));
    let best = 0; let run = 0; let due = 0; let doneDue = 0; let done = 0;
    const weekday = { due: Array(7).fill(0) as number[], kept: Array(7).fill(0) as number[] };
    for (const day of days) {
        if (day.completed) done++;
        if (!day.scheduled || day.skipped) continue;
        if (day.date === today && !day.completed) continue;
        due++;
        const wd = new Date(`${day.date}T12:00:00`).getDay();
        weekday.due[wd]++;
        if (day.completed) { doneDue++; weekday.kept[wd]++; }
        run = day.completed ? run + 1 : 0;
        best = Math.max(best, run);
    }
    const window = (from: number, to: number) => {
        let windowDue = 0; let windowDone = 0;
        for (let back = from; back < to; back++) {
            const day = byDate.get(shift(today, -back));
            if (!day || (startDate && day.date < startDate) || !day.scheduled || day.skipped) continue;
            if (day.date === today && !day.completed) continue;
            windowDue++;
            if (day.completed) windowDone++;
        }
        return pct(windowDone, windowDue);
    };
    const back = (new Date(`${today}T12:00:00`).getDay() + (weekStartsMonday ? 6 : 0)) % 7;
    const week = Array.from({ length: 7 }, (_, index) => {
        const date = shift(today, index - back);
        const day = byDate.get(date);
        const state: DayState = date > today ? 'future'
            : day?.completed ? 'done'
            : startDate && date < startDate ? 'off'
            : day?.skipped ? 'skipped'
            : day && !day.scheduled ? 'off'
            : date === today ? 'today'
            : 'missed';
        return { date, state };
    });
    // The weekday kept most often, once it has been due at least three times.
    let bestWeekday: number | null = null;
    let bestShare = 0;
    for (let wd = 0; wd < 7; wd++) {
        if (weekday.due[wd] < 3) continue;
        const share = weekday.kept[wd] / weekday.due[wd];
        if (share > bestShare) { bestShare = share; bestWeekday = wd; }
    }
    // Week by week, counted as above: a due day not skipped, today only once done.
    const weeks = Array.from({ length: WEEKS }, (_, index) => {
        const from = shift(today, -back - (WEEKS - 1 - index) * 7);
        let weekDue = 0; let weekDone = 0;
        for (let offset = 0; offset < 7; offset++) {
            const date = shift(from, offset);
            const day = byDate.get(date);
            if (!day || date > today || (startDate && date < startDate) || !day.scheduled || day.skipped) continue;
            if (date === today && !day.completed) continue;
            weekDue++;
            if (day.completed) weekDone++;
        }
        return { from, done: weekDone, due: weekDue, share: weekDue ? weekDone / weekDue : null };
    });
    // Rolling seven days, counted as above, ending on each of the last eight weeks' days.
    const counted = (date: string): { due: boolean; kept: boolean } => {
        const day = byDate.get(date);
        if (!day || date > today || (startDate && date < startDate) || !day.scheduled || day.skipped) return { due: false, kept: false };
        if (date === today && !day.completed) return { due: false, kept: false };
        return { due: true, kept: day.completed };
    };
    const consistency = Array.from({ length: CONSISTENCY_DAYS }, (_, index) => {
        const date = shift(today, -(CONSISTENCY_DAYS - 1 - index));
        let rollingDue = 0; let rollingKept = 0;
        for (let back = 0; back < ROLLING; back++) {
            const day = counted(shift(date, -back));
            if (!day.due) continue;
            rollingDue++;
            if (day.kept) rollingKept++;
        }
        return { date, share: rollingDue ? rollingKept / rollingDue : null };
    });
    return { streak: run, best, done, rate: pct(doneDue, due), rate30: window(0, 30), ratePrev30: window(30, 60), week, bestWeekday: bestShare > 0 ? bestWeekday : null, weeks, consistency };
}

/**
 * Consistency over the habit's whole life, oldest first: each day, the share
 * of due days kept in the seven days ending on it (null while nothing was
 * due). From the day it began (or its first recorded day) to today, so two
 * people on a shared habit start from the same place on the left.
 */
export function consistencyFrom(history: RecordDay[], today: string, startDate?: string, minDays = CONSISTENCY_DAYS): { date: string; share: number | null }[] {
    const byDate = new Map(history.map(day => [day.date, day]));
    const first = startDate ?? [...history].map(day => day.date).sort()[0] ?? today;
    const span = Math.max(minDays, Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${first}T12:00:00`).getTime()) / 86_400_000) + 1);
    const counted = (date: string) => {
        const day = byDate.get(date);
        if (!day || date > today || (startDate && date < startDate) || !day.scheduled || day.skipped) return null;
        if (date === today && !day.completed && day.share === undefined) return null;
        return day.share ?? (day.completed ? 1 : 0);
    };
    return Array.from({ length: span }, (_, index) => {
        const date = shift(today, -(span - 1 - index));
        let due = 0; let kept = 0;
        for (let back = 0; back < 7; back++) {
            const value = counted(shift(date, -back));
            if (value === null) continue;
            due++; kept += value;
        }
        return { date, share: due ? kept / due : null };
    });
}
