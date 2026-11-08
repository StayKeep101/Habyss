import { StyleSheet } from 'react-native';
import { Spacing } from '@/theme/designSystem';

/** The look of app/(root)/ranks.tsx. */
export const styles = StyleSheet.create({
    content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.bottom, gap: Spacing.xl },
    hero: { alignItems: 'center', gap: Spacing.xs },
    track: { alignSelf: 'stretch', height: Spacing.xs, borderRadius: Spacing.xs / 2, overflow: 'hidden', marginTop: Spacing.md },
    fill: { height: '100%', borderRadius: Spacing.xs / 2 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.lg },
    cell: { width: '33.333%', alignItems: 'center', gap: Spacing.xs },
});
