import { bestStreakFrom } from './dayComplete';
import { shiftDay, type FocusRecord } from './focusStats';

/**
 * What made today worth a post of its own, worked out on the poster's phone
 * (where the whole history is) and carried on the day card, so friends see a
 * Comeback or a Personal best without the server knowing anyone's history.
 * Only numbers: never a habit, task or goal name (the server strips names
 * from cards whose owner doesn't share them; these fields would slip past).
 */
export interface DayMoments {
    /** Minutes focused today. */
    focusMinutes?: number;
    /** Today beat something they had never beaten before. */
    best?: { kind: 'streak'; days: number } | { kind: 'focus'; minutes: number };
    /** Back after this many days with nothing done. */
    comeback?: number;
    /** A streak landing on a round number today: 7, 30, 100, … */
    milestone?: number;
}

/** Streak lengths worth a post. */
export const STREAK_MILESTONES = [7, 14, 30, 50, 100, 150, 200, 365, 500, 1000] as const;
/** The fewest missed days that make showing up again a comeback. */
export const COMEBACK_GAP = 3;
/** A personal best in focus counts from half an hour; a streak best from three days. */
const MIN_FOCUS_BEST = 30;
const MIN_STREAK_BEST = 3;

export function dayMoments(input: { today: string; streak: number; completedDates: string[]; focus: FocusRecord[] }): DayMoments {
    const { today, streak, completedDates, focus } = input;
    const moments: DayMoments = {};

    const byDay = new Map<string, number>();
    for (const record of focus) byDay.set(record.date, (byDay.get(record.date) ?? 0) + record.seconds);
    const minutes = Math.floor((byDay.get(today) ?? 0) / 60);
    if (minutes > 0) moments.focusMinutes = minutes;

    const doneToday = completedDates.includes(today);
    if (doneToday) {
        // The last day before today with something done: the gap behind today.
        const before = completedDates.filter(day => day < today).sort().pop();
        if (before) {
            let gap = 0;
            for (let day = shiftDay(today, -1); day > before; day = shiftDay(day, -1)) gap++;
            if (gap >= COMEBACK_GAP) moments.comeback = gap;
        }
        if ((STREAK_MILESTONES as readonly number[]).includes(streak)) moments.milestone = streak;
    }

    // The runs that ended before this one began: the current run cannot beat itself.
    const runStart = shiftDay(today, -Math.max(0, streak - 1));
    const previousBestStreak = bestStreakFrom(completedDates.filter(day => day < runStart));
    const previousBestFocus = Math.max(0, ...[...byDay].filter(([day]) => day < today).map(([, seconds]) => Math.floor(seconds / 60)));
    // Only the day the old record falls, not every day after it.
    if (doneToday && streak >= MIN_STREAK_BEST && previousBestStreak > 0 && streak === previousBestStreak + 1) {
        moments.best = { kind: 'streak', days: streak };
    } else if (minutes >= MIN_FOCUS_BEST && minutes > previousBestFocus && previousBestFocus > 0) {
        moments.best = { kind: 'focus', minutes };
    }
    return moments;
}
