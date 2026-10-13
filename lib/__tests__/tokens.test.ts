import { colorRoles, rolesFor, space, radius, textOn, tint, typeScale } from '@/theme/tokens';

describe('design tokens', () => {
    it('gives every theme the same roles', () => {
        const roles = Object.keys(colorRoles.abyss).sort();
        expect(Object.keys(colorRoles.trueDark).sort()).toEqual(roles);
        expect(Object.keys(colorRoles.light).sort()).toEqual(roles);
    });
    it('reads the old dark theme name as abyss', () => {
        expect(rolesFor('dark')).toBe(colorRoles.abyss);
        expect(rolesFor('nonsense')).toBe(colorRoles.abyss);
    });
    it('keeps spacing on a 4-point grid', () => {
        expect(Object.values(space).every(value => value % 4 === 0)).toBe(true);
    });
    it('names the corner sizes and text styles the app already uses', () => {
        expect(Object.keys(radius)).toEqual(['sm', 'md', 'lg', 'xl', 'full']);
        expect(Object.keys(typeScale)).toEqual(['display', 'screenTitle', 'title', 'heading', 'body', 'bodySmall', 'caption', 'label']);
    });
    it('reads its colours from the current theme', () => {
        const { Colors } = require('@/theme/colors');
        expect(colorRoles.abyss.textPrimary).toBe(Colors.abyss.textPrimary);
        expect(colorRoles.light.accent).toBe(Colors.light.primary);
    });
    it('tints a colour at three strengths', () => {
        expect(tint('#8BADD6', 'subtle')).toBe('rgba(139,173,214,0.12)');
        expect(tint('#FFF', 'soft')).toBe('rgba(255,255,255,0.2)');
    });
    it('picks text that reads on a fill', () => {
        expect(textOn('#000000')).toBe('#FFFFFF');
        expect(textOn('#F8FAFC')).toBe('#000000');
    });
});
