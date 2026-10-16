import { StyleSheet } from 'react-native';
import { FontFamily, Spacing } from '@/theme/designSystem';

/** The look of app/(root)/brain-dump.tsx. */
export const styles = StyleSheet.create({
    flex: { flex: 1 },
    content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.bottom, gap: Spacing.sm },
    composer: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md },
    input: { flex: 1, minHeight: 52, maxHeight: 180, fontFamily: FontFamily.regular, fontSize: 16, lineHeight: 22, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.md, borderRadius: 22 },
    day: { fontFamily: FontFamily.semibold, fontSize: 13, marginTop: Spacing.lg, marginBottom: Spacing.xs },
    item: { marginBottom: Spacing.sm },
    thought: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.xs },
    text: { fontFamily: FontFamily.regular, fontSize: 15, lineHeight: 22 },
    foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    actions: { flexDirection: 'row', gap: Spacing.xs + 2 },
    time: { fontFamily: FontFamily.regular, fontSize: 11 },
    empty: { fontFamily: FontFamily.regular, fontSize: 14, textAlign: 'center', marginTop: Spacing.section },
});
