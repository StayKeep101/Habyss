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
    empty: { fontFamily: FontFamily.regular, fontSize: 14, textAlign: 'center', paddingVertical: Spacing.xl },
});
