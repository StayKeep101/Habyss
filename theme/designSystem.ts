import { StyleSheet } from 'react-native';

/** Shared geometry and the font files loaded by app/_layout.tsx. */
export const FontFamily = {
    regular: 'Lexend_400Regular',
    medium: 'Lexend_500Medium',
    semibold: 'Lexend_600SemiBold',
    bold: 'Lexend_700Bold',
    display: 'SpaceGrotesk_700Bold',
} as const;

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, section: 32, bottom: 40 } as const;

/**
 * How a card is made to sit above the page.
 *
 * The app's cards used to be drawn the way a wireframe is: nothing inside, a
 * hairline around the outside, and the accent colour leaking through it. On a
 * near-black background that reads as an outline rather than an object — the
 * card has no body, so the border is doing all the work, and a coloured border
 * on every card makes the accent mean nothing.
 *
 * A real surface is made of three things, and a drop shadow is only one of
 * them:
 *
 *   fill      a matte step above the page. This is what makes it an object.
 *             It matters most on OLED black, where `surface` is the same
 *             colour as the background and a card is otherwise invisible.
 *   lip       a hairline of *white* along the edge, the way a raised surface
 *             catches light. The old cards had one of these too — the
 *             difference is that there was nothing behind it, so it read as an
 *             outline drawing rather than an edge.
 *   shadow    soft, wide and well below the card. It does most of the work in
 *             daylight and very little on black, which is why it is not the
 *             whole recipe.
 */
export interface SurfaceTone {
    /** The card's own colour, opaque: the middle of its gradient. */
    fill: string;
    /** The top of the card's gradient, a little lighter, where light falls. */
    top: string;
    /** The bottom of the card's gradient, a little darker. */
    bottom: string;
    /** A lighter fill for something raised above a card — a chip on a panel. */
    raised: string;
    /** The hairline along the edge, where a raised surface catches light. */
    lip: string;
    /** Only where a divider is genuinely needed, never as an outline. */
    line: string;
}

export const Surfaces: Record<'light' | 'abyss' | 'trueDark', SurfaceTone> = {
    // Matte, like Phantom: a dark, opaque card with a soft gradient — lighter
    // at the top, falling off towards the bottom — one faint light edge, and a
    // soft shadow under it. No blur and no gloss.
    light: {
        fill: '#F2F2F5',
        top: '#F8F8FA',
        bottom: '#ECECF0',
        raised: '#E6E6EB',
        lip: 'rgba(15,23,42,0.06)',
        line: 'rgba(15,23,42,0.07)',
    },
    abyss: {
        fill: '#111113',
        top: '#18181B',
        bottom: '#0C0C0E',
        raised: '#1C1C1F',
        lip: 'rgba(255,255,255,0.06)',
        line: 'rgba(255,255,255,0.05)',
    },
    trueDark: {
        // The page stays pure black for OLED; the cards keep the same gradient,
        // which is what keeps them visible on it.
        fill: '#101010',
        top: '#171717',
        bottom: '#0B0B0B',
        raised: '#1B1B1B',
        lip: 'rgba(255,255,255,0.06)',
        line: 'rgba(255,255,255,0.05)',
    },
};

/**
 * Two heights, and no more.
 *
 * Every extra level of elevation is another decision nobody can make
 * consistently. A card sits on the page; something that floats over a card —
 * a sheet, a menu — sits higher. That is the whole vocabulary.
 */
export const Elevation = {
    // Close and soft, like Phantom's: enough to lift a card off a black page
    // without a glow around it.
    card: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 18,
        elevation: 6,
    },
    // Buttons, chips and fields: a tighter shadow than a card, so a control
    // reads as something you can press, sitting on the card or the page.
    control: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 4,
    },
    floating: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.38,
        shadowRadius: 36,
        elevation: 14,
    },
} as const;

/**
 * The tones for a theme, tolerating a name this file has never heard of.
 *
 * `Colors` carries a runtime `dark` alias for `abyss`, and a preference stored
 * by an older build can be any string at all. A surface that came back
 * undefined would take the screen down, which is a steep price for a colour.
 */
export const surfaceFor = (theme: string): SurfaceTone =>
    Surfaces[theme as keyof typeof Surfaces] ?? Surfaces.abyss;

/** Daylight needs a fainter shadow than a dark room, or the card looks dirty. */
export const elevationFor = (theme: string, level: keyof typeof Elevation = 'card') =>
    theme === 'light'
        ? { ...Elevation[level], shadowOpacity: level === 'card' ? 0.07 : level === 'control' ? 0.06 : 0.12, shadowColor: '#0F172A' }
        : Elevation[level];
export const Radius = { small: 12, control: 18, card: 22, sheet: 24, pill: 999 } as const;
export const Control = { height: 54, hitTarget: 44, icon: 20 } as const;

export const Typography = StyleSheet.create({
    screenTitle: { fontFamily: FontFamily.bold, fontSize: 30, lineHeight: 38, letterSpacing: -0.8 },
    title: { fontFamily: FontFamily.bold, fontSize: 18, lineHeight: 26 },
    heading: { fontFamily: FontFamily.semibold, fontSize: 16, lineHeight: 24 },
    body: { fontFamily: FontFamily.regular, fontSize: 15, lineHeight: 22 },
    bodySmall: { fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 20 },
    caption: { fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 18 },
    label: { fontFamily: FontFamily.semibold, fontSize: 11, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' },
    button: { fontFamily: FontFamily.semibold, fontSize: 15, lineHeight: 22 },
});

export const UIStyles = StyleSheet.create({
    screenContent: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, paddingBottom: Spacing.bottom },
    card: { borderRadius: Radius.card, borderWidth: 1, overflow: 'hidden' },
    control: { minHeight: Control.height, borderRadius: Radius.control },
    iconButton: { width: Control.hitTarget, height: Control.hitTarget, alignItems: 'center', justifyContent: 'center' },
    sectionTitle: { ...Typography.label, marginBottom: Spacing.sm },
    sectionDescription: { ...Typography.bodySmall, marginBottom: Spacing.md },
});
