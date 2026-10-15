import { DELETE_MS, GAP_MS, HOLD_MS, TYPE_MS, placeholderAt } from '../typingPlaceholder';

describe('placeholderAt', () => {
    const examples = ['Read', 'Run'];
    const first = 4 * TYPE_MS + HOLD_MS + 4 * DELETE_MS + GAP_MS;

    it('types an example a letter at a time', () => {
        expect(placeholderAt(examples, 0)).toBe('R');
        expect(placeholderAt(examples, TYPE_MS * 2)).toBe('Rea');
    });

    it('holds the whole example, then deletes it', () => {
        expect(placeholderAt(examples, 4 * TYPE_MS + 10)).toBe('Read');
        expect(placeholderAt(examples, 4 * TYPE_MS + HOLD_MS)).toBe('Rea');
        expect(placeholderAt(examples, 4 * TYPE_MS + HOLD_MS + 4 * DELETE_MS + 1)).toBe('');
    });

    it('moves on to the next example and loops', () => {
        expect(placeholderAt(examples, first)).toBe('R');
        expect(placeholderAt(examples, first + TYPE_MS * 2)).toBe('Run');
        const second = 3 * TYPE_MS + HOLD_MS + 3 * DELETE_MS + GAP_MS;
        expect(placeholderAt(examples, first + second)).toBe('R');
    });

    it('is empty with nothing to show', () => {
        expect(placeholderAt([], 500)).toBe('');
    });
});
