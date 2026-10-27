import { StyleSheet } from 'react-native';
import { FontFamily } from '@/theme/designSystem';

/** The look of app/(root)/habit-detail.tsx. Values are exactly what the screen used. */
export const styles = StyleSheet.create({
    flex: { flex: 1 },
    swapped: { gap: 18 },
    /** The focus button, in the bottom-right corner. */
    focusCorner: { position: 'absolute', right: 20, bottom: 28 },
    headerActions: { flexDirection: 'row', gap: 4 },
    content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 64, gap: 24 },
    danger: { marginTop: 16 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    retry: { minHeight: 44, padding: 12, alignItems: 'center', justifyContent: 'center' },
    rhythm: { paddingVertical: 12, paddingHorizontal: 10 },
    week: { flexDirection: 'row', gap: 2 },
    day: { flex: 1, paddingVertical: 8, borderRadius: 14, gap: 5, alignItems: 'center', justifyContent: 'center' },
    weekday: { fontFamily: FontFamily.medium, fontSize: 11 },
    dayCircle: { width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    dayNumber: { fontFamily: FontFamily.regular, fontSize: 12 },
    todayDot: { width: 3, height: 3, borderRadius: 2 },
    divider: { height: StyleSheet.hairlineWidth, marginVertical: 8, marginHorizontal: 4 },
    statRow: { flexDirection: 'row' },
    stat: { flex: 1, alignItems: 'center', gap: 1, paddingHorizontal: 4 },
    statTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    statValue: { fontFamily: FontFamily.display, fontSize: 19, lineHeight: 26, fontVariant: ['tabular-nums'] },
    statLabel: { fontFamily: FontFamily.regular, fontSize: 11, textAlign: 'center' },
    heatmap: { padding: 16 },
});
