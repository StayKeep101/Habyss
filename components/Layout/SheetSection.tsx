import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';

interface SheetSectionProps {
    title: string;
    /** One line explaining what the section is for, as on AI Configuration. */
    description?: string;
    children?: React.ReactNode;
    style?: ViewStyle;
    first?: boolean;
}

/**
 * Section heading used inside sheets and settings screens: a short uppercase
 * label with an optional plain-language description underneath.
 */
export const SheetSection: React.FC<SheetSectionProps> = ({ title, description, children, style, first }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];

    return (
        <View style={[{ marginTop: first ? 4 : 22 }, style]}>
            <Text style={[styles.title, { color: colors.textSecondary }]}>{title.toUpperCase()}</Text>
            {description ? (
                <Text style={[styles.description, { color: colors.textTertiary }]}>{description}</Text>
            ) : null}
            {children ? <View style={{ marginTop: description ? 12 : 10 }}>{children}</View> : null}
        </View>
    );
};

const styles = StyleSheet.create({
    title: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1.5,
        fontFamily: 'Lexend',
        marginBottom: 4,
    },
    description: {
        fontSize: 13,
        lineHeight: 18,
        fontFamily: 'Lexend_400Regular',
    },
});
