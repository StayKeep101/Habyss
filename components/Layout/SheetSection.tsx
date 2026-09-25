import { Typography, Spacing } from '@/constants/DesignSystem';
import React from 'react';
import { StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';

interface SheetSectionProps {
    title: string;
    /** One line explaining what the section is for, as on AI Configuration. */
    description?: string;
    children?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
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
        <View style={[{ marginTop: first ? Spacing.xs : Spacing.xxl }, style]}>
            <Text style={[styles.title, { color: colors.textSecondary }]}>{title.toUpperCase()}</Text>
            {description ? (
                <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>
            ) : null}
            {children ? <View style={{ marginTop: description ? 12 : 10 }}>{children}</View> : null}
        </View>
    );
};

const styles = StyleSheet.create({
    title: { ...Typography.label, marginBottom: Spacing.xs },
    description: Typography.bodySmall,
});
