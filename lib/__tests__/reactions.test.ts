import { asReaction, reactionSummary, withMyReaction } from '../reactions';

describe('reactions', () => {
    it('sums up what a card got, most first, and leaves out none', () => {
        expect(reactionSummary({ fire: 1, proud: 3 })).toBe('Proud of you 3 · On fire 1');
        expect(reactionSummary({})).toBe('');
    });
    it('moves only your own reaction', () => {
        expect(withMyReaction({ proud: 2 }, null, 'fire')).toEqual({ proud: 2, fire: 1 });
        expect(withMyReaction({ proud: 2, fire: 1 }, 'fire', 'proud')).toEqual({ proud: 3, fire: 0 });
        expect(withMyReaction({ proud: 1 }, 'proud', null)).toEqual({ proud: 0 });
    });
    it('reads anything unknown from the server as the plain one', () => {
        expect(asReaction('fire')).toBe('fire');
        expect(asReaction('lol')).toBe('proud');
    });
});
