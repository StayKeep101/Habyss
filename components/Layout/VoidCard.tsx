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
    const isLight = theme === 'light';

    const containerStyle = [
        styles.card,
        {
            backgroundColor: glass ? (isLight ? 'rgba(255,255,255,0.9)' : 'transparent') : colors.surface,
            borderColor: isLight ? 'rgba(0,0,0,0.08)' : colors.border,
        },
        isLight && {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 2,
        },
        style,
    ];

    if (glass && !isLight) {
        return (
            <BlurView intensity={intensity} tint="dark" style={containerStyle}>
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
