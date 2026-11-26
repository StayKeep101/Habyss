import { StyleSheet } from 'react-native';
import { FontFamily } from '@/theme/designSystem';
import { space } from '@/theme/tokens';

/** The look of app/(root)/legal.tsx. */
export const styles = StyleSheet.create({
    content: { paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space['4xl'], gap: space.md },
    intro: { fontSize: 15, lineHeight: 22, fontFamily: FontFamily.regular },
    updated: { fontSize: 12, fontFamily: FontFamily.medium },
    card: { padding: space.lg, gap: space.xs },
    title: { fontSize: 16, fontFamily: FontFamily.bold },
    body: { fontSize: 14, lineHeight: 21, fontFamily: FontFamily.regular },
});
