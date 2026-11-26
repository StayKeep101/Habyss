import { StyleSheet } from 'react-native';
import { FontFamily, Radius, Spacing, UIStyles } from '@/theme/designSystem';

/** The look of app/(root)/all-habits.tsx: every habit or task, in use first, stopped apart below. */
export const styles = StyleSheet.create({
    loading: { marginTop: Spacing.section },
    content: { ...UIStyles.screenContent, gap: Spacing.section },
    section: { gap: Spacing.sm },
    count: { fontSize: 15, fontFamily: FontFamily.semibold },
    hint: { fontSize: 13, fontFamily: FontFamily.regular, marginTop: -Spacing.xs },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
    icon: { width: 36, height: 36, borderRadius: Radius.small, alignItems: 'center', justifyContent: 'center' },
    text: { flex: 1 },
    name: { fontSize: 15, fontFamily: FontFamily.medium },
    meta: { fontSize: 12, fontFamily: FontFamily.regular, marginTop: Spacing.xs / 2 },
    badge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.pill },
    badgeText: { fontSize: 12, fontFamily: FontFamily.medium },
    empty: { fontSize: 14, fontFamily: FontFamily.regular, paddingVertical: Spacing.md },
});
