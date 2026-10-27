import AsyncStorage from '@react-native-async-storage/async-storage';
import { cardShare } from './dayCard';
import type { FeedPost } from './feedService';

/**
 * Today's pack: your friends' day cards, opened like a pack of trading cards,
 * one card at a time. Only today's: tomorrow brings a new pack and today's is
 * gone, so each day's cards are seen on their day.
 *
 * The order builds like a pack: the quieter days first, the best last, and a
 * perfect day (everything asked of it done) is the rare card at the end.
 */

/** A card is rare when the day asked something and all of it was done. */
export const isPerfect = (post: Pick<FeedPost, 'card'>): boolean =>
    post.card.habitsTotal + post.card.tasksTotal > 0 && cardShare(post.card) >= 1;

export function packFor(posts: FeedPost[], today: string): FeedPost[] {
    const seen = new Set<string>();
    return posts
        .filter(post => !post.mine && post.day === today && !seen.has(post.userId) && seen.add(post.userId))
        .sort((a, b) => cardShare(a.card) - cardShare(b.card) || a.card.streak - b.card.streak || a.name.localeCompare(b.name));
}

const KEY = (day: string) => `habyss_pack_opened:${day}`;

/** How many of today's cards were already turned over. */
export async function openedCount(day: string): Promise<number> {
    try { return Number(await AsyncStorage.getItem(KEY(day))) || 0; } catch { return 0; }
}

export async function markOpened(day: string, count: number): Promise<void> {
    await AsyncStorage.setItem(KEY(day), String(count)).catch(() => undefined);
}
