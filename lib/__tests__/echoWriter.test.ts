import { acceptLine, needsWriting, pickLine, type LineStore, type Subject } from '../echoWriter';

const subject = (over: Partial<Subject> = {}): Subject =>
    ({ key: 'habit:a', kind: 'habit', name: 'Gym', ...over });

describe('a line Echo wrote on the phone', () => {
    it('keeps a short, plain sentence', () => {
        expect(acceptLine('Time for the gym — you know it helps.')).toBe('Time for the gym — you know it helps.');
        expect(acceptLine('  "Your run is waiting."  ')).toBe('Your run is waiting.');
    });

    it('throws away anything with a number in it', () => {
        // Echo is told no history here, so a number can only be invented.
        expect(acceptLine('That is 6 days in a row — keep it up.')).toBeNull();
        expect(acceptLine('You have missed 2 sessions this week.')).toBeNull();
    });

    it('throws away the model narrating its instructions', () => {
        expect(acceptLine('Sure! Here is your notification: go to the gym.')).toBeNull();
        expect(acceptLine('Reminder: gym time.')).toBeNull();
        expect(acceptLine('Time for {habit}.')).toBeNull();
    });

    it('throws away an answer that is empty, tiny or a paragraph', () => {
        expect(acceptLine('')).toBeNull();
        expect(acceptLine(null)).toBeNull();
        expect(acceptLine('Go.')).toBeNull();
        expect(acceptLine('a'.repeat(200))).toBeNull();
    });
});

describe('choosing the line to send', () => {
    const store: LineStore = { 'habit:a': { voice: 'friendly', lines: ['One', 'Two', 'Three'] } };

    it('moves through the pool so days do not read alike', () => {
        expect(pickLine(store, 'habit:a', 'friendly', 0)).toBe('One');
        expect(pickLine(store, 'habit:a', 'friendly', 1)).toBe('Two');
        expect(pickLine(store, 'habit:a', 'friendly', 3)).toBe('One');
    });

    it('falls back when the voice has changed since they were written', () => {
        expect(pickLine(store, 'habit:a', 'bully_mode', 0)).toBeNull();
    });

    it('falls back when nothing has been written for it', () => {
        expect(pickLine(store, 'habit:zzz', 'friendly', 0)).toBeNull();
        expect(pickLine({ 'habit:a': { voice: 'friendly', lines: [] } }, 'habit:a', 'friendly', 0)).toBeNull();
    });
});

describe('what still needs writing', () => {
    it('is anything with a short pool, a stale voice, or none at all', () => {
        const store: LineStore = {
            full: { voice: 'friendly', lines: ['a', 'b', 'c', 'd'] },
            short: { voice: 'friendly', lines: ['a'] },
            stale: { voice: 'dad_mode', lines: ['a', 'b', 'c', 'd'] },
        };
        const pending = needsWriting(store, [
            subject({ key: 'full' }), subject({ key: 'short' }),
            subject({ key: 'stale' }), subject({ key: 'missing' }),
        ], 'friendly');
        expect(pending.map(item => item.key)).toEqual(['short', 'stale', 'missing']);
    });
});
