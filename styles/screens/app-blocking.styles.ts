import { StyleSheet } from 'react-native';
import { Spacing } from '@/theme/designSystem';

/** The look of app/(root)/app-blocking.tsx: the settings layout. */
export const styles = StyleSheet.create({
    content: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, paddingBottom: Spacing.bottom, gap: Spacing.md },
    /** The hold-to-unlock button, centred under the groups. */
    unlock: { gap: Spacing.sm, alignItems: 'stretch', paddingTop: Spacing.md },
});
