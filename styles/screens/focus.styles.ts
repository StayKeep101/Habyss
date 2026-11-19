import { StyleSheet } from 'react-native';
import { Control, FontFamily, Spacing, Typography } from '@/theme/designSystem';

/**
 * The look of app/(root)/focus.tsx. Pure black while running: on an OLED
 * screen black pixels are off, which is most of the screen for hours.
 */
export const styles = StyleSheet.create({
    // See-through: the page behind (app/(root)/focus.tsx) is the landscape or plain black.
    screen: { flex: 1 },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl },
    /** Balances the × so the title sits centred; the × is a 44 pt control. */
    topSpacer: { width: Control.hitTarget },
    title: { flex: 1, fontFamily: FontFamily.semibold, fontSize: 16, textAlign: 'center', color: '#FFFFFF' },
    // Centred on the screen itself, not on what is left under the top buttons:
    // the bottom padding matches the top row, so it never sits low.
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.section, paddingHorizontal: Spacing.xl, paddingBottom: Control.hitTarget },
    clockStack: { alignItems: 'center', gap: Spacing.xl },
    /** On its side: the ring on the left, everything else in a column on the right. */
    sideways: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.section, paddingHorizontal: Spacing.xl, paddingBottom: Control.hitTarget },
    sideColumn: { flex: 1, maxWidth: 420, alignItems: 'center', justifyContent: 'center' },
    // What the side column shows, at its natural height: scaled to fit the column (app/(root)/focus.tsx sideScale).
    sideContent: { alignSelf: 'stretch', alignItems: 'center', gap: Spacing.lg },
    topRight: { flexDirection: 'row', gap: Spacing.sm },
    musicButton: { alignItems: 'center', justifyContent: 'center' },
    // The slash over the notes when music is off: corner to corner, as the system draws "off".
    musicSlash: { position: 'absolute', width: 24, height: 2, borderRadius: 1, transform: [{ rotate: '-45deg' }] },
    holdLayer: { position: 'absolute', top: 0, left: 0, width: Control.hitTarget, height: Control.hitTarget, alignItems: 'center', justifyContent: 'center' },
    holdHint: { position: 'absolute', top: Control.hitTarget + 6, left: 0, width: 120, fontFamily: FontFamily.medium, fontSize: 13, color: 'rgba(255,255,255,0.75)' },
    /** Your colour, glowing at the top and gone by two thirds down. */
    heading: { alignItems: 'center', gap: Spacing.xs },
    /** "Focus", "Paused", "Over time": a quiet word in your colour over the name. */
    eyebrow: { fontFamily: FontFamily.semibold, fontSize: 15 },
    /** The full width to fit into, so shrinking to fit never measures against nothing (the name came out tiny on some phones). */
    name: { alignSelf: 'stretch', fontFamily: FontFamily.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.5, color: '#FFFFFF', textAlign: 'center' },
    nameSide: { fontSize: 22, lineHeight: 28 },
    // Where it was left last time, under the name.
    resume: { ...Typography.bodySmall, color: 'rgba(255,255,255,0.72)', textAlign: 'center', marginTop: Spacing.xs }, // ui-allow: on the scene, like the name above

    /** Start over, pause, next: a player's three buttons, the middle one the biggest. */
    controls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xl },
    play: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
    side: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    nextLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, minHeight: Control.hitTarget, paddingHorizontal: Spacing.md },
    nextText: { fontFamily: FontFamily.semibold, fontSize: 16, color: 'rgba(255,255,255,0.75)' },
    /** Free time between things: the words themselves, big, over its timer. */
    freeTitle: { alignSelf: 'stretch', fontFamily: FontFamily.bold, fontSize: 52, lineHeight: 60, letterSpacing: -1, color: '#FFFFFF', textAlign: 'center' },
    doneTitle: { fontFamily: FontFamily.bold, fontSize: 30, color: '#FFFFFF', textAlign: 'center' },
    doneSub: { fontFamily: FontFamily.medium, fontSize: 16, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: Spacing.sm },
    next: { alignSelf: 'stretch', gap: Spacing.md, marginTop: Spacing.section },
});
