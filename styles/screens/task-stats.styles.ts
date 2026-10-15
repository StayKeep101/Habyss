import { StyleSheet } from 'react-native';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { s, vs, ms } from '@/theme/scale';

/** The look of app/(root)/task-stats.tsx. */
export const styles = StyleSheet.create({
    content: { paddingHorizontal: Spacing.xl, paddingBottom: vs(48), gap: vs(20) },
    hero: { gap: vs(4), marginTop: vs(6) },
    heroValue: { fontFamily: FontFamily.bold, fontSize: ms(64), lineHeight: ms(70), letterSpacing: -2, fontVariant: ['tabular-nums'] },
    heroLabel: { fontSize: ms(15), fontFamily: FontFamily.medium },
    trendRow: { flexDirection: 'row', alignItems: 'center', gap: s(10), flexWrap: 'wrap' },
    trend: { flexDirection: 'row', alignItems: 'center', gap: s(4), paddingHorizontal: s(10), paddingVertical: vs(4), borderRadius: 999, borderWidth: 1 },
    trendText: { fontSize: ms(12), fontFamily: FontFamily.medium, fontVariant: ['tabular-nums'] },
    chart: { flexDirection: 'row', alignItems: 'flex-end', gap: s(8), height: vs(160) },
    barTrack: { flex: 1, height: '100%', justifyContent: 'flex-end' },
    bar: { width: '100%', borderRadius: s(8), minHeight: vs(6) },
    axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -vs(10) },
    axisText: { fontSize: ms(12), fontFamily: FontFamily.regular },
    list: { paddingHorizontal: s(16), paddingVertical: vs(6) },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: vs(10) },
    rowLabel: { fontSize: ms(15), fontFamily: FontFamily.medium },
});
