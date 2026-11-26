import type { DayCardData } from './dayCard';

/**
 * Today's day card as the phone last built it (hooks/useDayCardPublisher.ts),
 * before the server posts it at your sharing time. Kept so the Developer page
 * can show it on command; nothing reads it to post.
 */
let latest: { day: string; card: DayCardData } | null = null;
const listeners = new Set<() => void>();

export function rememberDayCard(day: string, card: DayCardData) {
    latest = { day, card };
    listeners.forEach(listener => listener());
}

export const latestDayCard = () => latest;

export function subscribeDayCard(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
