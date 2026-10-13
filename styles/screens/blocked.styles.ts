import { StyleSheet } from 'react-native';
import { FontFamily } from '@/theme/designSystem';
import { ms, s, vs } from '@/theme/scale';

/** The look of app/(root)/blocked.tsx. Values are exactly what the screen used. */
export const styles = StyleSheet.create({
    content: { paddingHorizontal: s(20), paddingBottom: vs(40), gap: vs(12) },
    list: { gap: vs(8) },
    row: { flexDirection: 'row', alignItems: 'center', gap: s(12), padding: s(12) },
    avatar: { width: s(38), height: s(38), borderRadius: s(19), overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    photo: { width: '100%', height: '100%' },
    initial: { fontSize: ms(15), fontFamily: FontFamily.bold },
    name: { flex: 1, fontSize: ms(15), fontFamily: FontFamily.medium },
    action: { minHeight: 36, paddingHorizontal: s(14), justifyContent: 'center', borderRadius: s(10), borderWidth: StyleSheet.hairlineWidth },
    actionText: { fontSize: ms(12), fontFamily: FontFamily.medium },
    empty: { fontSize: ms(14), lineHeight: ms(20), fontFamily: FontFamily.regular, textAlign: 'center', marginTop: vs(30) },
    note: { flexDirection: 'row', gap: s(7), marginTop: vs(6), paddingHorizontal: s(2) },
    noteText: { flex: 1, fontSize: ms(11), lineHeight: ms(16), fontFamily: FontFamily.regular },
});
