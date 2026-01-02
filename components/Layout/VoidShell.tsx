import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/constants/themeContext';
import { Colors } from '@/constants/Colors';
import Animated, { useSharedValue, withRepeat, withTiming, useAnimatedStyle, Easing } from 'react-native-reanimated';

interface VoidShellProps {
    children: React.ReactNode;
}

export const VoidShell: React.FC<VoidShellProps> = ({ children }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];

    // Subtle breathing animation for the background
    const opacity = useSharedValue(0.3);

    React.useEffect(() => {
        opacity.value = withRepeat(
            withTiming(0.5, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value
    }));

    if (theme === 'light') {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <StatusBar barStyle="dark-content" />
                {children}
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Deep Void Base */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000' }]} />

            {/* Top Light */}
            <LinearGradient
                colors={[colors.primary + '10', 'transparent']} // Very subtle top glow
                style={[StyleSheet.absoluteFill, { height: '40%' }]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
            />

            {/* Bottom Mist */}
            <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
                <LinearGradient
                    colors={['transparent', colors.primary + '20']}
                    style={[StyleSheet.absoluteFill, { top: '60%' }]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                />
            </Animated.View>

            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    }
});
