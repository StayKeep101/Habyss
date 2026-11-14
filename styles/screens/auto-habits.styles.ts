import { StyleSheet } from 'react-native';
import { Spacing, UIStyles } from '@/theme/designSystem';

/** The look of app/(root)/auto-habits.tsx: the habits Habyss tracks by itself, one card each. */
export const styles = StyleSheet.create({
    content: { ...UIStyles.screenContent, gap: Spacing.md },
    intro: { marginBottom: Spacing.sm },
    card: { padding: Spacing.lg, gap: Spacing.md },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    text: { flex: 1, gap: Spacing.xs / 2 },
});
