import { StyleSheet } from 'react-native';
import { Spacing } from '@/theme/designSystem';

/** The look of app/(root)/ranks.tsx. */
export const styles = StyleSheet.create({
    content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.bottom, gap: Spacing.xl },
    hero: { alignItems: 'center', gap: Spacing.xs },
    track: { alignSelf: 'stretch', height: Spacing.xs, borderRadius: Spacing.xs / 2, overflow: 'hidden', marginTop: Spacing.md },
    fill: { height: '100%', borderRadius: Spacing.xs / 2 },
    climb: { gap: Spacing.sm },
    row: { padding: Spacing.md },
    rowMain: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    rowText: { flex: 1, gap: Spacing.xs / 2 },
    swatch: { height: Spacing.xs + 2, borderRadius: Spacing.xs, marginTop: Spacing.xs, width: '70%' },
    locked: { opacity: 0.5 },
    status: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
});
