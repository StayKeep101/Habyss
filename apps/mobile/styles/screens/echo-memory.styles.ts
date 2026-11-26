import { StyleSheet } from 'react-native';
import { FontFamily, Spacing } from '@/theme/designSystem';

/** The look of app/(root)/echo-memory.tsx. */
export const styles = StyleSheet.create({
    content: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, paddingBottom: Spacing.bottom, gap: Spacing.md },
    flex: { flex: 1 },
    lead: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20 },
    note: { padding: Spacing.lg, gap: Spacing.xs },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
    text: { flex: 1, fontFamily: FontFamily.medium, fontSize: 15, lineHeight: 21 },
    input: { flex: 1, fontFamily: FontFamily.medium, fontSize: 15, padding: 0 },
    meta: { fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 17 },
    field: { fontFamily: FontFamily.regular, fontSize: 15 },
    help: { padding: Spacing.lg, gap: Spacing.sm },
    helpRow: { flexDirection: 'row', justifyContent: 'space-between' },
    helpText: { fontFamily: FontFamily.medium, fontSize: 14 },
    crisis: { padding: Spacing.lg, gap: Spacing.sm },
    crisisTitle: { fontFamily: FontFamily.semibold, fontSize: 16 },
});
