import { StyleSheet } from 'react-native';
import { Control, Spacing, UIStyles } from '@/theme/designSystem';

/** The look of app/(root)/unlock.tsx (the Focus Gate: earn your apps back, or an hour for Shards). Spacing comes from tokens in the page. */
export const styles = StyleSheet.create({
    content: { ...UIStyles.screenContent },
    row: { flexDirection: 'row', alignItems: 'center' },
    between: { justifyContent: 'space-between' },
    title: { flex: 1 },
    center: { textAlign: 'center' },
    mark: { width: Spacing.xxl, height: Spacing.xxl },
    /** The small caps over the title, spaced like the widgets' eyebrow. */
    eyebrow: { letterSpacing: Spacing.xs / 2 },
    shards: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, minHeight: Control.height + Spacing.sm },
});
