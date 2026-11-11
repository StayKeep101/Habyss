import type { DayWindow } from './echo';

/**
 * Your sleep, from Day & calendar (wake and bedtime): nothing reaches you
 * inside it. There is no separate "quiet hours" setting; the day you set is it.
 *
 * Bedtime itself still rings (it is the wind-down, the last thing of the day);
 * anything after it, until you wake, does not. Pure, so it is tested without a phone.
 */
const minutesOf = (time: string) => { const [hours, minutes] = time.split(':').map(Number); return hours * 60 + minutes; };

export function isAsleep(date: Date, day: DayWindow): boolean {
    const at = date.getHours() * 60 + date.getMinutes();
    const sleep = minutesOf(day.sleep);
    const wake = minutesOf(day.wake);
    if (sleep === wake) return false;
    // Bedtime before midnight (23:00 → 07:00) wraps; after it (01:00 → 09:00) does not.
    return sleep > wake ? at > sleep || at < wake : at > sleep && at < wake;
}

/** When something that can wait should arrive: as asked, or at the next wake-up when that falls in your sleep. */
export function whenAwake(date: Date, day: DayWindow): Date {
    if (!isAsleep(date, day)) return date;
    const wake = minutesOf(day.wake);
    const next = new Date(date);
    next.setHours(Math.floor(wake / 60), wake % 60, 0, 0);
    if (next <= date) next.setDate(next.getDate() + 1);
    return next;
}
