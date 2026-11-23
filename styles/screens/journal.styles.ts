import { StyleSheet } from 'react-native';
import { FontFamily, Spacing } from '@/theme/designSystem';

/** The look of app/(root)/journal.tsx. */
export const styles = StyleSheet.create({
    content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.section * 2, gap: Spacing.lg },
    monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    month: { fontSize: 22, fontFamily: FontFamily.bold },
    arrows: { flexDirection: 'row', gap: Spacing.sm },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    weekday: { width: '14.2857%', textAlign: 'center', fontSize: 12, fontFamily: FontFamily.semibold, paddingBottom: Spacing.sm },
    cell: { width: '14.2857%', alignItems: 'center', paddingVertical: Spacing.xs },
    day: { alignItems: 'center', justifyContent: 'center' },
    ring: { position: 'absolute', top: 0, left: 0 },
    dayNumber: { fontSize: 14, fontFamily: FontFamily.medium, fontVariant: ['tabular-nums'] },
    noteDot: { position: 'absolute', bottom: -Spacing.xs, width: Spacing.xs + 1, height: Spacing.xs + 1, borderRadius: Spacing.xs },
});
