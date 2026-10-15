import type { TextStyle } from 'react-native';
import { contrastRatio } from '@/lib/colorContrast';
import { Colors } from '@/theme/colors';
import { Elevation, FontFamily, Radius, Typography, Surfaces } from '@/theme/designSystem';

/**
 * Habyss design tokens: every colour, gap, corner, text style and shadow the
 * app may use, by name. Screens never use raw values; they read these, through
 * the components in components/ui or the `useTokens()` hook.
 *
 * The values themselves live in theme/colors.ts and theme/designSystem.ts —
 * the app's current look — and this file names them. Change a value there and
 * it changes everywhere. Adding a new token is a decision, not a convenience:
 * ask first (see CLAUDE.md).
 */

/* -------------------------------------------------------------------------- */
/*  Colour roles — what each colour is FOR, per theme.                        */
/*  Read straight from theme/colors.ts and the surfaces in                     */
/*  theme/designSystem.ts, so there is one place to change a colour and the    */
/*  roles always match what the screens already show. The accent here is only */
/*  the default: the user's chosen accent replaces it at runtime (useTokens).  */
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
    /** Secondary text: meta lines, descriptions. */
    textMuted: string;
    /** The quietest text: captions, placeholders, axis labels. */
    textSubtle: string;
    accent: string;
    success: string;
    /** Caution, and also tasks and the streak flame. */
    warning: string;
    danger: string;
}

export type ThemeName = 'abyss' | 'trueDark' | 'light';

const rolesOf = (theme: ThemeName): ColorRoles => ({
    background: Colors[theme].background,
    surface: Surfaces[theme].fill,
    surfaceRaised: Surfaces[theme].raised,
    border: Colors[theme].border,
    textPrimary: Colors[theme].textPrimary,
    textMuted: Colors[theme].textSecondary,
    textSubtle: Colors[theme].textTertiary,
    accent: Colors[theme].primary,
    success: Colors[theme].success,
    warning: Colors[theme].warning,
    danger: Colors[theme].error,
});

export const colorRoles: Record<ThemeName, ColorRoles> = {
    abyss: rolesOf('abyss'),
    trueDark: rolesOf('trueDark'),
    light: rolesOf('light'),
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
    contrastRatio('#FFFFFF', fill) >= contrastRatio('#000000', fill) ? Colors.common.white : Colors.common.black;

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
    /** Small controls, chips, tiles. */
    sm: Radius.small,
    /** Buttons and inputs. */
    md: Radius.control,
    /** Cards. */
    lg: Radius.card,
    /** Sheets and modals. */
    xl: Radius.sheet,
    /** Pills and circles. */
    full: Radius.pill,
} as const;

export type RadiusToken = keyof typeof radius;

/* -------------------------------------------------------------------------- */
/*  Type — one family, six styles. Numbers line up in columns.                */
/* -------------------------------------------------------------------------- */

export type TypeToken = 'display' | 'screenTitle' | 'title' | 'heading' | 'body' | 'bodySmall' | 'caption' | 'label';

export const typeScale: Record<TypeToken, TextStyle> = {
    /** Big numbers: a goal's 62%, a Marks total. */
    display: { fontFamily: FontFamily.bold, fontSize: 44, lineHeight: 48, letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
    /** A page's own title. */
    screenTitle: Typography.screenTitle,
    /** Card headlines. */
    title: Typography.title,
    /** Row titles, section heads. */
    heading: Typography.heading,
    /** Running text. */
    body: Typography.body,
    /** Secondary running text. */
    bodySmall: Typography.bodySmall,
    /** Meta lines, hints, small print. */
    caption: Typography.caption,
    /** Section labels in capitals. */
    label: Typography.label,
};

/* -------------------------------------------------------------------------- */
/*  Elevation — three levels.                                                 */
/* -------------------------------------------------------------------------- */

export const elevation = {
    none: {},
    card: Elevation.card,
    control: Elevation.control,
    floating: Elevation.floating,
} as const;

export type ElevationToken = keyof typeof elevation;

/** Daylight wants a fainter, cooler shadow, or the card looks dirty. */
export function elevationFor(theme: string, level: ElevationToken) {
    if (level === 'none' || theme !== 'light') return elevation[level];
    return { ...elevation[level], shadowColor: Colors.light.textPrimary, shadowOpacity: level === 'card' ? 0.07 : 0.12 };
}
