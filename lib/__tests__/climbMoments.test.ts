import { echoLineFor, nextMoment } from '../climbMoments';

describe('the climb, as moments', () => {
    it('starts quietly from wherever someone already is', () => {
        expect(nextMoment(null, 500, true)).toEqual({ moment: null, state: { rank: 2, foothold: true } });
    });

    it('marks the first foothold once', () => {
        const first = nextMoment({ rank: 0, foothold: false }, 3, true);
        expect(first.moment).toEqual({ kind: 'foothold' });
        expect(nextMoment(first.state, 3, true).moment).toBeNull();
    });

    it('marks each new rank, and climbing back after a fall', () => {
        const up = nextMoment({ rank: 0, foothold: true }, 160, true);
        expect(up.moment).toEqual({ kind: 'rankUp', rank: 'Beginner', index: 1 });
        const fell = nextMoment(up.state, 100, true);
        expect(fell.moment).toBeNull();
        expect(nextMoment(fell.state, 151, true).moment).toEqual({ kind: 'rankUp', rank: 'Beginner', index: 1 });
    });

    it('gives Echo a line for each', () => {
        expect(echoLineFor({ kind: 'rankUp', rank: 'Beginner', index: 1 })).toBe('That’s a start.');
        expect(echoLineFor({ kind: 'foothold' })).toContain('Today');
    });
});
