import { GATE_PRICE, shieldWords } from '../appGate';

describe('the block screen', () => {
    it('says Shards are the only way in, and how to earn them', () => {
        expect(shieldWords()).toEqual({
            title: 'Earn your scroll',
            lines: ['Finish habits, tasks and goals to earn Shards.', `An hour of your apps is ${GATE_PRICE}.`],
        });
    });
});
