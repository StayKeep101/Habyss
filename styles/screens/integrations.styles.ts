import { StyleSheet } from 'react-native';
import { FontFamily } from '@/theme/designSystem';
import { space } from '@/theme/tokens';

/** The look of app/(root)/integrations.tsx. */
export const styles = StyleSheet.create({
    content: { paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space['4xl'], gap: space.md },
    filled: { fontSize: 13, fontFamily: FontFamily.regular, textAlign: 'center' },
});
