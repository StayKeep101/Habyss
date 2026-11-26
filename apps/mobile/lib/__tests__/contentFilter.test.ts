import { isObjectionable, maskObjectionable } from '../contentFilter';

// Built from reversed spellings, as the filter stores them.
const slur = (reversed: string) => [...reversed].reverse().join('');

describe('content filter', () => {
    it('catches a slur and its disguises', () => {
        const word = slur('toggaf');
        expect(isObjectionable(`you ${word}`)).toBe(true);
        expect(isObjectionable(word.toUpperCase())).toBe(true);
        expect(isObjectionable(`${word}s`)).toBe(true);
        expect(isObjectionable(word.replace('a', '4').replace('o', '0'))).toBe(true);
        expect(isObjectionable([...word].join('.'))).toBe(true);
    });

    it('leaves ordinary words that contain one alone', () => {
        for (const text of ['Raccoon spotting', 'Spice rack', 'Pakistan trip', 'kick boxing', 'go ok', 'Read 20 pages', 'Damn good run']) {
            expect(isObjectionable(text)).toBe(false);
        }
    });

    it('masks only the word, keeping the rest', () => {
        expect(maskObjectionable(`Run with ${slur('ekyd')} later`)).toBe('Run with •••• later');
        expect(maskObjectionable('Morning run')).toBe('Morning run');
    });
});
