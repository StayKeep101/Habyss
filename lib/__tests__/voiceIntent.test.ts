import { readVoice } from '../voiceIntent';

describe('reading what was said', () => {
    it('takes the kind from the words used', () => {
        expect(readVoice('Hey, create a habit of reading 20 pages every night.')).toEqual({ kind: 'habit', text: 'Reading 20 pages every night' });
        expect(readVoice('create a goal of saving $5000 by December')).toEqual({ kind: 'task', text: 'Saving $5000 by December' });
        expect(readVoice('add a task to call mum tomorrow at 5')).toEqual({ kind: 'task', text: 'Call mum tomorrow at 5' });
        expect(readVoice('new to-do: buy milk')).toEqual({ kind: 'task', text: 'Buy milk' });
        expect(readVoice('can you make a reminder to pay rent on Friday')).toEqual({ kind: 'task', text: 'Pay rent on Friday' });
    });

    it('guesses from the sentence when no kind is said', () => {
        expect(readVoice('meditate every morning')?.kind).toBe('habit');
        expect(readVoice('run a marathon by October')?.kind).toBe('task');
        expect(readVoice('email Ahmet the leads')?.kind).toBe('task');
    });

    it('says nothing for silence or a bare command', () => {
        expect(readVoice('   ')).toBeNull();
        expect(readVoice('create a habit')).toBeNull();
    });
});
