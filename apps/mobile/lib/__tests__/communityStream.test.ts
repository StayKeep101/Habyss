import { buildStream, dayKind } from '../communityStream';
import type { FeedPost } from '../feedService';

const card = (extra = {}) => ({ habitsDone: 3, habitsTotal: 4, tasksDone: 1, tasksTotal: 2, streak: 4, ...extra });
const post = (userId: string, postedAt: string, extra = {}): FeedPost => ({
    userId, day: postedAt.slice(0, 10), postedAt, card: card(extra), name: userId, username: userId,
    ackCount: 0, ackedByMe: false, ackUsers: [], myReaction: null, reactions: {}, mine: false,
});

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
    it('turns the feed into day posts, newest first, keyed by whose day it is', () => {
        const stream = buildStream([post('ana', '2026-11-03T08:00:00.000Z'), post('bo', '2026-11-03T18:00:00.000Z', { comeback: 4 })]);
        expect(stream.map(item => item.key)).toEqual(['day:bo:2026-11-03', 'day:ana:2026-11-03']);
        expect(stream.map(item => item.kind)).toEqual(['comeback', 'daily']);
    });
});
