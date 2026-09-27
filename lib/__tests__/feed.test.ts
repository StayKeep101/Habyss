import { buildFeed, lineFor, summarise } from '../feed';
import type { Friend } from '../friendsService';

const friend = (over: Partial<Friend> = {}): Friend => ({
    id: over.username ?? 'f', userId: over.username ?? 'f', username: 'sam', ...over,
} as Friend);

describe('the day, as friends finished it', () => {
    it('puts finished days first, then the fullest ones', () => {
        const cards = buildFeed([
            friend({ username: 'half', todayCompleted: 1, todayTotal: 2 }),
            friend({ username: 'done', todayCompleted: 3, todayTotal: 3 }),
            friend({ username: 'none', todayCompleted: 0, todayTotal: 4 }),
        ]);
        expect(cards.map(card => card.username)).toEqual(['done', 'half', 'none']);
    });

    it('breaks a tie by streak, then by name, so the order never flickers', () => {
        const cards = buildFeed([
            friend({ username: 'bea', todayCompleted: 2, todayTotal: 2, currentStreak: 3 }),
            friend({ username: 'ali', todayCompleted: 2, todayTotal: 2, currentStreak: 9 }),
            friend({ username: 'cai', todayCompleted: 2, todayTotal: 2, currentStreak: 3 }),
        ]);
        expect(cards.map(card => card.username)).toEqual(['ali', 'bea', 'cai']);
    });

    it('never produces NaN for a day that asked for nothing', () => {
        const [card] = buildFeed([friend({ todayCompleted: 0, todayTotal: 0 })]);
        expect(card.share).toBe(0);
        expect(Number.isNaN(card.share)).toBe(false);
        expect(card.complete).toBe(false);
    });

    it('does not let a bad number from the server break the card', () => {
        const [card] = buildFeed([friend({ todayCompleted: -3, todayTotal: 2.7 })]);
        expect(card.done).toBe(0);
        expect(card.total).toBe(2);
        expect(card.share).toBeGreaterThanOrEqual(0);
    });

    it('caps a share at one when someone overshoots', () => {
        const [card] = buildFeed([friend({ todayCompleted: 9, todayTotal: 3 })]);
        expect(card.share).toBe(1);
        expect(card.complete).toBe(true);
    });

    it('takes every completion on trust until the server carries more', () => {
        const [card] = buildFeed([friend({ todayCompleted: 1, todayTotal: 1 })]);
        expect(card.evidence).toBe('self');
    });

    it('uses the evidence it is given', () => {
        const cards = buildFeed([friend({ username: 'sam', userId: 'u1', todayCompleted: 1, todayTotal: 1 })],
            { u1: ['self', 'verified'] });
        expect(cards[0].evidence).toBe('verified');
    });
});

describe('what a card says', () => {
    const card = (over = {}) => ({ done: 0, total: 3, streak: 0, complete: false, isYou: false, ...over });

    it('never scolds a rest day', () => {
        expect(lineFor(card({ total: 0 }))).toBe('Nothing due today');
    });

    it('reads differently for you than for them', () => {
        expect(lineFor(card({ isYou: true }))).toBe('3 still to do');
        expect(lineFor(card())).toBe('Not started yet');
    });

    it('mentions a run only once there is one worth mentioning', () => {
        expect(lineFor(card({ done: 3, complete: true, streak: 1 }))).toBe('Day done');
        expect(lineFor(card({ done: 3, complete: true, streak: 6 }))).toBe('Day done · 6 in a row');
    });
});

describe('the line above the feed', () => {
    const you = friend({ username: 'me', userId: 'me', isCurrentUser: true });

    it('asks for a friend when there are none', () => {
        expect(summarise(buildFeed([you]))).toBe('Add a friend to see their day here');
    });

    it('is about the group, never a winner', () => {
        const cards = buildFeed([you,
            friend({ username: 'a', userId: 'a', todayCompleted: 2, todayTotal: 2 }),
            friend({ username: 'b', userId: 'b', todayCompleted: 1, todayTotal: 3 }),
        ]);
        expect(summarise(cards)).toBe('1 finished, 1 under way');
    });

    it('says so plainly when nobody has begun', () => {
        const cards = buildFeed([you, friend({ username: 'a', userId: 'a', todayCompleted: 0, todayTotal: 3 })]);
        expect(summarise(cards)).toBe('Nobody has started yet');
    });
});
