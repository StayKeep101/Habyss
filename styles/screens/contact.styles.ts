import { StyleSheet } from 'react-native';
import { FontFamily, UIStyles, Radius } from '@/theme/designSystem';

/** The look of app/(root)/contact.tsx. Values are exactly what the screen used. */
export const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: { ...UIStyles.screenContent },
    card: {
        borderRadius: Radius.card,
        borderWidth: 1,
        overflow: 'hidden',
    },
    linkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    linkText: {
        fontSize: 15,
        fontFamily: FontFamily.regular,
    },
    divider: {
        height: 1,
        marginHorizontal: 16,
    },
});
