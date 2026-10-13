import { StyleSheet } from 'react-native';
import { FontFamily, UIStyles } from '@/constants/DesignSystem';

/** The look of app/(root)/goal-roadmap.tsx. Values are exactly what the screen used. */
export const styles = StyleSheet.create({
    content: { ...UIStyles.screenContent,   gap: 12  },
    card: { padding: 14, gap: 8 },
    goalRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    goalName: { fontSize: 15, fontFamily: FontFamily.semibold },
    meta: { fontSize: 12, fontFamily: FontFamily.regular, marginTop: 2 },
    progress: { fontSize: 14, fontFamily: FontFamily.semibold },
    section: { fontSize: 10, letterSpacing: 1.2, fontFamily: FontFamily.medium },
    branch: { marginLeft: 16, paddingLeft: 14, borderLeftWidth: 2, gap: 2 },
    leaf: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
    leafText: { flex: 1, fontSize: 13, fontFamily: FontFamily.regular },
    overdue: { fontSize: 11, color: '#EF4444', fontFamily: FontFamily.medium },
    empty: { fontSize: 14, fontFamily: FontFamily.regular, textAlign: 'center', marginTop: 40 },
});
