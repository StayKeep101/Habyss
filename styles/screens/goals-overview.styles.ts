import { StyleSheet } from 'react-native';
import { FontFamily } from '@/theme/designSystem';

/** The look of app/(root)/goals-overview.tsx. Values are exactly what the screen used. */
export const styles = StyleSheet.create({
    content: { paddingHorizontal: 20, paddingBottom: 40 },
    numberRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 10 },
    big: { fontSize: 44, fontFamily: FontFamily.bold, letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
    bigLabel: { fontSize: 14, fontFamily: FontFamily.medium },
    chart: { marginTop: 20 },
    list: { marginTop: 32, gap: 12 },
    row: { padding: 18, gap: 14 },
    miniChart: { height: 48 },
    rowTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
    name: { flex: 1, fontSize: 16, fontFamily: FontFamily.semibold },
    percent: { fontSize: 18, fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
    bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
    fill: { height: 6, borderRadius: 3 },
    rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    status: { flex: 1, fontSize: 13, fontFamily: FontFamily.medium },
    emptyCard: { alignItems: 'center', padding: 32, gap: 8, marginTop: 20 },
    emptyTitle: { fontSize: 16, fontFamily: FontFamily.semibold },
    emptyBody: { fontSize: 13, fontFamily: FontFamily.regular, textAlign: 'center' },
});
