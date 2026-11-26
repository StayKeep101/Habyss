import { hintsFrom, Transcript } from '../speechOptions';

const said = (transcript: string, isFinal = false) => ({ results: [{ transcript, confidence: 1, segments: [] }], isFinal }) as never;

describe('everything heard in one session', () => {
    it('keeps what was said before a pause', () => {
        const t = new Transcript();
        t.push(said('read 24'));
        t.push(said('read 24 books', true));
        t.push(said('by this'));
        expect(t.push(said('by this year'))).toBe('read 24 books by this year');
    });
    it('does not repeat a phone that sends the whole session again', () => {
        const t = new Transcript();
        t.push(said('call mom', true));
        expect(t.push(said('call mom tomorrow at 5', true))).toBe('call mom tomorrow at 5');
    });
    it('starts empty again', () => {
        const t = new Transcript();
        t.push(said('one', true));
        t.reset();
        expect(t.push(said('two'))).toBe('two');
    });
});

describe('hints for the recogniser', () => {
    it('puts your own names first, once each, then the app words, at most 100', () => {
        const hints = hintsFrom(['Learn AI Engineering', 'learn ai engineering', 'Sourcing', ...Array.from({ length: 200 }, (_, i) => `Habit ${i}`)]);
        expect(hints[0]).toBe('Learn AI Engineering');
        expect(hints.filter(hint => hint.toLowerCase() === 'learn ai engineering')).toHaveLength(1);
        expect(hints.length).toBe(100);
        expect(hintsFrom([])).toContain('Habyss');
    });
});
