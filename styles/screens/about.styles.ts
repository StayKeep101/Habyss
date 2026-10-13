import { StyleSheet } from 'react-native';
import { FontFamily, UIStyles, Radius } from '@/constants/DesignSystem';

/** The look of app/(root)/about.tsx. Values are exactly what the screen used. */
export const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: { ...UIStyles.screenContent,

        alignItems: 'center',
     },
    logoSection: {
        alignItems: 'center',
        marginTop: 24,
        marginBottom: 16,
    },
    logoMark: {
        width: 84,
        height: 84,
        borderRadius: 42,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        marginBottom: 16,
    },
    logoImage: { width: 134, height: 134 },
    appName: {
        fontSize: 28,
        fontFamily: FontFamily.bold,
    },
    version: {
        fontSize: 13,
        fontFamily: FontFamily.regular,
        marginTop: 4,
    },
    tagline: {
        fontSize: 15,
        textAlign: 'center',
        fontFamily: FontFamily.regular,
        marginBottom: 32,
    },
    card: {
        borderRadius: Radius.card,
        borderWidth: 1,
        overflow: 'hidden',
        width: '100%',
    },
    linkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    linkText: {
        flex: 1,
        fontSize: 15,
        fontFamily: FontFamily.regular,
    },
    divider: {
        height: 1,
        marginHorizontal: 16,
    },
    footer: {
        fontSize: 12,
        fontFamily: FontFamily.regular,
        marginTop: 32,
    },
});
