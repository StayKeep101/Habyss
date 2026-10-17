import { StyleSheet } from 'react-native';
import { FontFamily, Radius, Spacing } from '@/theme/designSystem';

/** The look of app/(root)/week-review.tsx. */
export const styles = StyleSheet.create({
    content: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, paddingBottom: Spacing.bottom, gap: Spacing.md },
    switch: { flexDirection: 'row', gap: Spacing.sm },
    flex: { flex: 1 },
    pill: { paddingVertical: Spacing.sm, alignItems: 'center' },
    pillText: { fontFamily: FontFamily.medium, fontSize: 13 },
    hero: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.lg },
    heroValue: { fontFamily: FontFamily.bold, fontSize: 52, lineHeight: 58, letterSpacing: -2, fontVariant: ['tabular-nums'] },
    heroText: { fontFamily: FontFamily.medium, fontSize: 14, textAlign: 'center' },
    change: { fontFamily: FontFamily.semibold, fontSize: 14 },
    stats: { flexDirection: 'row', gap: Spacing.md },
    stat: { flex: 1, padding: Spacing.lg, gap: 2 },
    statValue: { fontFamily: FontFamily.bold, fontSize: 24, fontVariant: ['tabular-nums'] },
    statLabel: { fontFamily: FontFamily.medium, fontSize: 12 },
    list: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
    rowName: { flex: 1, fontFamily: FontFamily.medium, fontSize: 15 },
    rowValue: { fontFamily: FontFamily.semibold, fontSize: 13, fontVariant: ['tabular-nums'] },
    tip: { padding: Spacing.lg, flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
    tipText: { flex: 1, fontFamily: FontFamily.medium, fontSize: 15, lineHeight: 21 },
    dot: { width: 8, height: 8, borderRadius: Radius.pill, marginTop: 7 },
    quiet: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
