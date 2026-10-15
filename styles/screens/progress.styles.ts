import { StyleSheet } from 'react-native';
import { FontFamily } from '@/theme/designSystem';

/** The look of app/(root)/progress.tsx. Values are exactly what the screen used. */
export const styles = StyleSheet.create({
    content: { paddingHorizontal: 20, paddingBottom: 40 },
    monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
    month: { fontSize: 17, fontFamily: FontFamily.semibold },
    grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
    weekday: { width: '14.2857%', textAlign: 'center', fontSize: 10, fontFamily: FontFamily.medium, marginBottom: 8 },
    cell: { width: '14.2857%', alignItems: 'center', paddingVertical: 4 },
    dayButton: { alignItems: 'center', justifyContent: 'center' },
    ringSvg: { position: 'absolute', top: 0, left: 0 },
    dayNumber: { fontSize: 12 },
    hero: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
    heroValue: { fontSize: 44, lineHeight: 50, fontFamily: FontFamily.bold, letterSpacing: -2, fontVariant: ['tabular-nums'] },
    heroLabel: { fontSize: 15, fontFamily: FontFamily.medium },
    stats: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 6, marginTop: 10, marginBottom: 6 },
    stat: { flex: 1, alignItems: 'center', gap: 2 },
    statTop: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
    statChange: { fontSize: 11, fontFamily: FontFamily.medium, fontVariant: ['tabular-nums'] },
    statValue: { fontSize: 18, fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
    statLabel: { fontSize: 11, fontFamily: FontFamily.regular },
    card: { position: 'absolute', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
    cardBody: { flex: 1, padding: 16 },
    cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
    cardDate: { fontSize: 16, fontFamily: FontFamily.semibold },
    cardMeta: { fontSize: 12, fontFamily: FontFamily.regular, marginTop: 2 },
    line: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
    lineText: { flex: 1, fontSize: 14, fontFamily: FontFamily.regular },
    empty: { fontSize: 13, fontFamily: FontFamily.regular, paddingVertical: 8 },
});
