import { StyleSheet } from 'react-native';
import { FontFamily, Spacing } from '@/theme/designSystem';

/** The look of app/(root)/friend.tsx — the profile page's own layout, plus status and actions. */
export const styles = StyleSheet.create({
    content: { paddingBottom: Spacing.bottom, gap: Spacing.md },
    back: { position: 'absolute', left: Spacing.xl },
    more: { position: 'absolute', right: Spacing.xl },
    status: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2, paddingTop: Spacing.xs },
    /** Their year and awards, laid out as on your own profile. */
    year: { marginTop: Spacing.xl, alignSelf: 'stretch' },
    awards: { marginHorizontal: Spacing.xl, marginTop: Spacing.xxl },
    statusText: { fontFamily: FontFamily.semibold, fontSize: 13 },
    actions: { marginHorizontal: Spacing.xl, marginTop: Spacing.lg },
});
