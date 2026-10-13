import { StyleSheet } from 'react-native';
import { FontFamily, UIStyles } from '@/theme/designSystem';

/** The look of app/(root)/all-habits.tsx. Values are exactly what the screen used. */
export const styles = StyleSheet.create({
    filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
    chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
    content: { ...UIStyles.screenContent,   gap: 8  },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
    icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    name: { fontSize: 15, fontFamily: FontFamily.medium },
    meta: { fontSize: 12, fontFamily: FontFamily.regular, marginTop: 3 },
    empty: { fontSize: 14, fontFamily: FontFamily.regular, textAlign: 'center', marginTop: 40 },
});
