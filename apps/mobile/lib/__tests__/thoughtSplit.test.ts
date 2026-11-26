import { isNote, splitThought } from '../thoughtSplit';

describe('sorting a brain-dump thought', () => {
    it('splits a list of actions, carrying the day onto each', () => {
        expect(splitThought('Saturday: clean the apartment, wash clothes, buy groceries, take the dog out')).toEqual([
            { text: 'Clean the apartment saturday', kind: 'task' }, { text: 'Wash clothes saturday', kind: 'task' },
            { text: 'Buy groceries saturday', kind: 'task' }, { text: 'Take the dog out saturday', kind: 'task' },
        ]);
        expect(splitThought('Tomorrow I need to get up early, finish the report, call Dad').map(piece => piece.text))
            .toEqual(['Get up early tomorrow', 'Finish the report tomorrow', 'Call Dad tomorrow']);
    });
    it('carries what the list is for', () => {
        expect(splitThought('For the birthday party, invite everyone, book the venue, order food')[0].text).toBe('Invite everyone for the birthday party');
    });
    it('keeps ideas, questions and feelings as notes', () => {
        expect(splitThought('What if the onboarding experience was completely personalized?')).toEqual([{ text: 'What if the onboarding experience was completely personalized?', kind: 'note' }]);
        expect(isNote('I felt anxious before the meeting, but it turned out fine.')).toBe(true);
        expect(isNote('Too many ideas, not enough time.')).toBe(true);
    });
    it('does not split one thought, a list of things, a time or a number', () => {
        expect(splitThought('I want to wake up at 5 AM, but I also want eight hours of sleep.')).toHaveLength(1);
        expect(splitThought('I should organize my finances: bills, debt, savings, taxes, insurance, and investments.')).toHaveLength(1);
        expect(splitThought('Oh no, the assignment is due tonight at 11:59.')).toHaveLength(1);
        expect(splitThought('$1,250.75 + $499.99 — need to budget these costs.')).toHaveLength(1);
        expect(splitThought('https://example.com/article — read this later')[0].text.startsWith('https://')).toBe(true);
        expect(splitThought('')).toEqual([]);
    });
    it('suggests a habit for something regular', () => {
        expect(splitThought('Every other Monday I should check my project progress.')[0].kind).toBe('habit');
    });
});
