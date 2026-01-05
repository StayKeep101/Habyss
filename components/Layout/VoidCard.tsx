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
            backgroundColor: glass ? 'transparent' : 'rgba(255,255,255,0.03)',
            borderColor: 'rgba(255,255,255,0.05)', // Much subtler default
        },
        style,
    ];

    if (glass) {
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
