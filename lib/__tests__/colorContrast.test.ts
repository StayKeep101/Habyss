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
