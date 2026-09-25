import { Typography, Spacing } from '@/constants/DesignSystem';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';

interface ScreenHeaderProps {
    title: string;
    subtitle?: string;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, subtitle }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { foreground: accentColor } = useAccentGradient();

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>
                    {title}
                </Text>
                {subtitle && (
                    <Text style={[styles.subtitle, { color: accentColor }]}>
                        {subtitle}
                    </Text>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: Spacing.xxl,
    },
    content: {
    },
    title: Typography.screenTitle,
    subtitle: {
        ...Typography.label,
        marginTop: Spacing.xs,
    },
});
