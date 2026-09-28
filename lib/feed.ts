import type { Friend } from './friendsService';
import { strongest, type Evidence } from './proof';

/**
 * The day, as your friends finished it.
 *
 * One card per person, not a ranked table. A leaderboard answers "who is
 * winning", which is the wrong question for habits: it rewards whoever tracks
 * the least demanding things, and it makes a bad week public. A feed answers
 * "what did everyone do today", which is the thing you would actually ask.
 *
 * Everything here is derived. The server already sends each friend's day and
 * streak; nothing new has to be stored for the feed to exist.
 */

export interface DayCard {
    id: string;
    username: string;
    avatarUrl?: string;
    /** Completions today, and what the day asked of them. */
    done: number;
    total: number;
    /** 0–1. Zero when the day asked for nothing, never NaN. */
    share: number;
    streak: number;
    /** True once the day is fully kept. */
    complete: boolean;
    /** The strongest claim on their day. */
    evidence: Evidence;
    /** Every claim on it, so a card can count rather than crown. */
    evidenceAll: Evidence[];
    /** A short, true line for the card. */
    line: string;
    isYou: boolean;
}

/**
 * The day's claims, one per completion counted.
 *
 * The server sends text, and only three values mean anything. It is also padded
 * or trimmed to `done`, because the count on the card and the count in the badge
 * have to be the same number: a friend on a build that never stamped evidence
 * sends nothing, and a completion nobody can say anything about is self-logged,
 * not absent.
 */
const asEvidence = (all: string[] | undefined, done: number): Evidence[] => {
    const known = (all ?? []).slice(0, done)
        .map<Evidence>(one => (one === 'verified' || one === 'context' ? one : 'self'));
    while (known.length < done) known.push('self');
    return known;
};

/** Zero rather than NaN, which is what `0/0` gives and what renders as "NaN%". */
const shareOf = (done: number, total: number): number =>
    total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;

/**
 * What the card says under the name.
 *
 * Written so that a day with nothing on it is never a reproach — plenty of
 * days legitimately ask for nothing, and a feed that scolds people for resting
 * is a feed they leave.
 */
export function lineFor(card: Pick<DayCard, 'done' | 'total' | 'streak' | 'complete' | 'isYou'>): string {
    const who = card.isYou ? 'You have' : 'Nothing';
    if (card.total === 0) return card.isYou ? 'Nothing due today' : 'Nothing due today';
    if (card.done === 0) return card.isYou ? `${card.total} still to do` : 'Not started yet';
    if (card.complete) {
        return card.streak > 1 ? `Day done · ${card.streak} in a row` : 'Day done';
    }
    return `${card.done} of ${card.total} done`;
}

/**
 * Builds the feed.
 *
 * Sorted by what people did rather than by who they are: finished days first,
 * then by how much of the day is kept, then the longest run, then the name so
 * the order never flickers between two identical days.
 */
export function buildFeed(friends: Friend[], evidenceByFriend: Record<string, Evidence[]> = {}): DayCard[] {
    const cards = friends.map<DayCard>(friend => {
        const done = Math.max(0, Math.floor(friend.todayCompleted ?? 0));
        const total = Math.max(0, Math.floor(friend.todayTotal ?? 0));
        const complete = total > 0 && done >= total;
        const isYou = !!friend.isCurrentUser;
        const base = {
            done, total, complete, isYou,
            streak: Math.max(0, Math.floor(friend.currentStreak ?? friend.streak ?? 0)),
        };
        // What the caller worked out beats what the server sent: the app knows
        // its own timer sessions exactly, and only ever passes its own.
        const claims = evidenceByFriend[friend.userId] ?? asEvidence(friend.todayEvidence, done);
        return {
            id: friend.id || friend.userId,
            username: friend.username,
            avatarUrl: friend.avatarUrl,
            ...base,
            share: shareOf(done, total),
            evidenceAll: claims,
            evidence: strongest(claims),
            line: lineFor(base),
        };
    });

    return cards.sort((a, b) =>
        Number(b.complete) - Number(a.complete)
        || b.share - a.share
        || b.streak - a.streak
        || a.username.localeCompare(b.username));
}

/** One line for the top of the feed, about the group rather than a winner. */
export function summarise(cards: DayCard[]): string {
    const others = cards.filter(card => !card.isYou);
    if (others.length === 0) return 'Add a friend to see their day here';
    const finished = others.filter(card => card.complete).length;
    const moving = others.filter(card => !card.complete && card.done > 0).length;
    if (finished === 0 && moving === 0) return 'Nobody has started yet';
    if (finished === others.length) return others.length === 1 ? 'They finished today' : 'Everyone finished today';
    if (finished === 0) return `${moving} of ${others.length} under way`;
    return `${finished} finished, ${moving} under way`;
}
