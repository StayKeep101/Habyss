import { contrastRatio } from '../colorContrast';
import { RANKS } from '../marks';
import { applyRankPalette, paletteColors, paletteFor, RANK_PALETTES } from '@/theme/palettes';
import { Colors } from '@/theme/colors';

describe('a palette for every rank', () => {
    it('has one for each rank, Lost the default', () => {
        expect(RANKS.map(rank => rank.name).every(name => !!RANK_PALETTES[name])).toBe(true);
        expect(paletteFor(null)).toBe(RANK_PALETTES.Lost);
        expect(paletteFor('Nobody')).toBe(RANK_PALETTES.Lost);
    });
    it.each(Object.keys(RANK_PALETTES))('%s reads: text, secondary text and the accent on its cards and page', name => {
        const palette = RANK_PALETTES[name];
        const roles = paletteColors(palette);
        for (const surface of [palette.card, palette.deep]) {
            expect(contrastRatio(roles.textPrimary, surface)).toBeGreaterThanOrEqual(7);
            expect(contrastRatio(roles.textSecondary, surface)).toBeGreaterThanOrEqual(4.5);
            expect(contrastRatio(roles.textTertiary, surface)).toBeGreaterThanOrEqual(4.5);
            expect(contrastRatio(palette.accent[0], surface)).toBeGreaterThanOrEqual(4.5);
        }
    });
    it('dresses the app in place, and the colours that mean something never change', () => {
        const success = Colors.abyss.success;
        applyRankPalette('Master');
        expect(Colors.abyss.background).toBe(RANK_PALETTES.Master.deep);
        expect(Colors.abyss.success).toBe(success);
        applyRankPalette(null);
        expect(Colors.abyss.background).toBe(RANK_PALETTES.Lost.deep);
    });
});

describe('Default or Hourglass theme', () => {
    it('is the original, exactly, for the Default theme and for Lost', () => {
        const { applyRankPalette: apply } = require('@/theme/palettes');
        apply('Master');
        apply(null);
        expect(Colors.abyss.background).toBe('#050505');
        expect(Colors.abyss.textPrimary).toBe('#F4F5F7');
        apply('Lost');
        expect(Colors.abyss.surface).toBe('#121826');
    });
    it('wears the hourglass in use only when Hourglass is chosen (a Developer preview always)', () => {
        const look = require('../rankLook') as typeof import('../rankLook');
        const choice = require('../themeChoice') as typeof import('../themeChoice');
        look.setRankLook('Master');
        expect(choice.themeRank()).toBeNull();
        choice.setThemeChoice('hourglass');
        expect(choice.themeRank()).toBe('Master');
        choice.setThemeChoice('default');
        look.previewRankLook('Focused');
        expect(choice.themeRank()).toBe('Focused');
        look.previewRankLook(null);
    });
    it('goes back to Default when Default is tapped, even straight after a preview', () => {
        const look = require('../rankLook') as typeof import('../rankLook');
        const choice = require('../themeChoice') as typeof import('../themeChoice');
        look.setRankLook('Master');
        choice.setThemeChoice('hourglass');
        look.previewRankLook('Eternal');
        expect(choice.themeRank()).toBe('Eternal');
        choice.setThemeChoice('default');
        expect(choice.themeRank()).toBeNull();
        expect(look.currentRankLook().preview).toBeNull();
        // Already on Default, a preview showing: tapping Default still ends it.
        look.previewRankLook('Focused');
        choice.setThemeChoice('default');
        expect(choice.themeRank()).toBeNull();
    });
});
