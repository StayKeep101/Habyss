import type { TextStyle } from 'react-native';
import { contrastRatio } from '@/lib/colorContrast';
import { FontFamily } from './DesignSystem';

/**
 * Habyss design tokens: every colour, gap, corner, text style and shadow the
 * app may use. Screens never use raw values; they read these, through the
 * components in components/ui or the `useTokens()` hook.
 *
 * To change how the whole app looks, edit the values in this file. Each section
 * says what it controls. Adding a new token is a decision, not a convenience:
 * ask first (see CLAUDE.md).
 */

/* -------------------------------------------------------------------------- */
/*  Raw palette — only this file uses these. Roles below point at them.       */
/* -------------------------------------------------------------------------- */

export const palette = {
    void: '#050505',
    black: '#000000',
    trench: '#0A0F14',
    deep: '#13161C',
    shelf: '#1A1E26',
    oledCard: '#0F0F11',
    oledRaised: '#17171A',
    oledLine: '#262626',
    cloud: '#E0E6ED',
    slate: '#94A3B8',
    zinc: '#A1A1AA',
    tide: '#8BADD6',
    blue: '#3B82F6',
    teal: '#4ECDC4',
    emerald: '#10B981',
    amber: '#F59E0B',
    coral: '#FF4757',
    red: '#EF4444',
    ink: '#0F172A',
    pewter: '#475569',
    frost: '#E2E8F0',
    snow: '#F8FAFC',
    white: '#FFFFFF',
    glassLine: 'rgba(255,255,255,0.08)',
} as const;

/* -------------------------------------------------------------------------- */
/*  Colour roles — what each colour is FOR, per theme.                        */
/*  The accent here is only the default: the user's chosen accent replaces    */
/*  it at runtime (see useTokens).                                            */
/* -------------------------------------------------------------------------- */

export interface ColorRoles {
    /** The page behind everything. */
    background: string;
    /** A card. */
    surface: string;
    /** Something raised on a card: a chip, a track, an input. */
    surfaceRaised: string;
    /** Dividers and hairlines only, never an outline around every card. */
    border: string;
    textPrimary: string;
    /** Everything secondary: meta lines, captions, placeholders. */
    textMuted: string;
    accent: string;
    success: string;
    /** Caution, and also tasks and the streak flame. */
    warning: string;
    danger: string;
}

export type ThemeName = 'abyss' | 'trueDark' | 'light';

export const colorRoles: Record<ThemeName, ColorRoles> = {
    abyss: {
        background: palette.void,
        surface: palette.deep,
        surfaceRaised: palette.shelf,
        border: palette.glassLine,
        textPrimary: palette.cloud,
        textMuted: palette.slate,
        accent: palette.tide,
        success: palette.teal,
        warning: palette.amber,
        danger: palette.coral,
    },
    trueDark: {
        background: palette.black,
        surface: palette.oledCard,
        surfaceRaised: palette.oledRaised,
        border: palette.oledLine,
        textPrimary: palette.white,
        textMuted: palette.zinc,
        accent: palette.tide,
        success: palette.emerald,
        warning: palette.amber,
        danger: palette.red,
    },
    light: {
        background: palette.white,
        surface: palette.white,
        surfaceRaised: palette.snow,
        border: palette.frost,
        textPrimary: palette.ink,
        textMuted: palette.pewter,
        accent: palette.blue,
        success: palette.emerald,
        warning: palette.amber,
        danger: palette.red,
    },
};

/** Resolves any theme name the app has used (including the old `dark`). */
export const rolesFor = (theme: string): ColorRoles =>
    colorRoles[(theme === 'dark' ? 'abyss' : theme) as ThemeName] ?? colorRoles.abyss;

/* -------------------------------------------------------------------------- */
/*  Accent tints — three strengths of any colour over a surface.              */
/* -------------------------------------------------------------------------- */

export const tintAlpha = {
    /** A selected row or option. */
    subtle: 0.12,
    /** A chip, a pill, a badge background. */
    soft: 0.2,
    /** An outline in the accent. */
    border: 0.45,
} as const;

export type TintLevel = keyof typeof tintAlpha;

/** `#RRGGBB` (or `#RGB`) at one of the three tint strengths, as rgba. */
export function tint(color: string, level: TintLevel): string {
    let hex = color.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(char => char + char).join('');
    if (!/^[0-9a-f]{6}/i.test(hex)) return color;
    const [r, g, b] = [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16));
    return `rgba(${r},${g},${b},${tintAlpha[level]})`;
}

/** White or black, whichever reads on a solid fill of this colour. */
export const textOn = (fill: string): string =>
    contrastRatio('#FFFFFF', fill) >= contrastRatio('#000000', fill) ? palette.white : palette.black;

/* -------------------------------------------------------------------------- */
/*  Spacing — every padding, margin and gap is one of these.                  */
/* -------------------------------------------------------------------------- */

export const space = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
} as const;

export type SpaceToken = keyof typeof space;

/* -------------------------------------------------------------------------- */
/*  Corner radius.                                                             */
/* -------------------------------------------------------------------------- */

export const radius = {
    /** Small controls, bars, tiny chips. */
    sm: 8,
    /** Tiles, inputs, chips. */
    md: 14,
    /** Cards, sheets, modals. */
    lg: 22,
    /** Pills and circles. */
    full: 999,
} as const;

export type RadiusToken = keyof typeof radius;

/* -------------------------------------------------------------------------- */
/*  Type — one family, six styles. Numbers line up in columns.                */
/* -------------------------------------------------------------------------- */

export type TypeToken = 'display' | 'title' | 'heading' | 'body' | 'caption' | 'label';

export const typeScale: Record<TypeToken, TextStyle> = {
    /** Big numbers: a goal's 62%, a Marks total. */
    display: { fontFamily: FontFamily.bold, fontSize: 44, lineHeight: 48, letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
    /** Screen and card headlines. */
    title: { fontFamily: FontFamily.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
    /** Row titles, section heads. */
    heading: { fontFamily: FontFamily.semibold, fontSize: 16, lineHeight: 22 },
    /** Running text. */
    body: { fontFamily: FontFamily.regular, fontSize: 15, lineHeight: 22 },
    /** Meta lines, hints, small print. */
    caption: { fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18 },
    /** Section labels in capitals. */
    label: { fontFamily: FontFamily.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 1.4, textTransform: 'uppercase' },
};

/* -------------------------------------------------------------------------- */
/*  Elevation — three levels.                                                 */
/* -------------------------------------------------------------------------- */

export const elevation = {
    none: {},
    card: { shadowColor: '#000000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.28, shadowRadius: 24, elevation: 6 },
    floating: { shadowColor: '#000000', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.38, shadowRadius: 36, elevation: 14 },
} as const;

export type ElevationToken = keyof typeof elevation;

/** Daylight wants a fainter, cooler shadow, or the card looks dirty. */
export function elevationFor(theme: string, level: ElevationToken) {
    if (level === 'none' || theme !== 'light') return elevation[level];
    return { ...elevation[level], shadowColor: palette.ink, shadowOpacity: level === 'card' ? 0.07 : 0.12 };
}
