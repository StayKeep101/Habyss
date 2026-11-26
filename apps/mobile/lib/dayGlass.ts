import type { DayWindow } from './echo';

/**
 * Your day as an hourglass (components/Home/DayHourglass.tsx).
 *
 * The glass holds your waking day, from wake-up to bedtime (Day & calendar):
 * full when you wake, empty at bedtime, the sand falling with the clock and
 * nothing else. Beside it, the time gone and the time left. The next morning
 * it turns over: the first time you open Habyss after waking, before noon,
 * once a day. Open it later and the day has already begun without the
 * ceremony. Pure, so it is tested without a phone.
 */

const DAY = 24 * 60 * 60;

/** "07:30" as seconds from midnight. */
const secondsOf = (time: string): number => {
    const [hour, minute] = time.split(':').map(Number);
    return ((Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0)) * 60;
};

export interface GlassState {
    /** How much of the waking day has run out, 0 (just woke) to 1 (bedtime). */
    ran: number;
    /** Seconds since waking (the whole day at night). */
    past: number;
    /** Seconds until bedtime (0 at night). */
    left: number;
    /** Outside the waking day: the night, from bedtime to waking. The sand has run out; the glass waits for the morning flip. */
    resting: 'night' | null;
}

/** Seconds from midnight for a moment, local time. */
export const clockSeconds = (at: Date): number => at.getHours() * 3600 + at.getMinutes() * 60 + at.getSeconds();

/**
 * The glass at a moment. A bedtime past midnight (01:00) belongs to the day
 * it ends: at 00:30 the day is still running. A bedtime at or before wake-up
 * is read the same way.
 */
export function glassAt(at: Date, day: DayWindow): GlassState {
    const wake = secondsOf(day.wake);
    let sleep = secondsOf(day.sleep);
    if (sleep <= wake) sleep += DAY;
    const length = sleep - wake;
    let now = clockSeconds(at);
    // Small hours before a late bedtime are the end of yesterday's waking day.
    if (now < wake && now + DAY < sleep) now += DAY;
    // The night (after bedtime, or the small hours before waking): run out, waiting to turn over.
    if (now < wake || now >= sleep) return { ran: 1, past: length, left: 0, resting: 'night' };
    const past = now - wake;
    return { ran: past / length, past, left: sleep - now, resting: null };
}

/** "9:27:08", or "27:08" under an hour: the clocks beside the glass. */
export function clockLabel(seconds: number): string {
    const total = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const two = (value: number) => String(value).padStart(2, '0');
    return hours ? `${hours}:${two(minutes)}:${two(secs)}` : `${minutes}:${two(secs)}`;
}

/** Noon: open Habyss after this and the morning's flip is gone for the day. */
const FLIP_UNTIL = 12 * 3600;

/**
 * Whether the glass turns over now: the first open of the day, after waking
 * and before noon, and not already turned today. Pure.
 */
export function flipDue(at: Date, day: DayWindow, today: string, lastFlip: string | null): boolean {
    if (lastFlip === today) return false;
    const now = clockSeconds(at);
    return now >= secondsOf(day.wake) && now < FLIP_UNTIL;
}
