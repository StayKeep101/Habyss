import { StyleSheet } from 'react-native';
// Shared with the Mac: packages/design/src/surfaces.ts. What stays here is the phone's own part.
import { Spacing, Elevation, Radius, Control } from '@habyss/design/surfaces';
export * from '@habyss/design/surfaces';

/** Shared geometry and the font files loaded by app/_layout.tsx. */
/**
 * Three weights, one typeface — the way the goal Stats page reads:
 *   bold     titles and the big numbers
 *   medium   names, labels, anything you tap
 *   regular  the quiet grey lines under them
 * `semibold` and `display` are kept as names so older screens compile, and
 * draw as medium and bold, so no screen can add a fourth weight or a second
 * typeface.
 */
export const FontFamily = {
    regular: 'Lexend_400Regular',
    medium: 'Lexend_500Medium',
    semibold: 'Lexend_500Medium',
    bold: 'Lexend_700Bold',
    display: 'Lexend_700Bold',
} as const;


export const Typography = StyleSheet.create({
    screenTitle: { fontFamily: FontFamily.bold, fontSize: 30, lineHeight: 38, letterSpacing: -0.8 },
    title: { fontFamily: FontFamily.bold, fontSize: 18, lineHeight: 26 },
    /** A sheet's name, centred at its top: a step above a title, as large as a section heading. */
    sheetTitle: { fontFamily: FontFamily.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
    heading: { fontFamily: FontFamily.semibold, fontSize: 16, lineHeight: 24 },
    body: { fontFamily: FontFamily.regular, fontSize: 15, lineHeight: 22 },
    bodySmall: { fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 20 },
    caption: { fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 18 },
    button: { fontFamily: FontFamily.semibold, fontSize: 15, lineHeight: 22 },
});

export const UIStyles = StyleSheet.create({
    screenContent: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, paddingBottom: Spacing.bottom },
    card: { borderRadius: Radius.card, borderWidth: 1, overflow: 'hidden' },
    control: { minHeight: Control.height, borderRadius: Radius.control },
    iconButton: { width: Control.hitTarget, height: Control.hitTarget, alignItems: 'center', justifyContent: 'center' },
    // A section reads as a title, the way the goal page's Stats tab heads
    // "Numbers": large, bold, sentence case — never a small spaced-out label.
    sectionTitle: { fontFamily: FontFamily.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3, marginBottom: Spacing.md },
    sectionDescription: { ...Typography.bodySmall, marginBottom: Spacing.md },
});
