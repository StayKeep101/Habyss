import { StyleSheet } from 'react-native';
import { FontFamily, Spacing } from '@/theme/designSystem';

/** The look of app/(root)/brain-dump.tsx: a page to write on, nothing more. */
export const styles = StyleSheet.create({
    flex: { flex: 1 },
    content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.bottom * 2 },
    composer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, marginBottom: Spacing.md },
    input: { flex: 1, fontFamily: FontFamily.medium, fontSize: 20, lineHeight: 28, paddingVertical: Spacing.sm },
    divider: { borderTopWidth: StyleSheet.hairlineWidth },
    empty: { fontFamily: FontFamily.regular, fontSize: 15, textAlign: 'center', marginTop: Spacing.section },
    undo: { position: 'absolute', left: Spacing.xl, right: Spacing.xl, bottom: Spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: 999 },
    undoText: { fontFamily: FontFamily.medium, fontSize: 14 },
    undoAction: { fontFamily: FontFamily.semibold, fontSize: 15 },
});
