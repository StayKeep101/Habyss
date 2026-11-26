import { StyleSheet } from 'react-native';
import { Spacing, UIStyles } from '@/theme/designSystem';

/** The look of app/(root)/connect.tsx (Allow Claude or ChatGPT, from the assistant's sign-in page). */
export const styles = StyleSheet.create({
    content: { ...UIStyles.screenContent, gap: Spacing.section },
    head: { alignItems: 'center', gap: Spacing.md },
    mark: { width: Spacing.section + Spacing.lg, height: Spacing.section + Spacing.lg },
    actions: { gap: Spacing.xs },
});
