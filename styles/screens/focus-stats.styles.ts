import { StyleSheet } from 'react-native';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { s, vs, ms } from '@/theme/scale';

/** The look of app/(root)/focus-stats.tsx (the same layout as task-stats). */
export const styles = StyleSheet.create({
    content: { paddingHorizontal: Spacing.xl, paddingBottom: vs(48), gap: vs(20) },
    hero: { gap: vs(4), marginTop: vs(6) },
    heroValue: { fontFamily: FontFamily.bold, fontSize: ms(56), lineHeight: ms(62), letterSpacing: -2, fontVariant: ['tabular-nums'] },
    heroLabel: { fontSize: ms(15), fontFamily: FontFamily.medium },
    trendRow: { flexDirection: 'row', alignItems: 'center', gap: s(10), flexWrap: 'wrap' },
    trend: { flexDirection: 'row', alignItems: 'center', gap: s(4), paddingHorizontal: s(10), paddingVertical: vs(4), borderRadius: 999, borderWidth: 1 },
    trendText: { fontSize: ms(12), fontFamily: FontFamily.medium, fontVariant: ['tabular-nums'] },
    chart: { flexDirection: 'row', alignItems: 'flex-end', gap: s(4), height: vs(150) },
    barTrack: { flex: 1, height: '100%', justifyContent: 'flex-end' },
    bar: { width: '100%', borderRadius: s(6), minHeight: vs(4) },
    axis: { flexDirection: 'row', justifyContent: 'space-between', gap: s(4), marginTop: -vs(12) },
    axisText: { fontSize: ms(12), fontFamily: FontFamily.regular },
    axisDay: { flex: 1, textAlign: 'center' },
    list: { paddingHorizontal: s(16), paddingVertical: vs(6) },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: vs(10) },
    rowLabel: { fontSize: ms(15), fontFamily: FontFamily.medium },
    item: { paddingVertical: vs(10), gap: vs(8) },
    itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s(12) },
    itemName: { flex: 1, fontSize: ms(15), fontFamily: FontFamily.medium },
    itemValue: { fontSize: ms(14), fontFamily: FontFamily.semibold, fontVariant: ['tabular-nums'] },
    track: { height: vs(6), borderRadius: 999, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 999 },
});
