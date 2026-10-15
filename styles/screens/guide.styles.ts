import { StyleSheet } from 'react-native';
import { FontFamily } from '@/theme/designSystem';
import { space } from '@/theme/tokens';

/** The look of app/(root)/guide.tsx. */
export const styles = StyleSheet.create({
    content: { paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space['4xl'], gap: space.md },
    card: { flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.lg },
    text: { flex: 1, gap: 2 },
    title: { fontSize: 16, fontFamily: FontFamily.bold },
    body: { fontSize: 14, lineHeight: 20, fontFamily: FontFamily.regular },
});
