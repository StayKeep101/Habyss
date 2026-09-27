import { nameList, sharedState, type Participant } from '../shared';

const you = (done: boolean): Participant => ({ userId: 'me', username: 'me', done, isYou: true });
const them = (username: string, done: boolean): Participant => ({ userId: username, username, done, isYou: false });

describe('a habit two people are doing together', () => {
    it('is not done until everyone has done it', () => {
        expect(sharedState([you(true), them('sam', false)]).complete).toBe(false);
        expect(sharedState([you(true), them('sam', true)]).complete).toBe(true);
    });

    it('behaves like an ordinary habit when nobody else is on it', () => {
        expect(sharedState([you(true)]).complete).toBe(true);
        expect(sharedState([you(false)]).line).toBe('Not done yet');
    });

    it('is never complete with nobody on it at all', () => {
        const state = sharedState([]);
        expect(state.complete).toBe(false);
        expect(state.line).toBe('');
    });

    it('puts you first, then everyone else by name', () => {
        const state = sharedState([them('zoe', false), them('ali', false), you(false)]);
        expect(state.people.map(person => person.username)).toEqual(['me', 'ali', 'zoe']);
    });
});

describe('who it is waiting on', () => {
    it('names your own part first, because that is the part you can act on', () => {
        expect(sharedState([you(false), them('sam', true)]).line).toBe('Waiting on you');
        expect(sharedState([you(false), them('sam', true)]).waitingOnYou).toBe(true);
    });

    it('names the friend when you have done yours', () => {
        expect(sharedState([you(true), them('sam', false)]).line).toBe('Waiting on sam');
    });

    it('says both are done rather than counting to two', () => {
        expect(sharedState([you(true), them('sam', true)]).line).toBe('Both done');
    });

    it('counts once there are more than two of you', () => {
        const state = sharedState([you(true), them('a', true), them('b', false), them('c', false)]);
        expect(state.line).toBe('2 of 4 done');
    });

    it('still leads with you when several are outstanding', () => {
        const state = sharedState([you(false), them('a', false), them('b', true)]);
        expect(state.line).toBe('Waiting on you and 1 more');
    });

    it('leaves you out of the waiting list once you have done yours', () => {
        const state = sharedState([you(true), them('sam', false)]);
        expect(state.waitingOn.map(person => person.username)).toEqual(['sam']);
        expect(state.waitingOnYou).toBe(false);
    });
});

describe('naming the people on it', () => {
    it('writes names the way a person would say them', () => {
        expect(nameList([you(true)])).toBe('you');
        expect(nameList([you(true), them('sam', true)])).toBe('you and sam');
        expect(nameList([you(true), them('a', true), them('b', true)])).toBe('you, a and b');
    });

    it('has nothing to say about nobody', () => {
        expect(nameList([])).toBe('');
    });
});
