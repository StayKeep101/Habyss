import { StyleSheet } from 'react-native';
import { Control, FontFamily, Spacing } from '@/theme/designSystem';
import { s, vs, ms } from '@/theme/scale';

/** The look of app/(root)/focus-stats.tsx (the same layout as task-stats). */
export const styles = StyleSheet.create({
    content: { paddingHorizontal: Spacing.xl, paddingBottom: vs(48), gap: vs(20) },
    /** Screen time: the report takes all the room below its controls (and scrolls inside). */
    reportPage: { flex: 1, paddingBottom: 0 },
    hero: { gap: vs(4), marginTop: vs(6) },
    heroValue: { fontFamily: FontFamily.bold, fontSize: ms(56), lineHeight: ms(62), letterSpacing: -2, fontVariant: ['tabular-nums'] },
    heroLabel: { fontSize: ms(15), fontFamily: FontFamily.medium },
    trendRow: { flexDirection: 'row', alignItems: 'center', gap: s(10) },
    /** The change on last week, as a ticker reads: a caret, the signed figure, a quiet label. */
    trend: { flexDirection: 'row', alignItems: 'center', gap: s(4), flexShrink: 1 },
    trendValue: { fontSize: ms(15), fontFamily: FontFamily.semibold, fontVariant: ['tabular-nums'] },
    trendText: { fontSize: ms(15), fontFamily: FontFamily.regular, marginLeft: s(2) },
    /** Which days the chart shows, or the tapped day and its total. */
    window: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    /** The dates between the arrows: tapped, back to today. */
    windowTap: { flex: 1, minHeight: Control.hitTarget, justifyContent: 'center' },
    windowLabel: { flex: 1, fontFamily: FontFamily.medium, fontSize: ms(13), textAlign: 'center' },
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
