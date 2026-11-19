import { goalModes } from '../goalFocus';

describe('at most three goals in focus', () => {
    it('fills free focus places oldest first, the rest maintained', () => {
        expect(goalModes(['a', 'b', 'c', 'd'], {})).toEqual({ a: 'focus', b: 'focus', c: 'focus', d: 'maintain' });
    });

    it('keeps what was chosen, and never more than three in focus', () => {
        expect(goalModes(['a', 'b', 'c', 'd'], { a: 'maintain', d: 'focus' })).toEqual({ a: 'maintain', b: 'focus', c: 'focus', d: 'focus' });
        expect(goalModes(['a', 'b', 'c', 'd'], { a: 'focus', b: 'focus', c: 'focus', d: 'focus' }).d).toBe('maintain');
    });
});
