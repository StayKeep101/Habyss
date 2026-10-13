import { StyleSheet } from 'react-native';
import { FontFamily } from '@/theme/designSystem';
import { ms, s, vs } from '@/theme/scale';

/** The look of app/(root)/sharing.tsx. Values are exactly what the screen used. */
export const styles = StyleSheet.create({
    content: { paddingHorizontal: s(20), paddingBottom: vs(40), gap: vs(6) },
    groupTitle: { fontSize: ms(10), letterSpacing: 1.4, fontFamily: FontFamily.bold, marginTop: vs(14) },
    groupNote: { fontSize: ms(11), lineHeight: ms(16), fontFamily: FontFamily.regular, marginBottom: vs(4) },
    list: { paddingVertical: vs(2) },
    divider: { height: StyleSheet.hairlineWidth, marginLeft: s(14) },
    row: { flexDirection: 'row', alignItems: 'center', gap: s(12), padding: s(14) },
    rowText: { flex: 1, gap: vs(2) },
    label: { fontSize: ms(14), fontFamily: FontFamily.medium },
    detail: { fontSize: ms(11), lineHeight: ms(16), fontFamily: FontFamily.regular },
    note: { flexDirection: 'row', gap: s(7), marginTop: vs(12), paddingHorizontal: s(2) },
    noteText: { flex: 1, fontSize: ms(11), lineHeight: ms(16), fontFamily: FontFamily.regular },
});
