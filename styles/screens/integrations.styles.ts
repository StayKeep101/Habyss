import { StyleSheet } from 'react-native';
import { FontFamily } from '@/theme/designSystem';
import { ms, s, vs } from '@/theme/scale';

/** The look of app/(root)/integrations.tsx. Values are exactly what the screen used. */
export const styles = StyleSheet.create({
    content: { paddingHorizontal: s(20), paddingBottom: vs(40), gap: vs(18) },
    hero: { padding: s(16), gap: vs(10) },
    heroTop: { flexDirection: 'row', alignItems: 'center', gap: s(12) },
    heroIcon: { width: s(40), height: s(40), borderRadius: s(20), alignItems: 'center', justifyContent: 'center' },
    heroText: { flex: 1, gap: vs(2) },
    heroTitle: { fontSize: ms(16), fontFamily: FontFamily.semibold },
    heroLine: { fontSize: ms(12), lineHeight: ms(17), fontFamily: FontFamily.regular },
    filled: { fontSize: ms(12), lineHeight: ms(17), fontFamily: FontFamily.medium },
    group: { gap: vs(6) },
    groupTitle: { fontSize: ms(10), letterSpacing: 1.4, fontFamily: FontFamily.bold },
    groupNote: { fontSize: ms(11), lineHeight: ms(16), fontFamily: FontFamily.regular, marginBottom: vs(2) },
    list: { paddingVertical: vs(4) },
    divider: { height: StyleSheet.hairlineWidth, marginLeft: s(58) },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: s(11), padding: s(13) },
    icon: { width: s(32), height: s(32), borderRadius: s(10), alignItems: 'center', justifyContent: 'center' },
    rowText: { flex: 1, gap: vs(2) },
    name: { fontSize: ms(14), fontFamily: FontFamily.medium },
    covers: { fontSize: ms(11), lineHeight: ms(16), fontFamily: FontFamily.regular },
    step: { fontSize: ms(11), lineHeight: ms(16), fontFamily: FontFamily.regular, fontStyle: 'italic' },
    route: { fontSize: ms(10), fontFamily: FontFamily.semibold, maxWidth: s(78), textAlign: 'right' },
    footnote: { fontSize: ms(11), lineHeight: ms(17), fontFamily: FontFamily.regular },
});
