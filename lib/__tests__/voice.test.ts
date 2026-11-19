import { oopsTitle, pick } from '../voice';

describe('voice', () => {
    it('never says the same line twice in a row', () => {
        const lines = ['a', 'b', 'c'];
        const said = [pick(lines, () => 0), pick(lines, () => 0), pick(lines, () => 0)];
        expect(said[0]).not.toBe(said[1]);
        expect(said[1]).not.toBe(said[2]);
    });

    it('always has something to say', () => {
        for (let i = 0; i < 20; i++) expect(oopsTitle().length).toBeGreaterThan(0);
    });
});
