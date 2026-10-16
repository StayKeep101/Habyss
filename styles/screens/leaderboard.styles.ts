import { StyleSheet } from 'react-native';
import { FontFamily, Spacing } from '@/theme/designSystem';

/** The look of app/(root)/leaderboard.tsx. */
export const styles = StyleSheet.create({
    content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.bottom, gap: Spacing.lg },
    hero: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.md },
    heroRank: { fontFamily: FontFamily.bold, fontSize: 56, lineHeight: 62, letterSpacing: -2, fontVariant: ['tabular-nums'] },
    heroLabel: { fontFamily: FontFamily.medium, fontSize: 14 },
    list: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
    place: { width: 30, fontFamily: FontFamily.bold, fontSize: 15, textAlign: 'center', fontVariant: ['tabular-nums'] },
    name: { flex: 1, fontFamily: FontFamily.medium, fontSize: 15 },
    marks: { fontFamily: FontFamily.semibold, fontSize: 15, fontVariant: ['tabular-nums'] },
    gap: { marginTop: Spacing.sm },
    unranked: { alignItems: 'center', gap: Spacing.sm, padding: Spacing.xl },
    unrankedTitle: { fontFamily: FontFamily.bold, fontSize: 22, lineHeight: 28, marginTop: Spacing.xs },
    unrankedText: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20, textAlign: 'center' },
    track: { alignSelf: 'stretch', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: Spacing.sm },
    fill: { height: '100%', borderRadius: 3 },
    unrankedMeta: { fontFamily: FontFamily.regular, fontSize: 12, fontVariant: ['tabular-nums'] },
    empty: { fontFamily: FontFamily.regular, fontSize: 14, textAlign: 'center', paddingVertical: Spacing.xl },
});
