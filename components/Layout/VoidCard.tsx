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
    const isTrueDark = theme === 'trueDark';

    const containerStyle = [
        styles.card,
        {
            backgroundColor: glass
                ? isLight
                    ? 'rgba(255,255,255,0.84)'
                    : isTrueDark
                        ? 'rgba(255,255,255,0.03)'
                        : 'transparent'
                : isLight
                    ? colors.surface
                    : colors.surfaceSecondary,
            borderColor: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.07)',
        },
        isLight && {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.06,
            shadowRadius: 20,
            elevation: 3,
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
        borderRadius: 22,
        borderWidth: 1,
        overflow: 'hidden',
    },
});
