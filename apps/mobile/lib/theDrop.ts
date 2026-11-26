/**
 * The drop: every evening at your sharing time your day card goes up, and
 * with it your friends' cards from today open for you, flipping over one by
 * one. Until then a friend's card from today stays sealed (who posted shows;
 * what they did does not). Cards from earlier days are always open, and with
 * daily posts off nothing is ever sealed: there is no drop to wait for.
 */

/** "21:00" as minutes from midnight; null when it will not parse. */
export function minuteOf(time: string | null): number | null {
    if (!time) return null;
    const [hour, minute] = time.split(':').map(Number);
    return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : null;
}

/** Whether your day has dropped yet today. */
export function hasDropped(shareTime: string | null, nowMinutes: number): boolean {
    const at = minuteOf(shareTime);
    return at === null || nowMinutes >= at;
}

/** A friend's card from today, before your drop. */
export function isSealed(post: { mine: boolean; day: string }, today: string, shareTime: string | null, nowMinutes: number): boolean {
    return !post.mine && post.day === today && !hasDropped(shareTime, nowMinutes);
}
