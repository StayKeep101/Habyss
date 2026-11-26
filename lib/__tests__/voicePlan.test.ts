jest.mock('../onDeviceAI', () => ({ isOnDeviceAIReady: () => false }));
import { planFromSpeech, splitSpeech } from '../voicePlan';

describe('speaking freely, understood', () => {
    it('finds each thing in a ramble, without the ums, and knows a task from a habit', () => {
        expect(splitSpeech('um so tomorrow I need to call the bank and uh I want to start running every morning, and also I\'d love to read 12 books this year')).toEqual([
            { kind: 'task', text: 'Tomorrow call the bank' },
            { kind: 'habit', text: 'Running every morning' },
            { kind: 'task', text: 'Read 12 books this year' },
        ]);
    });

    it('keeps a single thing whole', () => {
        expect(splitSpeech('uh buy milk on the way home')).toEqual([{ kind: 'task', text: 'Buy milk on the way home' }]);
    });

    it('takes "make it a habit" at its word, and a goal said is a task', () => {
        expect(splitSpeech('create a habit of meditating ten minutes. Then add a goal to save 5000 dollars by December')).toEqual([
            { kind: 'habit', text: 'Meditating ten minutes' },
            { kind: 'task', text: 'Save 5000 dollars by December' },
        ]);
    });

    it('says nothing twice, and nothing for silence', async () => {
        expect(splitSpeech('call mom. call mom')).toEqual([{ kind: 'task', text: 'Call mom' }]);
        expect(splitSpeech('um uh')).toEqual([]);
        await expect(planFromSpeech('')).resolves.toEqual([]);
    });
});
