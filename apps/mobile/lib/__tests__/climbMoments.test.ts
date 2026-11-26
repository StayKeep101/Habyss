import { echoLineFor, nextMoment } from '../climbMoments';

describe('the climb, as moments', () => {
    it('starts quietly from wherever someone already is', () => {
        expect(nextMoment(null, 500, true)).toEqual({ moment: null, state: { rank: 2, foothold: true, v: 2 } });
    });

    it('marks the first foothold once', () => {
        const first = nextMoment({ rank: 0, foothold: false }, 3, true);
        expect(first.moment).toEqual({ kind: 'foothold' });
        expect(nextMoment(first.state, 3, true).moment).toBeNull();
    });

    it('marks each new highest rank once, never again after a fall or on a restart', () => {
        const up = nextMoment({ rank: 0, foothold: true }, 160, true);
        expect(up.moment).toEqual({ kind: 'rankUp', rank: 'Beginner', index: 1 });
        // A total read low (half-loaded, or a bad day) does not lower what was reached...
        const low = nextMoment(up.state, 100, true);
        expect(low.moment).toBeNull();
        expect(low.state.rank).toBe(1);
        // ...so getting back there is not a moment again.
        expect(nextMoment(low.state, 151, true).moment).toBeNull();
        // A rank never reached before still is.
        expect(nextMoment(low.state, 450, true).moment).toEqual({ kind: 'rankUp', rank: 'Growing', index: 2 });
    });

    it('lets a new rank cover a first foothold that comes with it', () => {
        const both = nextMoment({ rank: 0, foothold: false }, 160, true);
        expect(both.moment).toEqual({ kind: 'rankUp', rank: 'Beginner', index: 1 });
        expect(both.state.foothold).toBe(true);
    });

    it('shows the latest rank once more on a phone that stored it before the fix', async () => {
        const AsyncStorage = require('@react-native-async-storage/async-storage');
        await AsyncStorage.setItem('habyss_climb_state', JSON.stringify({ rank: 1, foothold: true }));
        const { loadClimbState } = require('../climbMoments');
        const previous = await loadClimbState();
        expect(nextMoment(previous, 160, true).moment).toEqual({ kind: 'rankUp', rank: 'Beginner', index: 1 });
    });

    it('gives Echo a line for each', () => {
        expect(echoLineFor({ kind: 'rankUp', rank: 'Beginner', index: 1 })).toBe('That’s a start.');
        expect(echoLineFor({ kind: 'foothold' })).toContain('Today');
    });
});
