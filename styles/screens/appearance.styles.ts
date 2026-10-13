import { StyleSheet } from 'react-native';
import { FontFamily, UIStyles, Radius } from '@/theme/designSystem';

/** The look of app/(root)/appearance.tsx. Values are exactly what the screen used. */
export const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { ...UIStyles.screenContent },
    sectionTitle: UIStyles.sectionTitle,
    sectionDesc: UIStyles.sectionDescription,
    card: {
        borderRadius: Radius.card,
        borderWidth: 1,
        overflow: 'hidden',
    },
    themeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    themeName: {
        fontSize: 15,
        fontFamily: FontFamily.semibold,
    },
    themeDesc: {
        fontSize: 11,
        fontFamily: FontFamily.regular,
        marginTop: 2,
    },
    divider: {
        height: 1,
        marginHorizontal: 16,
    },
    // Gradient Grid
    gradientGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    gradientCell: {
        width: 56,
        height: 56,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    gradientInner: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkContainer: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    gradientName: {
        fontSize: 13,
        marginTop: 12,
        marginLeft: 4,
        fontFamily: FontFamily.regular,
    },
    // Card Size
    sizeRow: {
        flexDirection: 'row',
        gap: 12,
    },
    sizeBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
    },
    sizeBtnText: {
        fontSize: 14,
        fontFamily: FontFamily.semibold,
    },
});
