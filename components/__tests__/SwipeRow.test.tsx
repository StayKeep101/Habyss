import { commitDistance } from '../Common/SwipeRow';

/**
 * The gesture itself cannot be exercised here — ReanimatedSwipeable needs
 * Reanimated's real `useEvent`, which the test harness does not provide, so a
 * render test would only be testing the mock. The rule it turns on is pure,
 * and that is what is worth pinning.
 */
describe('how far you must pull before letting go deletes', () => {
    it('asks for half the row on a wide one', () => {
        expect(commitDistance(400)).toBe(200);
        expect(commitDistance(320)).toBe(160);
    });

    it('never lets a flick be enough on a narrow row', () => {
        // Half of 200 is 100 — short enough to happen by accident.
        expect(commitDistance(200)).toBe(130);
        expect(commitDistance(0)).toBe(130);
    });

    it('grows with the row, so the gesture feels the same at any width', () => {
        expect(commitDistance(500)).toBeGreaterThan(commitDistance(400));
    });
});
