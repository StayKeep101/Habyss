import { Ionicons } from '@expo/vector-icons';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The icon catalogue, checked rather than trusted.
 *
 * Two entries shared the name `sunny-outline`, which React reports as
 * "Encountered two children with the same key" — a red screen on every tap in
 * the appearance tab, for a list nobody would think to re-read. A hundred
 * hand-written rows is exactly the kind of list where that happens twice.
 *
 * Read from the source rather than imported, because the module pulls in
 * Reanimated and the colour wheel to answer a question about an array.
 */
const source = readFileSync(join(__dirname, '../../components/Create/GoalLookPicker.tsx'), 'utf8');
const names = [...source.matchAll(/\{ name: '([a-z0-9-]+)', label:/g)].map(match => match[1]);

describe('the icon catalogue', () => {
    it('has icons in it at all, so a broken regex fails loudly', () => {
        expect(names.length).toBeGreaterThan(50);
    });

    it('names each icon once', () => {
        const seen = names.filter((name, index) => names.indexOf(name) !== index);
        expect(seen).toEqual([]);
    });

    it('offers only glyphs the font actually has', () => {
        // A name Ionicons does not know renders as a blank square, which reads
        // as a broken app rather than as a missing icon.
        expect(names.filter(name => !Object.hasOwn(Ionicons.glyphMap, name))).toEqual([]);
    });
});
