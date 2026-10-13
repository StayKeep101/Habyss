import { StyleSheet } from 'react-native';
import { FontFamily, UIStyles, Radius } from '@/constants/DesignSystem';

/** The look of app/(root)/help.tsx. Values are exactly what the screen used. */
export const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: { ...UIStyles.screenContent },
    sectionTitle: UIStyles.sectionTitle,
    card: {
        borderRadius: Radius.card,
        borderWidth: 1,
        overflow: 'hidden',
    },
    faqItem: {
        padding: 16,
    },
    question: {
        fontSize: 15,
        fontFamily: FontFamily.semibold,
        marginBottom: 6,
    },
    answer: {
        fontSize: 13,
        fontFamily: FontFamily.regular,
        lineHeight: 20,
    },
    divider: {
        height: 1,
        marginHorizontal: 16,
    },
    contactBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: Radius.card,
        borderWidth: 1,
        gap: 12,
    },
    contactText: {
        flex: 1,
        fontSize: 15,
        fontFamily: FontFamily.semibold,
    },

});
