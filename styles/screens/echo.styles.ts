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
});
