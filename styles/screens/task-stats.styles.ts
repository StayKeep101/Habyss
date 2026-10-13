import { StyleSheet } from 'react-native';
import { FontFamily } from '@/theme/designSystem';
import { s, vs, ms } from '@/theme/scale';

/** The screen's side padding; task-stats.tsx imports it for its heatmap maths. */
export const PAD = 20;

/** The look of app/(root)/task-stats.tsx. Values are exactly what the screen used. */
export const styles = StyleSheet.create({
    content: { paddingHorizontal: PAD, paddingBottom: vs(48), gap: vs(28) },
    hero: { gap: vs(4), marginTop: vs(6) },
    heroRow: { flexDirection: 'row', alignItems: 'center', gap: s(12) },
    heroValue: { fontFamily: FontFamily.bold, fontSize: ms(64), lineHeight: ms(70), letterSpacing: -2, fontVariant: ['tabular-nums'] },
    heroLabel: { fontSize: ms(14), lineHeight: ms(20), fontFamily: FontFamily.regular },
    streak: { flexDirection: 'row', alignItems: 'center', gap: s(5), paddingHorizontal: s(10), paddingVertical: vs(5), borderRadius: 999 },
    streakText: { color: '#F97316', fontSize: ms(12), fontFamily: FontFamily.semibold },
    block: { gap: vs(12) },
    blockHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    blockTitle: { fontSize: ms(16), fontFamily: FontFamily.bold },
    blockMeta: { fontSize: ms(12), fontFamily: FontFamily.medium },
    chart: { flexDirection: 'row', alignItems: 'flex-end', gap: s(2), height: vs(110) },
    targetLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed', opacity: 0.6 },
    barTrack: { flex: 1, height: '100%', justifyContent: 'flex-end' },
    bar: { width: '100%', borderRadius: s(3), minHeight: vs(3) },
    axis: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    axisText: { fontSize: ms(11), fontFamily: FontFamily.regular },
    heat: { flexDirection: 'row' },
    heatLabel: { fontSize: ms(9), fontFamily: FontFamily.medium, textAlign: 'left' },
    legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: s(5) },
    legendCell: { width: s(11), height: s(11), borderRadius: 3 },
    moreToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(6), paddingVertical: vs(4) },
    moreText: { fontSize: ms(13), fontFamily: FontFamily.medium },
    details: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: -vs(16) },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: vs(13) },
    rowLabel: { fontSize: ms(14), fontFamily: FontFamily.regular },
    rowValue: { fontSize: ms(14), fontFamily: FontFamily.semibold, fontVariant: ['tabular-nums'] },
});
