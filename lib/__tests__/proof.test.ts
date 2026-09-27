import { describeDay, evidenceFor, rankOf, strongest, LOOK, type Evidence } from '../proof';

describe('what kind of claim a completion is', () => {
    it('treats a bare tick as self-logged, which is the honest default', () => {
        expect(evidenceFor({})).toBe('self');
    });

    it('ranks Health above the timer — one says what your body did', () => {
        expect(evidenceFor({ fromHealth: true, timed: true })).toBe('verified');
    });

    it('counts a timed session as backed', () => {
        expect(evidenceFor({ timed: true })).toBe('context');
    });
});

describe('a day made of several claims', () => {
    it('has nothing to boast about when nothing was done', () => {
        expect(strongest([])).toBe('self');
        expect(describeDay([])).toBe('Nothing yet today');
    });

    it('is described by its strongest claim', () => {
        expect(strongest(['self', 'context', 'verified', 'self'])).toBe('verified');
        expect(strongest(['self', 'context'])).toBe('context');
        expect(strongest(['self', 'self'])).toBe('self');
    });

    it('counts rather than crowns, so one verified among nine is not nine', () => {
        const mixed: Evidence[] = ['verified', 'self', 'self', 'self'];
        expect(describeDay(mixed)).toBe('1 of 4 backed');
        expect(describeDay(['verified', 'verified'])).toBe('All 2 backed');
    });

    it('says plainly when a whole day was taken on trust', () => {
        expect(describeDay(['self'])).toBe('Logged');
        expect(describeDay(['self', 'self', 'self'])).toBe('3 logged');
    });

    it('orders the tiers so a feed can sort by them', () => {
        expect(rankOf('verified')).toBeGreaterThan(rankOf('context'));
        expect(rankOf('context')).toBeGreaterThan(rankOf('self'));
    });

    it('words every tier, so none of them renders blank', () => {
        for (const tier of ['verified', 'context', 'self'] as Evidence[]) {
            expect(LOOK[tier].label).toBeTruthy();
            expect(LOOK[tier].detail).toBeTruthy();
        }
    });
});
