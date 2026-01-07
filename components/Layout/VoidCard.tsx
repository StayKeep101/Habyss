import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { BlurView } from 'expo-blur';

interface VoidCardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    glass?: boolean;
    intensity?: number;
}

export const VoidCard: React.FC<VoidCardProps> = ({ children, style, glass = false, intensity = 20 }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];

    const containerStyle = [
        styles.card,
        {
            backgroundColor: glass ? 'transparent' : colors.surface,
            borderColor: colors.border,
        },
        style,
    ];

    if (glass) {
        return (
            <BlurView intensity={intensity} tint={theme === 'light' ? 'light' : 'dark'} style={containerStyle}>
                {children}
            </BlurView>
        );
    }

    return (
        <View style={containerStyle}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 24,
        borderWidth: 1,
        overflow: 'hidden',
    },
});
