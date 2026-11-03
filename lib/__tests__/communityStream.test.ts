import { buildStream, dayKind } from '../communityStream';
import type { FeedPost } from '../feedService';
import type { Duel } from '../duels';

const card = (extra = {}) => ({ habitsDone: 3, habitsTotal: 4, tasksDone: 1, tasksTotal: 2, streak: 4, ...extra });
const post = (userId: string, postedAt: string, extra = {}): FeedPost => ({
    userId, day: postedAt.slice(0, 10), postedAt, card: card(extra), name: userId, username: userId,
    ackCount: 0, ackedByMe: false, ackUsers: [], myReaction: null, reactions: {}, mine: false,
});
const duel = (id: string, status: Duel['status'], ends: string): Duel => ({
    id, mine: true, friendId: 'sam', name: 'Sam', stake: 25, days: 7, starts: '2026-10-27', ends, status, winnerId: null,
    me: { done: 5, total: 8, days: 4 }, them: { done: 3, total: 8, days: 3 },
});
const empty = { duels: [], markets: [], crew: [], week: { from: '2026-11-02' }, king: null, revealed: [], today: '2026-11-03', now: '2026-11-03T20:00:00.000Z' };

describe('dayKind', () => {
    it('picks the most remarkable thing about a day', () => {
        expect(dayKind(card())).toBe('daily');
        expect(dayKind(card({ focusMinutes: 90 }))).toBe('chronos');
        expect(dayKind(card({ focusMinutes: 90, best: { kind: 'focus', minutes: 90 } }))).toBe('best');
        expect(dayKind(card({ best: { kind: 'streak', days: 8 }, milestone: 7 }))).toBe('milestone');
        expect(dayKind(card({ milestone: 7, comeback: 5 }))).toBe('comeback');
    });
});

describe('buildStream', () => {
    it('puts a running duel on top and a fresh result in the feed, but not an old one', () => {
        const stream = buildStream({
            ...empty,
            posts: [post('ana', '2026-11-03T18:00:00.000Z')],
            duels: [duel('live', 'active', '2026-11-05'), duel('won', 'settled', '2026-11-01'), duel('old', 'settled', '2026-10-01')],
        });
        expect(stream.map(item => item.kind)).toEqual(['rivalry', 'daily', 'victory']);
        expect(stream.map(item => item.key)).toEqual(['duel:live', 'day:ana:2026-11-03', 'duel:won']);
    });

    it('announces the king, a reached crew quest and revealed missions for the week', () => {
        const stream = buildStream({
            ...empty, posts: [],
            king: { userId: 'bea', name: 'Bea', days: 6, showUps: 20 },
            crew: [
                { userId: 'a', name: 'A', showUps: 15, active: true, mine: true },
                { userId: 'b', name: 'B', showUps: 15, active: true, mine: false },
            ],
            revealed: [
                { ownerName: 'Cal', friendName: 'You', kind: 'show_up', completed: true, mine: false },
                { ownerName: 'Dee', friendName: 'You', kind: 'show_up', completed: false, mine: false },
            ],
        });
        expect(stream.map(item => item.kind)).toEqual(['squad', 'king', 'mission']);
    });
});
