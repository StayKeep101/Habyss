import type { FeedPost } from './feedService';
import type { Duel } from './duels';
import type { Market } from './market';
import type { CrewPerson, Revealed } from './weekly';
import { questStanding, type CrewMember } from './crewQuest';
import type { DayCardData } from './dayCard';

/**
 * Community's feed as posts of ten kinds, each from data the app already
 * reads (no server change, so the desktop app keeps reading what it reads):
 *
 *   daily      a day card, nothing more to say about it
 *   milestone  a day card whose streak landed on 7, 30, 100, …
 *   best       a day card that broke a personal record (streak or focus)
 *   chronos    a day card with an hour or more of focus
 *   comeback   a day card after three or more empty days
 *   rivalry    a duel you are in, running now
 *   victory    a duel or bet settled in the last week
 *   squad      the crew quest, reached
 *   king       this week's King of the Week
 *   mission    a secret mission, revealed
 *
 * Every post has a stable `key` (what comments will hang on) and an `at`
 * that sorts it into the feed: live contests first, then newest.
 */
export type PostKind = 'daily' | 'milestone' | 'best' | 'chronos' | 'comeback' | 'rivalry' | 'victory' | 'squad' | 'king' | 'mission';

export type StreamPost =
    | { kind: 'daily' | 'milestone' | 'best' | 'chronos' | 'comeback'; key: string; at: string; post: FeedPost }
    | { kind: 'rivalry'; key: string; at: string; duel: Duel }
    | { kind: 'victory'; key: string; at: string; duel: Duel; market?: undefined }
    | { kind: 'victory'; key: string; at: string; market: Market; duel?: undefined }
    | { kind: 'squad'; key: string; at: string; done: number; target: number; crew: CrewMember[] }
    | { kind: 'king'; key: string; at: string; king: CrewPerson }
    | { kind: 'mission'; key: string; at: string; revealed: Revealed };

/** An hour of focus makes a day a Chronos day. */
export const CHRONOS_MINUTES = 60;
/** A settled contest stays in the feed this long. */
const RECENT_DAYS = 7;

/** Which kind of post a day card is: the most remarkable thing about it wins. */
export function dayKind(card: DayCardData): 'daily' | 'milestone' | 'best' | 'chronos' | 'comeback' {
    if (card.comeback) return 'comeback';
    if (card.milestone) return 'milestone';
    if (card.best) return 'best';
    if ((card.focusMinutes ?? 0) >= CHRONOS_MINUTES) return 'chronos';
    return 'daily';
}

const endOf = (day: string) => `${day}T23:59:59`;
const daysBetween = (from: string, to: string) =>
    Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86400000);

export function buildStream(input: {
    posts: FeedPost[];
    duels: Duel[];
    markets: Market[];
    crew: CrewMember[];
    week: { from: string };
    king: CrewPerson | null;
    revealed: Revealed[];
    today: string;
    now: string;
}): StreamPost[] {
    const { today, now, week } = input;
    const stream: StreamPost[] = [];

    for (const post of input.posts) {
        stream.push({ kind: dayKind(post.card), key: `day:${post.userId}:${post.day}`, at: post.postedAt, post });
    }
    for (const duel of input.duels) {
        // Running: live, so it sits at the top while it lasts.
        if (duel.status === 'active') stream.push({ kind: 'rivalry', key: `duel:${duel.id}`, at: now, duel });
        else if (duel.status === 'settled' && duel.ends && daysBetween(duel.ends, today) <= RECENT_DAYS) {
            stream.push({ kind: 'victory', key: `duel:${duel.id}`, at: endOf(duel.ends), duel });
        }
    }
    for (const market of input.markets) {
        if ((market.status === 'won' || market.status === 'missed') && daysBetween(market.deadline, today) <= RECENT_DAYS) {
            stream.push({ kind: 'victory', key: `market:${market.id}`, at: endOf(market.deadline), market });
        }
    }
    const quest = questStanding(input.crew);
    if (quest.reached && quest.crew.length >= 2) {
        stream.push({ kind: 'squad', key: `quest:${week.from}`, at: `${week.from}T00:00:02`, done: quest.done, target: quest.target, crew: quest.crew });
    }
    if (input.king) stream.push({ kind: 'king', key: `king:${week.from}`, at: `${week.from}T00:00:01`, king: input.king });
    input.revealed.filter(item => item.completed).forEach((revealed, index) => {
        stream.push({ kind: 'mission', key: `mission:${week.from}:${index}`, at: `${week.from}T00:00:00`, revealed });
    });

    return stream.sort((a, b) => b.at.localeCompare(a.at));
}
