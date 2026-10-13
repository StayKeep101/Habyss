import { StyleSheet } from 'react-native';
import { FontFamily } from '@/constants/DesignSystem';

/** The look of app/(root)/add-friend.tsx. Values are exactly what the screen used. */
export const styles = StyleSheet.create({
    safe: { flex: 1, paddingHorizontal: 16, justifyContent: 'center' },
    close: { position: 'absolute', top: 60, right: 16, padding: 8, zIndex: 1 },
    card: { padding: 22, alignItems: 'center', gap: 12 },
    icon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 22, fontFamily: FontFamily.semibold },
    body: { fontSize: 14, lineHeight: 20, fontFamily: FontFamily.regular, textAlign: 'center' },
    button: { alignSelf: 'stretch', paddingVertical: 15, borderRadius: 999, alignItems: 'center', marginTop: 4 },
    buttonText: { fontSize: 15, fontFamily: FontFamily.semibold, color: '#000' },
});
