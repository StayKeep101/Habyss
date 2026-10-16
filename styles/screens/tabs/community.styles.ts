import { StyleSheet } from 'react-native';
import { FontFamily, Spacing, Typography } from '@/theme/designSystem';

/** The look of app/(root)/(tabs)/community.tsx. */
export const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xl },
    headerTitle: Typography.screenTitle,
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    rank: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2, height: 40, paddingHorizontal: Spacing.md },
    rankText: { fontFamily: FontFamily.bold, fontSize: 14, fontVariant: ['tabular-nums'] },
    block: { marginBottom: Spacing.xxl },
    requests: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },
    requestRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm + 2 },
    requestName: { flex: 1, fontFamily: FontFamily.semibold, fontSize: 15 },
    empty: { alignItems: 'center', paddingVertical: Spacing.section, gap: Spacing.sm },
    emptyText: { fontFamily: FontFamily.regular, fontSize: 14, textAlign: 'center', lineHeight: 20 },
    emptyLink: { fontFamily: FontFamily.semibold, fontSize: 14 },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    more: { paddingVertical: Spacing.lg },
    offlineContent: { flexGrow: 1 },
    offline: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.section * 3 },
    offlineTitle: { fontFamily: FontFamily.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.3, textAlign: 'center' },
    offlineText: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
