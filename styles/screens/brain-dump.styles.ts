import { StyleSheet } from 'react-native';
import { FontFamily, Spacing } from '@/theme/designSystem';

/** The look of app/(root)/brain-dump.tsx: a page to write on, nothing more. */
export const styles = StyleSheet.create({
    flex: { flex: 1 },
    content: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, paddingBottom: Spacing.xl },
    composer: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm + 2, borderTopWidth: StyleSheet.hairlineWidth },
    input: { flex: 1, maxHeight: 120, fontFamily: FontFamily.medium, fontSize: 17, lineHeight: 24, paddingVertical: Spacing.sm },
    send: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    divider: { borderTopWidth: StyleSheet.hairlineWidth },
    selectBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
    selectAll: { fontFamily: FontFamily.semibold, fontSize: 14 },
    clears: { fontFamily: FontFamily.medium, fontSize: 12, marginBottom: Spacing.sm },
    empty: { fontFamily: FontFamily.regular, fontSize: 15, textAlign: 'center', marginTop: Spacing.section },
    undo: { position: 'absolute', left: Spacing.xl, right: Spacing.xl, bottom: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: 999 },
    undoText: { fontFamily: FontFamily.medium, fontSize: 14 },
    undoAction: { fontFamily: FontFamily.semibold, fontSize: 15 },
});
