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
    /** What to call them: their chosen name, or their handle if they have none. */
    username: string;
    avatarUrl?: string;
    /** Everything finished today, and everything the day asked of them. */
    done: number;
    total: number;
    /**
     * The same day, told in the three strands it is actually made of.
     *
     * `done`/`total` above is their sum, because a card about somebody's day
     * should not silently mean a third of it. Tasks and goals are **absent**
     * rather than zeroed when the server predates these columns or when that
     * person has turned progress off — a card can then say nothing about them,
     * which is a very different thing to show a friend than "0 of 0".
     */
    strands: {
        habits: { done: number; total: number };
        tasks?: { done: number; total: number };
        /** Goals are counted as moved today, not as a percentage — see below. */
        goals?: { moved: number; active: number };
    };
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

/** A whole, non-negative count out of whatever the server actually sent. */
const count = (value: number | undefined): number => Math.max(0, Math.floor(value ?? 0));

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
    if (card.total === 0) return 'Nothing due today';
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
        const habits = {
            done: count(friend.todayCompleted),
            total: count(friend.todayTotal),
        };
        // Undefined and zero are different answers. An older server and a
        // friend who shares nothing both send nothing, and a strand nobody
        // reported is left off the card rather than drawn empty.
        const tasks = friend.tasksTotal === undefined && friend.tasksDone === undefined
            ? undefined
            : { done: count(friend.tasksDone), total: count(friend.tasksTotal) };
        const goals = friend.goalsActive === undefined
            ? undefined
            : { moved: count(friend.goalsMoved), active: count(friend.goalsActive) };

        // The ring is the whole day: habits and tasks are both things somebody
        // said they would do today, and a ring that counts only half of them
        // reads as a bad day to anybody who spent theirs on tasks. Goals are
        // not a fraction of a day — nobody finishes a goal by Tuesday — so they
        // are reported as movement instead and stay out of the ring.
        const done = habits.done + (tasks?.done ?? 0);
        const total = habits.total + (tasks?.total ?? 0);
        const complete = total > 0 && done >= total;
        const isYou = !!friend.isCurrentUser;
        const base = {
            done, total, complete, isYou,
            streak: Math.max(0, Math.floor(friend.currentStreak ?? friend.streak ?? 0)),
        };
        // What the caller worked out beats what the server sent: the app knows
        // its own timer sessions exactly, and only ever passes its own.
        //
        // Counted against habits alone. Evidence is a claim about a check-in —
        // a timer that ran, a place arrived at — and there is no such claim on
        // a ticked task, so padding to the whole day would invent 'self' marks
        // for rows that were never evidenced either way.
        const claims = evidenceByFriend[friend.userId] ?? asEvidence(friend.todayEvidence, habits.done);
        return {
            id: friend.id || friend.userId,
            username: friend.displayName || friend.username,
            avatarUrl: friend.avatarUrl,
            ...base,
            strands: { habits, tasks, goals },
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
