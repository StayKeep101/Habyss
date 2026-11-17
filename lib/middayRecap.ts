import type { DayWindow } from './echo';

/**
 * Halfway through your day: one notification at the exact middle of your waking
 * hours (Day & calendar: wake up to bedtime), saying how the day has gone so
 * far, so there is still half a day to act on it. Planned with the other
 * notifications (lib/notificationService.ts), which run again on every tick,
 * so its words are always what the day holds when it arrives.
 */

const minutesOf = (time: string) => { const [hours, minutes] = time.split(':').map(Number); return hours * 60 + minutes; };

/**
 * The middle of the waking day that holds `now`, or the next one: 07:00 to
 * 23:00 is 15:00. A bedtime past midnight (09:00 to 01:00) counts as the same
 * day, and a day that began yesterday (a night shift) is still today's.
 */
export function halfwayPoint(day: DayWindow, now: Date = new Date()): Date | null {
    const wake = minutesOf(day.wake);
    let sleep = minutesOf(day.sleep);
    if (sleep <= wake) sleep += 24 * 60;
    if (sleep - wake < 60) return null;
    const middle = Math.round((wake + sleep) / 2);
    for (const offset of [-1, 0, 1]) {
        const at = new Date(now);
        at.setHours(0, 0, 0, 0);
        at.setDate(at.getDate() + offset);
        at.setMinutes(middle);
        if (at.getTime() > now.getTime()) return at;
    }
    return null;
}

export interface DaySoFar {
    habitsDone: number;
    habitsDue: number;
    tasksDone: number;
    tasksDue: number;
    /** Seconds focused today. */
    focused: number;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
const duration = (seconds: number) => {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    return minutes % 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes / 60}h`;
};

/** "Halfway through your day" and a short recap: what is done, then one plain line on what it means. */
export function middayRecap(day: DaySoFar, name?: string | null): { title: string; body: string } {
    const title = name ? `Halfway through your day, ${name}` : 'Halfway through your day';
    const parts: string[] = [];
    if (day.habitsDue) parts.push(`${day.habitsDone} of ${plural(day.habitsDue, 'habit')}`);
    if (day.tasksDue) parts.push(`${day.tasksDone} of ${plural(day.tasksDue, 'task')}`);
    if (day.focused >= 60) parts.push(`${duration(day.focused)} focused`);
    const recap = parts.length ? `${parts.join(' · ')}. ` : '';

    const due = day.habitsDue + day.tasksDue;
    const done = day.habitsDone + day.tasksDone;
    const left = due - done;
    let verdict: string;
    if (!due) verdict = day.focused >= 60 ? 'Nothing on your list. Plan the afternoon?' : 'Nothing planned yet. Plan the afternoon?';
    else if (!left) verdict = 'All done already. The afternoon is yours.';
    else if (done / due >= 0.5) verdict = `Ahead of the clock. ${left} left.`;
    else if (done) verdict = `${left} left, and half the day to do them.`;
    else verdict = 'Nothing ticked yet. Start with the smallest one.';
    return { title, body: recap + verdict };
}
