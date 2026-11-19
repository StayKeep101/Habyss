import { GATE_PRICE, shieldWords } from '../appGate';

describe('the block screen', () => {
    it('says Shards are the only way in, and how to earn them', () => {
        expect(shieldWords()).toEqual({
            title: 'Nice try.',
            lines: ['You blocked this. Past you was right.', `Finish habits, tasks and goals for Shards. An hour is ${GATE_PRICE}.`],
        });
    });
});
