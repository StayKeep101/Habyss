import { StyleSheet } from 'react-native';
import { FontFamily } from '@/theme/designSystem';

/** The look of app/(root)/progress.tsx. Values are exactly what the screen used. */
export const styles = StyleSheet.create({
    content: { paddingHorizontal: 20, paddingBottom: 40 },
    monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, marginTop: 20 },
    month: { fontSize: 17, fontFamily: FontFamily.semibold },
    statRule: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 6 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
    weekday: { width: '14.2857%', textAlign: 'center', fontSize: 12, fontFamily: FontFamily.semibold, marginBottom: 10 },
    cell: { width: '14.2857%', alignItems: 'center', paddingVertical: 5 },
    // The band joining perfect days in a row: half a cell each side, so two
    // neighbours' halves meet into one stretch. Faint, behind the discs.
    band: { position: 'absolute', top: 5, width: '50%', opacity: 0.28 },
    bandLeft: { left: 0 },
    bandRight: { right: 0 },
    dayButton: { alignItems: 'center', justifyContent: 'center' },
    ringSvg: { position: 'absolute', top: 0, left: 0 },
    dayNumber: { fontSize: 14, fontVariant: ['tabular-nums'] },
    /** The streak, centred: flame, the figure, what it means, your best. */
    hero: { alignItems: 'center', marginTop: 12, marginBottom: 24 },
    heroValue: { fontSize: 96, lineHeight: 104, fontFamily: FontFamily.bold, letterSpacing: -4, fontVariant: ['tabular-nums'], marginTop: 4 },
    heroLabel: { fontSize: 17, fontFamily: FontFamily.medium, marginTop: -2 },
    heroBest: { fontSize: 13, fontFamily: FontFamily.medium, marginTop: 6 },
    stats: { flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 6, marginTop: 0, marginBottom: 6 },
    stat: { flex: 1, alignItems: 'center', gap: 2 },
    statTop: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
    statChange: { fontSize: 11, fontFamily: FontFamily.medium, fontVariant: ['tabular-nums'] },
    statValue: { fontSize: 20, fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
    statLabel: { fontSize: 12, fontFamily: FontFamily.regular },
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
