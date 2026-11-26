import { afterWrong } from '../appPasscode';

describe('wrong passcodes', () => {
    it('allows four wrong, then waits 30 seconds, then longer each round', () => {
        let tries = { wrong: 0, until: 0, rounds: 0 };
        for (let i = 0; i < 4; i++) tries = afterWrong(tries, 0);
        expect(tries).toEqual({ wrong: 4, until: 0, rounds: 0 });
        tries = afterWrong(tries, 1000);
        expect(tries).toEqual({ wrong: 0, until: 31_000, rounds: 1 });
        for (let i = 0; i < 5; i++) tries = afterWrong(tries, 2000);
        expect(tries.until).toBe(62_000);
    });
});
