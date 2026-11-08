import type { FeedPost } from './feedService';
import type { DayCardData } from './dayCard';

/**
 * Community's Today feed: accountability cards only, one per friend's day,
 * each told as the kind that makes it remarkable:
 *
 *   daily      a day card, nothing more to say about it
 *   milestone  a day card whose streak landed on 7, 30, 100, …
 *   best       a day card that broke a personal record (streak or focus)
 *   chronos    a day card with an hour or more of focus
 *   comeback   a day card after three or more empty days
 *
 * The games (duels, bets) have their own place under Challenges, not in
 * this feed.
 * The facts come from the poster's phone (lib/dayMoments.ts), so the server
 * and the desktop app read community_feed exactly as before.
 */
export type PostKind = 'daily' | 'milestone' | 'best' | 'chronos' | 'comeback';

export interface StreamPost { kind: PostKind; key: string; at: string; post: FeedPost }

/** An hour of focus makes a day a Chronos day. */
export const CHRONOS_MINUTES = 60;

/** Which kind of post a day card is: the most remarkable thing about it wins. */
export function dayKind(card: DayCardData): PostKind {
    if (card.comeback) return 'comeback';
    if (card.milestone) return 'milestone';
    if (card.best) return 'best';
    if ((card.focusMinutes ?? 0) >= CHRONOS_MINUTES) return 'chronos';
    return 'daily';
}

/** The feed's day cards as posts, newest first, each keyed by whose day it is. */
export function buildStream(posts: FeedPost[]): StreamPost[] {
    return posts
        .map(post => ({ kind: dayKind(post.card), key: `day:${post.userId}:${post.day}`, at: post.postedAt, post }))
        .sort((a, b) => b.at.localeCompare(a.at));
}
