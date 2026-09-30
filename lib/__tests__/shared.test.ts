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

describe('whose day it is, when a friend shared it with you', () => {
    const person = (over: Partial<Participant>): Participant =>
        ({ userId: 'u', username: 'sam', done: false, isYou: false, ...over });

    it('waits on the person who has not done it, whoever owns it', () => {
        // The bug this pins: participants were marked "you" by who *shared* the
        // item, so a habit a friend shared with you made them you — and gave
        // them your check-in.
        const state = sharedState([
            person({ userId: 'me', username: 'you', isYou: true, done: true }),
            person({ userId: 'them', username: 'sam', done: false }),
        ]);
        expect(state.waitingOnYou).toBe(false);
        expect(state.line).toBe('Waiting on sam');
    });

    it('says so when you are the one holding it up', () => {
        const state = sharedState([
            person({ userId: 'me', username: 'you', isYou: true, done: false }),
            person({ userId: 'them', username: 'sam', done: true }),
        ]);
        expect(state.waitingOnYou).toBe(true);
        expect(state.line).toBe('Waiting on you');
    });
});

describe('somebody who has been asked and has not answered', () => {
    const invited = (username: string): Participant =>
        ({ userId: username, username, done: false, isYou: false, pending: true });

    it('cannot hold the habit up', () => {
        // The alternative is an item that is impossible to finish until a
        // friend replies — which is a share turning into a hostage.
        expect(sharedState([you(true), invited('sam')]).complete).toBe(true);
    });

    it('is not somebody it is waiting on', () => {
        const state = sharedState([you(false), them('ana', true), invited('sam')]);
        expect(state.waitingOn.map(person => person.username)).toEqual(['me']);
        expect(state.waitingOnYou).toBe(true);
    });

    it('is not counted in the total', () => {
        const state = sharedState([you(true), them('ana', true), invited('sam')]);
        expect(state.total).toBe(2);
        expect(state.done).toBe(2);
    });

    it('is still on the card, because that is the point of the faces', () => {
        const state = sharedState([you(true), invited('sam')]);
        expect(state.people.map(person => person.username)).toEqual(['me', 'sam']);
        expect(state.invited.map(person => person.username)).toEqual(['sam']);
    });

    it('says an invitation is out rather than claiming a shared habit', () => {
        expect(sharedState([you(true), invited('sam')]).line).toBe('Invited · not answered');
        expect(sharedState([you(true), invited('sam'), invited('ana')]).line).toBe('2 invited');
    });

    it('stops mattering to the line once somebody has accepted', () => {
        expect(sharedState([you(true), them('ana', false), invited('sam')]).line)
            .toBe('Waiting on ana');
    });
});
