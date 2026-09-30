import { buildFeed, lineFor, pulseOrder, summarise } from '../feed';
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

describe('a friend’s evidence, as the server sends it', () => {
    it('carries what friend_stats reported', () => {
        const [card] = buildFeed([friend({ todayCompleted: 2, todayTotal: 2, todayEvidence: ['verified', 'self'] })]);
        expect(card.evidenceAll).toEqual(['verified', 'self']);
        expect(card.evidence).toBe('verified');
    });

    it('reads an unstamped completion as self rather than as absent', () => {
        // A friend on a build that never stamped evidence sends nothing, and the
        // badge still has to agree with "3 of 3 done".
        const [card] = buildFeed([friend({ todayCompleted: 3, todayTotal: 3 })]);
        expect(card.evidenceAll).toEqual(['self', 'self', 'self']);
    });

    it('never claims more evidence than there were completions', () => {
        const [card] = buildFeed([friend({ todayCompleted: 1, todayTotal: 4, todayEvidence: ['verified', 'verified', 'context'] })]);
        expect(card.evidenceAll).toEqual(['verified']);
    });

    it('ignores a value the app does not know', () => {
        const [card] = buildFeed([friend({ todayCompleted: 1, todayTotal: 1, todayEvidence: ['vouched'] })]);
        expect(card.evidenceAll).toEqual(['self']);
    });

    it('prefers what the caller worked out, which is only ever your own', () => {
        const [card] = buildFeed(
            [friend({ isCurrentUser: true, todayCompleted: 1, todayTotal: 1, todayEvidence: ['self'] })],
            { f: ['context'] },
        );
        expect(card.evidenceAll).toEqual(['context']);
    });
});

describe('the whole day, not a third of it', () => {
    it('counts habits and tasks together in the ring', () => {
        const [card] = buildFeed([friend({
            todayCompleted: 2, todayTotal: 4, tasksDone: 1, tasksTotal: 2,
        })]);
        expect(card.done).toBe(3);
        expect(card.total).toBe(6);
        expect(card.share).toBeCloseTo(0.5);
        expect(card.line).toBe('3 of 6 done');
    });

    it('is not finished while a task is still open', () => {
        const [card] = buildFeed([friend({
            todayCompleted: 4, todayTotal: 4, tasksDone: 0, tasksTotal: 1,
        })]);
        expect(card.complete).toBe(false);
    });

    it('keeps the three strands apart so the card can name them', () => {
        const [card] = buildFeed([friend({
            todayCompleted: 2, todayTotal: 4,
            tasksDone: 1, tasksTotal: 2,
            goalsMoved: 1, goalsActive: 3,
        })]);
        expect(card.strands.habits).toEqual({ done: 2, total: 4 });
        expect(card.strands.tasks).toEqual({ done: 1, total: 2 });
        expect(card.strands.goals).toEqual({ moved: 1, active: 3 });
    });

    it('leaves a strand out rather than at zero when nobody reported it', () => {
        // An older server, and a friend who has turned progress off, both send
        // nothing — and "no answer" must not render as "did none of it".
        const [card] = buildFeed([friend({ todayCompleted: 1, todayTotal: 2 })]);
        expect(card.strands.tasks).toBeUndefined();
        expect(card.strands.goals).toBeUndefined();
        expect(card.total).toBe(2);
    });

    it('reports a real zero as a zero', () => {
        const [card] = buildFeed([friend({
            todayCompleted: 1, todayTotal: 2, tasksDone: 0, tasksTotal: 0, goalsActive: 0,
        })]);
        expect(card.strands.tasks).toEqual({ done: 0, total: 0 });
        expect(card.strands.goals).toEqual({ moved: 0, active: 0 });
    });

    it('does not stamp evidence on a ticked task', () => {
        // Evidence is a claim about a check-in. Padding to the whole day would
        // invent 'self' marks for rows nothing was ever claimed about.
        const [card] = buildFeed([friend({
            todayCompleted: 1, todayTotal: 1, todayEvidence: ['verified'],
            tasksDone: 3, tasksTotal: 3,
        })]);
        expect(card.evidenceAll).toEqual(['verified']);
        expect(card.evidence).toBe('verified');
    });
});

describe('the rail, in the order it should read', () => {
    const cards = () => buildFeed([
        friend({ username: 'me', todayCompleted: 4, todayTotal: 4, isCurrentUser: true }),
        friend({ username: 'ace', todayCompleted: 3, todayTotal: 3 }),
        friend({ username: 'stuck', todayCompleted: 0, todayTotal: 5 }),
    ]);

    it('leads with whoever is waiting on you, not with whoever is doing best', () => {
        const order = pulseOrder(cards(), { stuck: [{ mineDone: false }] });
        expect(order.map(person => person.card.username)).toEqual(['stuck', 'ace', 'me']);
    });

    it('puts you last, because a rail of faces is a list of other people', () => {
        const order = pulseOrder(cards());
        expect(order[order.length - 1].card.isYou).toBe(true);
    });

    it('falls back to the fullest day, then the name, so it never flickers', () => {
        const order = pulseOrder(cards());
        expect(order.map(person => person.card.username)).toEqual(['ace', 'stuck', 'me']);
    });

    it('is about your own half only', () => {
        // They have not done theirs. That is their business, and there is
        // nothing you can do about it from here.
        const order = pulseOrder(cards(), { stuck: [{ mineDone: true }] });
        expect(order.find(person => person.card.username === 'stuck')?.waitingOnYou).toBe(false);
    });

    it('never says your own day is waiting on you', () => {
        const order = pulseOrder(cards(), { me: [{ mineDone: false }] });
        expect(order.find(person => person.card.isYou)?.waitingOnYou).toBe(false);
    });
});
