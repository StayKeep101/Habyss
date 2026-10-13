import { StyleSheet } from 'react-native';
import { FontFamily } from '@/constants/DesignSystem';
import { ms, s, vs } from '@/constants/Layout';

/** The look of app/(root)/inbox.tsx. Values are exactly what the screen used. */
export const styles = StyleSheet.create({
    content: { paddingHorizontal: s(20), paddingBottom: vs(40) },
    list: { gap: vs(10) },
    row: { padding: s(14), gap: vs(10) },
    head: { flexDirection: 'row', alignItems: 'flex-start', gap: s(11) },
    badge: { width: s(38), height: s(38), borderRadius: s(19), overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    photo: { width: '100%', height: '100%' },
    text: { flex: 1, gap: vs(2) },
    title: { fontSize: ms(14), lineHeight: ms(20), fontFamily: FontFamily.semibold },
    body: { fontSize: ms(12), lineHeight: ms(18), fontFamily: FontFamily.regular },
    side: { alignItems: 'flex-end', gap: vs(4) },
    dot: { width: s(7), height: s(7), borderRadius: s(4) },
    when: { fontSize: ms(10), fontFamily: FontFamily.regular },
    actions: { flexDirection: 'row', gap: s(8) },
    action: { flex: 1, minHeight: 40, borderRadius: s(12), alignItems: 'center', justifyContent: 'center' },
    actionText: { fontSize: ms(13), fontFamily: FontFamily.semibold },
    clear: { alignSelf: 'flex-start', minHeight: 30, justifyContent: 'center' },
    clearText: { fontSize: ms(12), fontFamily: FontFamily.medium },
    empty: { alignItems: 'center', gap: vs(10), marginTop: vs(60), paddingHorizontal: s(30) },
    emptyText: { fontSize: ms(14), lineHeight: ms(20), fontFamily: FontFamily.regular, textAlign: 'center' },
});
