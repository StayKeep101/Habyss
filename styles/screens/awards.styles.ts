import { StyleSheet } from 'react-native';
import { Spacing } from '@/theme/designSystem';

/** The look of app/(root)/awards.tsx. */
export const styles = StyleSheet.create({
    content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.section * 2, gap: Spacing.lg },
    grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.xl },
    cell: { width: '33.333%', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.xs },
    soon: { width: '33.333%', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.xs },
    soonInner: { alignItems: 'center', gap: Spacing.xs },
    badge: { width: Spacing.section * 2, height: Spacing.section * 2, borderRadius: Spacing.section, alignItems: 'center', justifyContent: 'center' },
});
