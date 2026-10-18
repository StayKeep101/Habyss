import { StyleSheet } from 'react-native';
import { FontFamily, Spacing } from '@/theme/designSystem';

/** The look of app/(root)/echo.tsx. */
export const styles = StyleSheet.create({
    content: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, paddingBottom: Spacing.bottom, gap: Spacing.md },
    start: { padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    startText: { flex: 1, gap: 2 },
    startTitle: { fontFamily: FontFamily.semibold, fontSize: 16 },
    startSub: { fontFamily: FontFamily.regular, fontSize: 13 },
    proposal: { padding: Spacing.lg, gap: Spacing.sm },
    proposalTitle: { fontFamily: FontFamily.semibold, fontSize: 16 },
    proposalText: { fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 19 },
    buttons: { flexDirection: 'row', gap: Spacing.sm },
    flex: { flex: 1 },
    quiet: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20 },
    feel: { padding: Spacing.lg, gap: Spacing.md },
    feelRow: { flexDirection: 'row', gap: Spacing.lg },
    feelValue: { fontFamily: FontFamily.bold, fontSize: 28, fontVariant: ['tabular-nums'] },
    bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 48 },
    barCol: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
    bar: { width: 8, borderRadius: 4 },
});
