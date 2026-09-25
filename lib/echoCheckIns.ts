import type { DayWindow } from './echo';
import type { EchoConfig } from './echo';
import { eveningCheckIn, morningCheckIn } from './echo';
import { localDateKey } from './habitSchedule';

export interface CheckIn {
    kind: 'morning' | 'evening';
    date: Date;
    /** Stable per day and kind, so rescheduling replaces rather than repeats. */
    id: string;
}

/**
 * When Echo checks in.
 *
 * Only what the user asked for, only in the next couple of days, and never in
 * the past. Two a day at most: one when the day starts and one before it ends.
 * Scheduling further ahead would mean writing lines about a day nobody has
 * lived yet, and the app reschedules every time it opens anyway.
 */
export function buildCheckInPlan(
    // Only the two switches matter here; the rest of the config is Echo's voice.
    config: Pick<EchoConfig, 'morning' | 'evening'>,
    day: DayWindow,
    now = new Date(),
    days = 2,
): CheckIn[] {
    const plan: CheckIn[] = [];
    if (!config.morning && !config.evening) return plan;

    for (let offset = 0; offset < days; offset++) {
        const date = new Date(now);
        date.setDate(date.getDate() + offset);
        const key = localDateKey(date);

        const at = (time: string, kind: 'morning' | 'evening') => {
            const [hour, minute] = time.split(':').map(Number);
            const when = new Date(date);
            when.setHours(hour, minute, 0, 0);
            if (when.getTime() <= now.getTime()) return;
            plan.push({ kind, date: when, id: `echo:${kind}:${key}` });
        };

        if (config.morning) at(morningCheckIn(day), 'morning');
        if (config.evening) at(eveningCheckIn(day), 'evening');
    }

    return plan.sort((a, b) => a.date.getTime() - b.date.getTime());
}
