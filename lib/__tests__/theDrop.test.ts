import { hasDropped, isSealed, minuteOf } from '../theDrop';

const TODAY = '2026-10-28';
describe('the drop', () => {
    it('reads the sharing time', () => {
        expect(minuteOf('21:00')).toBe(1260);
        expect(minuteOf(null)).toBeNull();
    });
    it("seals a friend's card from today until your own day drops", () => {
        const friend = { mine: false, day: TODAY };
        expect(isSealed(friend, TODAY, '21:00', 1200)).toBe(true);
        expect(isSealed(friend, TODAY, '21:00', 1260)).toBe(false);
    });
    it('never seals your own card, an earlier day, or anything when daily posts are off', () => {
        expect(isSealed({ mine: true, day: TODAY }, TODAY, '21:00', 600)).toBe(false);
        expect(isSealed({ mine: false, day: '2026-10-27' }, TODAY, '21:00', 600)).toBe(false);
        expect(isSealed({ mine: false, day: TODAY }, TODAY, null, 600)).toBe(false);
        expect(hasDropped(null, 0)).toBe(true);
    });
});
