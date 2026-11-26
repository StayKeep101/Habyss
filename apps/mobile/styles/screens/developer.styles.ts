import { StyleSheet } from 'react-native';
import { FontFamily, Spacing } from '@/theme/designSystem';

/** The look of app/(root)/developer.tsx. */
export const styles = StyleSheet.create({
    content: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, paddingBottom: Spacing.bottom, gap: Spacing.xl },
    note: { fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 19 },
});
