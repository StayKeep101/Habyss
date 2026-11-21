import { cleanPlus, DEFAULT_PLUS, plusOffered } from '../plusActions';

describe('the + with goals off (the first release)', () => {
    it('never offers a goal or a bet on one', () => {
        expect(plusOffered('goal')).toBe(false);
        expect(plusOffered('bet')).toBe(false);
        expect(plusOffered('habit')).toBe(true);
    });
    it('drops them from a saved choice and from the defaults', () => {
        const plus = cleanPlus({ home: ['goal', 'habit', 'task'], community: ['bet', 'challenge'] });
        expect(plus.home).toEqual(['habit', 'task']);
        expect(plus.community).toEqual(['challenge']);
        expect(cleanPlus(null).home).not.toContain('goal');
        expect(DEFAULT_PLUS.home).toContain('goal');
    });
});
