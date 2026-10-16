import { StyleSheet } from 'react-native';
import { FontFamily, Spacing } from '@/theme/designSystem';

/** The look of app/(root)/friend.tsx. */
export const styles = StyleSheet.create({
    content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.bottom },
    hero: { alignItems: 'center', gap: Spacing.xs, paddingTop: Spacing.sm, paddingBottom: Spacing.xl },
    name: { fontFamily: FontFamily.bold, fontSize: 26, lineHeight: 32, letterSpacing: -0.5, marginTop: Spacing.md },
    handle: { fontFamily: FontFamily.regular, fontSize: 14 },
    status: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2, marginTop: Spacing.sm },
    statusText: { fontFamily: FontFamily.semibold, fontSize: 13 },
    bio: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: Spacing.sm, paddingHorizontal: Spacing.lg },
    level: { marginBottom: Spacing.md },
    stats: { flexDirection: 'row', paddingVertical: Spacing.lg },
    stat: { flex: 1, alignItems: 'center', gap: Spacing.xs },
    statValue: { fontFamily: FontFamily.bold, fontSize: 22, fontVariant: ['tabular-nums'] },
    statLabel: { fontFamily: FontFamily.regular, fontSize: 12 },
    week: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
    weekDay: { alignItems: 'center', gap: Spacing.xs + 2 },
    weekDot: { width: 26, height: 26, borderRadius: 13 },
    weekLabel: { fontFamily: FontFamily.medium, fontSize: 11 },
    nudge: { marginTop: Spacing.lg },
    section: { marginTop: Spacing.xxl },
    empty: { fontFamily: FontFamily.regular, fontSize: 14, textAlign: 'center', paddingVertical: Spacing.xl },
});
