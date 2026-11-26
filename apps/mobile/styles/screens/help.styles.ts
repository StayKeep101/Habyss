import { StyleSheet } from 'react-native';
import { FontFamily } from '@/theme/designSystem';
import { space } from '@/theme/tokens';

/** The look of app/(root)/help.tsx. */
export const styles = StyleSheet.create({
    content: { paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space['4xl'], gap: space['2xl'] },
    question: { paddingVertical: space.lg, gap: space.xs },
    q: { fontSize: 15, fontFamily: FontFamily.medium },
    a: { fontSize: 14, lineHeight: 20, fontFamily: FontFamily.regular },
    footer: { alignItems: 'center' },
    version: { fontSize: 12, fontFamily: FontFamily.regular },
});
