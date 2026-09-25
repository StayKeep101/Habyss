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
