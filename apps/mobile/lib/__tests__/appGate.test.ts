import { GATE_PRICE, shieldWords } from '../appGate';

describe('the block screen', () => {
    it('says Shards are the only way in, and how to earn them', () => {
        expect(shieldWords()).toEqual({
            title: 'Nice try.',
            lines: ['You blocked this. Good call.', `An hour costs ${GATE_PRICE} Shards.`],
            primary: 'Back to work',
            secondary: 'Unlock 1 hour',
        });
    });
});
