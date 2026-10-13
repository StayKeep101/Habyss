import { StyleSheet } from 'react-native';
import { FontFamily, UIStyles } from '@/constants/DesignSystem';

/** The look of app/(root)/ai-config.tsx. Values are exactly what the screen used. */
export const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: { ...UIStyles.screenContent },
    sectionHeader: {
        marginBottom: 12,
    },
    sectionTitle: UIStyles.sectionTitle,
    list: {
        gap: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 14,
        borderWidth: 1,
    },
    rowTitleLine: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    iconBox: {
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emoji: {
        fontSize: 20,
    },
    modeName: {
        fontSize: 15,
        fontFamily: FontFamily.bold,
    },
    modeDesc: {
        fontSize: 12,
        fontFamily: FontFamily.regular,
        opacity: 0.85,
        lineHeight: 17,
        marginTop: 3,
    },
    greetingChip: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        gap: 6,
        borderRadius: 12,
    },
    greetingLabel: {
        fontSize: 13,
        fontFamily: FontFamily.semibold,
    },
});
