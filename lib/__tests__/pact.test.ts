import {
    MAX_STAKE, MIN_STAKE, checkStake, daysLeft, isOpen, isOver, lineFor, outcomeOf, settle, type Pact,
} from '../pact';

const side = (over: Partial<Pact['mine']> = {}): Pact['mine'] =>
    ({ userId: 'me', username: 'you', stake: 50, kept: false, ...over });

const pact = (mine: Partial<Pact['mine']>, theirs: Partial<Pact['mine']>, over: Partial<Pact> = {}): Pact => ({
    id: 'p1', itemId: 'h1', itemType: 'habit', itemName: 'Morning run',
    status: 'live', deadline: '2026-09-30', offeredByMe: true, createdAt: '2026-09-29T08:00:00.000Z',
    mine: side({ userId: 'me', username: 'you', ...mine }),
    theirs: side({ userId: 'them', username: 'sam', ...theirs }),
    ...over,
});

describe('who kept it', () => {
    it('reads the record four ways', () => {
        expect(outcomeOf(pact({ kept: true }, { kept: true }))).toBe('both');
        expect(outcomeOf(pact({ kept: true }, { kept: false }))).toBe('mine');
        expect(outcomeOf(pact({ kept: false }, { kept: true }))).toBe('theirs');
        expect(outcomeOf(pact({ kept: false }, { kept: false }))).toBe('neither');
    });
});

describe('settlement', () => {
    it('returns both stakes when both kept it, creating nothing', () => {
        // A pact is a way to risk embers, not a way to farm them.
        const result = settle(pact({ kept: true, stake: 50 }, { kept: true, stake: 30 }));
        expect(result).toEqual({ toMe: 50, toThem: 30, burned: 0 });
    });

    it('pays the whole pot to whoever kept it', () => {
        expect(settle(pact({ kept: true, stake: 50 }, { kept: false, stake: 30 })))
            .toEqual({ toMe: 80, toThem: 0, burned: 0 });
        expect(settle(pact({ kept: false, stake: 50 }, { kept: true, stake: 30 })))
            .toEqual({ toMe: 0, toThem: 80, burned: 0 });
    });

    it('burns both stakes when neither kept it', () => {
        // The rule that matters most: refunding a pact nobody kept makes a
        // mutual quiet week free, and two friends who both want out have every
        // reason to take it. Letting go has to cost even when you both do it.
        expect(settle(pact({ kept: false, stake: 50 }, { kept: false, stake: 30 })))
            .toEqual({ toMe: 0, toThem: 0, burned: 80 });
    });

    it('never creates an ember, whoever wins', () => {
        for (const [mine, theirs] of [[true, true], [true, false], [false, true], [false, false]]) {
            const one = pact({ kept: mine, stake: 40 }, { kept: theirs, stake: 25 });
            const { toMe, toThem, burned } = settle(one);
            expect(toMe + toThem + burned).toBe(65);
        }
    });

    it('does not care who is asking or when', () => {
        const one = pact({ kept: true, stake: 50 }, { kept: false, stake: 30 });
        expect(settle(one)).toEqual(settle(one));
    });
});

describe('where a pact stands', () => {
    const today = '2026-09-29';

    it('says who it is waiting on, before anything else', () => {
        expect(lineFor(pact({ kept: true }, { kept: false }), today)).toBe('Waiting on @sam');
        expect(lineFor(pact({ kept: false }, { kept: true }), today)).toBe('@sam is done. Waiting on you');
        expect(lineFor(pact({ kept: false }, { kept: false }), today)).toBe('Neither of you yet');
        expect(lineFor(pact({ kept: true }, { kept: true }), today)).toBe('Both done — settles tonight');
    });

    it('says what happened once the day is gone', () => {
        const over = { deadline: '2026-09-28' };
        expect(lineFor(pact({ kept: true }, { kept: true }, over), today)).toBe('Both kept it');
        expect(lineFor(pact({ kept: true }, { kept: false }, over), today)).toBe('You kept it, @sam did not');
        expect(lineFor(pact({ kept: false }, { kept: false }, over), today)).toBe('Neither of you kept it');
    });

    it('says when it has not started, or will not', () => {
        expect(lineFor(pact({}, {}, { status: 'offered' }), today)).toBe('Waiting for @sam to accept');
        expect(lineFor(pact({}, {}, { status: 'cancelled' }), today)).toBe('Called off');
    });
});

describe('when a pact is over', () => {
    it('runs to the end of its last day, not a moment less', () => {
        expect(isOver({ deadline: '2026-09-30' }, '2026-09-30')).toBe(false);
        expect(isOver({ deadline: '2026-09-30' }, '2026-10-01')).toBe(true);
    });

    it('is only open while it is live and the day has not gone', () => {
        expect(isOpen({ status: 'live', deadline: '2026-09-30' }, '2026-09-29')).toBe(true);
        expect(isOpen({ status: 'offered', deadline: '2026-09-30' }, '2026-09-29')).toBe(false);
        expect(isOpen({ status: 'live', deadline: '2026-09-28' }, '2026-09-29')).toBe(false);
    });

    it('counts the days left across a month end', () => {
        expect(daysLeft({ deadline: '2026-10-02' }, '2026-09-29')).toBe(3);
        expect(daysLeft({ deadline: '2026-09-29' }, '2026-09-29')).toBe(0);
        expect(daysLeft({ deadline: '2026-09-01' }, '2026-09-29')).toBe(0);
    });
});

describe('what can be staked', () => {
    it('refuses a stake too small to mean anything', () => {
        expect(checkStake(MIN_STAKE - 1, 1000)).toEqual({ ok: false, error: `Stake at least ${MIN_STAKE}.` });
    });

    it('refuses to let one pact take everything', () => {
        expect(checkStake(MAX_STAKE + 1, 100000).ok).toBe(false);
    });

    it('refuses a stake you cannot cover', () => {
        // Staking what you do not have is how a closed economy stops being one.
        expect(checkStake(200, 150)).toEqual({ ok: false, error: 'You do not have that many embers.' });
    });

    it('takes a whole number of embers out of a real balance', () => {
        expect(checkStake(50.7, 100)).toEqual({ ok: true, stake: 50 });
        expect(checkStake(MIN_STAKE, MIN_STAKE)).toEqual({ ok: true, stake: MIN_STAKE });
    });
});
