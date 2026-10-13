import { StyleSheet } from 'react-native';
import { FontFamily } from '@/theme/designSystem';

/** The look of app/(root)/onboarding-paywall.tsx. Values are exactly what the screen used. */
export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    centered: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    title: {
        color: '#fff',
        fontSize: 20,
        fontFamily: FontFamily.bold,
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitle: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        textAlign: 'center',
    },
});
