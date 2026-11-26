import { Colors, PALETTE } from './colors';
import { Surfaces } from './designSystem';
import { rankGradient } from './rankLooks';

/**
 * One app palette per rank (lib/marks.ts RANKS): the hourglass you use dresses
 * the whole app in its palette, and its accent is the palette's own colour.
 * Lost is Habyss's original palette, exactly, and is also the Default theme
 * (Settings → Appearance → Theme); the others are worn with the Hourglass theme.
 *
 * Each has the same six steps, only the hue changes, so every rank feels like
 * the same app: the page (deep), cards, raised parts, lines (never text), the
 * secondary text (fog) and the text (mist). Text is 9.5:1 to 14:1 on a card,
 * secondary text about 6.5:1, the accent 5:1 or more. The colours that mean
 * something (done, a warning, an error) are the same in every palette.
 *
 * theme/colors.ts PALETTE = 'original' turns all of this off (Habyss's first look).
 */
export interface RankPalette { deep: string; card: string; raised: string; line: string; fog: string; mist: string; accent: readonly [string, string] }

export const RANK_PALETTES: Record<string, RankPalette> = {
    // Habyss's original: near-black, crisp white text.
    Lost: { deep: '#050505', card: '#111113', raised: '#1C1C1F', line: '#4A4A52', fog: '#A3A3AD', mist: '#F4F5F7', accent: rankGradient('Lost') },
    // Dusk
    Beginner: { deep: '#06071B', card: '#11122D', raised: '#252645', line: '#4A4B6A', fog: '#9B9CAB', mist: '#CCCCD0', accent: ['#797CD8', '#9DA0E7'] },
    // Violet night
    Growing: { deep: '#08041D', card: '#140F2F', raised: '#292347', line: '#4E486C', fog: '#9D9AAC', mist: '#CCCCD0', accent: ['#8979D8', '#A99DE7'] },
    // Midnight blue
    Consistent: { deep: '#040D1D', card: '#0F1B2F', raised: '#233047', line: '#48556C', fog: '#9AA1AC', mist: '#CCCDD0', accent: ['#799CD8', '#9DB8E7'] },
    // Deep teal
    Disciplined: { deep: '#05181C', card: '#10292E', raised: '#234147', line: '#48666C', fog: '#9AA9AC', mist: '#CCCFD0', accent: ['#79C8D8', '#9DDAE7'] },
    // Forest at night
    Focused: { deep: '#061B14', card: '#112D24', raised: '#25453A', line: '#4A6A5F', fog: '#9BABA6', mist: '#CCD0CF', accent: ['#79D8B8', '#9DE7CE'] },
    // Bronze
    Master: { deep: '#1B1306', card: '#2D2311', raised: '#453925', line: '#6A5E4A', fog: '#ABA59B', mist: '#D0CFCC', accent: ['#D8B579', '#E7CC9D'] },
    // Ember
    Unbreakable: { deep: '#1C0E05', card: '#2E1B10', raised: '#463124', line: '#6B5649', fog: '#ABA19B', mist: '#D0CDCC', accent: ['#D89C79', '#E7B89D'] },
    // Sand and brass
    Timekeeper: { deep: '#191508', card: '#2A2514', raised: '#423B28', line: '#67604D', fog: '#A9A69D', mist: '#D0CFCC', accent: ['#D8C079', '#E7D49D'] },
    // Pearl
    Eternal: { deep: '#0C0C10', card: '#17171D', raised: '#26262F', line: '#4A4A57', fog: '#A7A7B5', mist: '#E4E4EC', accent: ['#C7D2FF', '#E9D5FF'] },
};

export const DEFAULT_PALETTE = 'Lost';
/**
 * What the Default theme wears (Settings → Appearance → Theme): Consistent's
 * midnight blue, whose accent is the logo's own periwinkle. The same for
 * everyone, whatever their rank; the Hourglass theme still follows the hourglass.
 */
export const HABYSS_PALETTE = 'Consistent';
export const paletteFor = (rank: string | null | undefined): RankPalette => RANK_PALETTES[rank ?? ''] ?? RANK_PALETTES[DEFAULT_PALETTE];

/** A colour with some transparency, from a hex value. */
const alpha = (hex: string, amount: number) => {
    const value = hex.replace('#', '');
    const [r, g, b] = [0, 2, 4].map(at => parseInt(value.slice(at, at + 2), 16));
    return `rgba(${r}, ${g}, ${b}, ${amount})`;
};
/** Halfway between two colours (for the steps between the six). */
const between = (a: string, b: string, share = 0.5) => {
    const one = a.replace('#', ''), two = b.replace('#', '');
    return `#${[0, 2, 4].map(at => Math.round(parseInt(one.slice(at, at + 2), 16) * (1 - share) + parseInt(two.slice(at, at + 2), 16) * share).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
};

/** The app's colour roles (theme/colors.ts Colors.abyss) from a palette. */
export function paletteColors(palette: RankPalette) {
    const accent = palette.accent[0];
    return {
        text: palette.mist,
        background: palette.deep,
        tint: accent,
        tabIconDefault: between(palette.line, palette.fog, 0.8),
        tabIconSelected: accent,
        primary: accent,
        primaryDark: between(palette.deep, palette.card),
        secondary: palette.card,
        silver: palette.mist,
        surface: palette.card,
        surfaceSecondary: between(palette.deep, palette.card),
        surfaceTertiary: alpha(palette.fog, 0.10),
        border: palette.raised,
        borderLight: palette.line,
        textPrimary: palette.mist,
        textSecondary: palette.fog,
        textTertiary: between(palette.line, palette.fog, 0.8),
        gradientStart: palette.card,
        gradientEnd: palette.deep,
    };
}

/** The matte card surfaces (theme/designSystem.ts Surfaces.abyss) from a palette. */
export function paletteSurface(palette: RankPalette) {
    return {
        fill: palette.card,
        top: between(palette.card, palette.raised, 0.3),
        bottom: between(palette.card, palette.deep, 0.35),
        raised: palette.raised,
        lip: alpha(palette.mist, 0.07),
        line: alpha(palette.mist, 0.06),
    };
}

/**
 * Dresses the app in a rank's palette: the colour roles and the card surfaces
 * are filled in place, so everything that reads them next draws in it
 * (context/ThemeContext.tsx redraws the app when the rank in use changes).
 */
// The original, as theme/colors.ts and theme/designSystem.ts hold it, before any palette is worn.
const ORIGINAL_COLORS = { ...Colors.abyss };
const ORIGINAL_SURFACE = { ...Surfaces.abyss };

export function applyRankPalette(rank: string | null | undefined): void {
    // The original, exactly: the Default theme, Lost, and everything with palettes off.
    if (PALETTE === 'original' || !rank || rank === DEFAULT_PALETTE || !RANK_PALETTES[rank]) {
        Object.assign(Colors.abyss, ORIGINAL_COLORS);
        Object.assign(Surfaces.abyss, ORIGINAL_SURFACE);
        return;
    }
    const palette = paletteFor(rank);
    Object.assign(Colors.abyss, paletteColors(palette));
    Object.assign(Surfaces.abyss, paletteSurface(palette));
}
