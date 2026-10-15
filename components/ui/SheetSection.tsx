import { Typography, Spacing, UIStyles } from '@/theme/designSystem';
import React from 'react';
import { StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';

interface SheetSectionProps {
    title: string;
    /** One line explaining what the section is for, as on AI Configuration. */
    description?: string;
    children?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    first?: boolean;
}

/**
 * Section heading used inside sheets and settings screens: the shared bold
 * sentence-case title with an optional plain-language description underneath.
 */
export const SheetSection: React.FC<SheetSectionProps> = ({ title, description, children, style, first }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];

    return (
        <View style={[{ marginTop: first ? Spacing.xs : Spacing.xxl }, style]}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
            {description ? (
                <Text style={[styles.description, { color: colors.textTertiary }]}>{description}</Text>
            ) : null}
            {children ? <View style={{ marginTop: description ? 12 : 10 }}>{children}</View> : null}
        </View>
    );
};

const styles = StyleSheet.create({
    title: { ...UIStyles.sectionTitle, marginBottom: Spacing.xs },
    description: Typography.bodySmall,
});
