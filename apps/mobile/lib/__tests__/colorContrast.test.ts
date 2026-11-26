import { contrastRatio, readableAccent } from '../colorContrast';
import { ACCENT_GRADIENTS } from '@/context/AccentContext';
import { Colors } from '@/theme/colors';

it('calculates reference contrast ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBe(21);
    expect(contrastRatio('#ffffff', '#ffffff')).toBe(1);
    expect(contrastRatio('#fff', '#000')).toBe(21);
});

it('preserves accent colors that already have sufficient contrast', () => {
    expect(readableAccent('#3A5A8C', '#ffffff')).toBe('#3A5A8C');
});

it.each(ACCENT_GRADIENTS.map(preset => [preset.id, preset.colors] as const))(
    'keeps %s readable in every theme and on primary buttons', (_id, colors) => {
        for (const theme of [Colors.light, Colors.abyss, Colors.trueDark]) {
            expect(contrastRatio(readableAccent(colors[0], theme.background), theme.background)).toBeGreaterThanOrEqual(4.5);
        }
        for (const color of colors) {
            expect(contrastRatio(readableAccent(color, '#ffffff'), '#ffffff')).toBeGreaterThanOrEqual(4.5);
        }
    },
);

describe('mixHex', () => {
    const { mixHex } = require('../colorContrast');
    it('finds the middle of a gradient', () => {
        expect(mixHex('#000000', '#FFFFFF')).toBe('#808080');
        expect(mixHex('#3B82F6', '#8B5CF6')).toBe('#636FF6');
    });
    it('returns either end at 0 and 1', () => {
        expect(mixHex('#102030', '#A0B0C0', 0)).toBe('#102030');
        expect(mixHex('#102030', '#A0B0C0', 1)).toBe('#A0B0C0');
    });
});
