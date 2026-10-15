import { StyleSheet } from 'react-native';
import { FontFamily } from '@/theme/designSystem';

/** The look of app/(root)/goals-overview.tsx. Values are exactly what the screen used. */
export const styles = StyleSheet.create({
    content: { paddingHorizontal: 20, paddingBottom: 40 },
    answer: { fontSize: 22, fontFamily: FontFamily.bold, letterSpacing: -0.3, marginTop: 6 },
    numberRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 6 },
    big: { fontSize: 44, fontFamily: FontFamily.bold, letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
    bigLabel: { fontSize: 14, fontFamily: FontFamily.medium },
    chart: { marginTop: 14 },
    legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
    legendLine: { width: 16, height: 2.5, borderRadius: 2, marginLeft: 6 },
    legendDashed: { height: 0, borderTopWidth: 1.5, borderStyle: 'dashed', backgroundColor: 'transparent' },
    legendText: { fontSize: 13, fontFamily: FontFamily.medium },
    list: { marginTop: 26, gap: 10 },
    row: { padding: 16, gap: 10 },
    miniChart: { height: 64 },
    rowTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
    name: { flex: 1, fontSize: 16, fontFamily: FontFamily.semibold },
    percent: { fontSize: 18, fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
    bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
    fill: { height: 6, borderRadius: 3 },
    rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    pillText: { fontSize: 12, fontFamily: FontFamily.semibold },
    next: { flex: 1, fontSize: 13, fontFamily: FontFamily.regular },
    emptyCard: { alignItems: 'center', padding: 32, gap: 8, marginTop: 20 },
    emptyTitle: { fontSize: 16, fontFamily: FontFamily.semibold },
    emptyBody: { fontSize: 13, fontFamily: FontFamily.regular, textAlign: 'center' },
});
