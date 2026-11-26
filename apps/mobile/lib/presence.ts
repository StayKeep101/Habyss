/**
 * What a friend is doing right now, from the facts their phone writes.
 *
 *   Locked in   a focus session is running (until it ends)
 *   Live        the app is open on their phone (refreshed every few minutes)
 *   Asleep      it is inside their own sleep window, in their own time zone
 *   Away        none of the above
 *
 * Decided here, against the clock, so nothing on the server has to run to
 * move somebody to asleep at their bedtime.
 */

export type FriendStatus = 'focus' | 'live' | 'asleep' | 'away';

export interface PresenceFacts {
    presence: 'live' | 'away';
    presenceAt: string | null;
    focusUntil: string | null;
    focusLabel: string | null;
    timezone: string | null;
    wakeTime: string | null;
    sleepTime: string | null;
}

/** A "live" mark older than this is a phone that closed the app without saying. */
export const LIVE_FOR_MS = 6 * 60 * 1000;
/** How often an open app refreshes its "live" mark. */
export const HEARTBEAT_MS = 4 * 60 * 1000;

const minutesOf = (time: string): number => {
    const [hour, minute] = time.split(':').map(Number);
    return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
};

/** Minutes past midnight in a time zone; the phone's own when none is known. */
export function minutesIn(timezone: string | null, now: Date): number {
    if (timezone) {
        try {
            const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
                .formatToParts(now);
            const hour = Number(parts.find(part => part.type === 'hour')?.value);
            const minute = Number(parts.find(part => part.type === 'minute')?.value);
            if (Number.isFinite(hour) && Number.isFinite(minute)) return hour * 60 + minute;
        } catch { /* unknown zone: fall through */ }
    }
    return now.getHours() * 60 + now.getMinutes();
}

/** Inside sleep..wake, across midnight when bedtime is after it. */
export function isAsleep(sleepTime: string | null, wakeTime: string | null, minutes: number): boolean {
    if (!sleepTime || !wakeTime) return false;
    const sleep = minutesOf(sleepTime);
    const wake = minutesOf(wakeTime);
    if (sleep === wake) return false;
    return sleep < wake ? minutes >= sleep && minutes < wake : minutes >= sleep || minutes < wake;
}

export function statusOf(facts: PresenceFacts, now = new Date()): FriendStatus {
    if (facts.focusUntil && new Date(facts.focusUntil).getTime() > now.getTime()) return 'focus';
    if (facts.presence === 'live' && facts.presenceAt && now.getTime() - new Date(facts.presenceAt).getTime() < LIVE_FOR_MS) return 'live';
    if (isAsleep(facts.sleepTime, facts.wakeTime, minutesIn(facts.timezone, now))) return 'asleep';
    return 'away';
}

export const STATUS_LABEL: Record<FriendStatus, string> = {
    focus: 'Locked in',
    live: 'Live',
    asleep: 'Asleep',
    away: 'Away',
};
