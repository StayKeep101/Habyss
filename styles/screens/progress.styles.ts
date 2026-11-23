import { StyleSheet } from 'react-native';
import { FontFamily, Spacing } from '@/theme/designSystem';

/** The look of app/(root)/progress.tsx. Values are exactly what the screen used. */
export const styles = StyleSheet.create({
    page: { flex: 1 },
    /** Whose streak, at the top right of the page. */
    whose: { flexDirection: 'row', justifyContent: 'flex-end' },
    content: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, paddingBottom: Spacing.section + Spacing.sm },
    monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
    month: { fontSize: 22, fontFamily: FontFamily.bold },
    monthArrows: { flexDirection: 'row', gap: Spacing.sm },
    grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: Spacing.sm },
    weekday: { width: '14.2857%', textAlign: 'center', fontSize: 12, fontFamily: FontFamily.semibold },
    cell: { width: '14.2857%', alignItems: 'center', paddingVertical: 5 },
    // The band joining perfect days in a row: half a cell each side, so two
    // neighbours' halves meet into one stretch. Faint, behind the discs.
    band: { position: 'absolute', top: 5, width: '50%', opacity: 0.28 },
    bandLeft: { left: 0 },
    bandRight: { right: 0 },
    dayButton: { alignItems: 'center', justifyContent: 'center' },
    ringSvg: { position: 'absolute', top: 0, left: 0 },
    dayNumber: { fontSize: 14, fontVariant: ['tabular-nums'] },
    /** The streak, centred: the figure and its flame, what it means, your best. */
    hero: { alignItems: 'center', paddingBottom: Spacing.lg },
    // The flame sits on the number's baseline, not floating at its middle.
    heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs + 2 },
    heroValue: { fontSize: 96, lineHeight: 104, fontFamily: FontFamily.bold, letterSpacing: -4, fontVariant: ['tabular-nums'] },
    /** Room after the last digit: tight tracking would clip its right edge. */
    heroRoom: { paddingRight: Spacing.sm },
    heroLabel: { fontSize: 17, lineHeight: 22, fontFamily: FontFamily.medium },
    card: { position: 'absolute', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
    cardBody: { flex: 1, padding: 16 },
    cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
    cardDate: { fontSize: 16, fontFamily: FontFamily.semibold },
    cardMeta: { fontSize: 12, fontFamily: FontFamily.regular, marginTop: 2 },
    line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 7 },
    check: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    skipBar: { width: 9, height: 1.5, borderRadius: 1 },
    lineTag: { fontSize: 11, fontFamily: FontFamily.medium },
    cardSection: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 8, marginBottom: 2 },
    cardSectionTitle: { fontSize: 15, fontFamily: FontFamily.bold },
    cardSectionCount: { fontSize: 13, fontFamily: FontFamily.medium, fontVariant: ['tabular-nums'] },
    lineText: { flex: 1, fontSize: 15, fontFamily: FontFamily.medium },
    empty: { fontSize: 13, fontFamily: FontFamily.regular, paddingVertical: 8 },
});
