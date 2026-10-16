import { StyleSheet } from 'react-native';
import { FontFamily, Spacing } from '@/theme/designSystem';

/** The look of app/(root)/chat.tsx. */
export const styles = StyleSheet.create({
    flex: { flex: 1 },
    list: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.xs },
    dayBreak: { alignSelf: 'center', fontFamily: FontFamily.medium, fontSize: 12, marginVertical: Spacing.md },
    composer: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.sm },
    input: { flex: 1, maxHeight: 120, fontFamily: FontFamily.regular, fontSize: 15, paddingHorizontal: Spacing.md + Spacing.xs, paddingTop: Spacing.sm + 2, paddingBottom: Spacing.sm + 2, borderRadius: 22 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.section },
    emptyText: { fontFamily: FontFamily.regular, fontSize: 14, textAlign: 'center' },
});
