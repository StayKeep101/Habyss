import { StyleSheet } from 'react-native';
import { Control, FontFamily, Spacing } from '@/theme/designSystem';

/**
 * The look of app/(root)/focus.tsx. Pure black while running: on an OLED
 * screen black pixels are off, which is most of the screen for hours.
 */
export const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#000000' },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl },
    /** Balances the × so the title sits centred; the × is a 44 pt control. */
    topSpacer: { width: Control.hitTarget },
    title: { flex: 1, fontFamily: FontFamily.semibold, fontSize: 16, textAlign: 'center', color: '#FFFFFF' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'space-evenly', paddingHorizontal: Spacing.xl },
    /** Your colour, glowing at the top and gone by two thirds down. */
    glow: { position: 'absolute', top: 0, left: 0, right: 0, height: '70%' },
    heading: { alignItems: 'center', gap: Spacing.xs },
    /** "Focus", "Paused", "Over time": a quiet word in your colour over the name. */
    eyebrow: { fontFamily: FontFamily.semibold, fontSize: 15 },
    name: { fontFamily: FontFamily.bold, fontSize: 32, lineHeight: 38, letterSpacing: -0.6, color: '#FFFFFF', textAlign: 'center' },
    controls: { alignItems: 'center', gap: Spacing.md },
    /** The one control while it runs: white, round, unmissable. */
    play: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
    nextLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, minHeight: Control.hitTarget, paddingHorizontal: Spacing.md },
    nextText: { fontFamily: FontFamily.semibold, fontSize: 16, color: 'rgba(255,255,255,0.75)' },
    doneTitle: { fontFamily: FontFamily.bold, fontSize: 30, color: '#FFFFFF', textAlign: 'center' },
    doneSub: { fontFamily: FontFamily.medium, fontSize: 16, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: Spacing.sm },
    next: { alignSelf: 'stretch', gap: Spacing.md, marginTop: Spacing.section },
});
