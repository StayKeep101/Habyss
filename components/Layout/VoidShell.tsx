import React from 'react';
import { View, StyleSheet, StatusBar, AppState } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/constants/themeContext';
import { Colors } from '@/constants/Colors';
import Animated, { useSharedValue, withRepeat, withTiming, useAnimatedStyle, Easing, cancelAnimation } from 'react-native-reanimated';

interface VoidShellProps {
    children: React.ReactNode;
}

export const VoidShell: React.FC<VoidShellProps> = ({ children }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];

    // Subtle breathing animation for the background
    const opacity = useSharedValue(0.3);

    React.useEffect(() => {
        // Start animation
        opacity.value = withRepeat(
            withTiming(0.5, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );

        // Pause animation when app goes to background to save resources
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                opacity.value = withRepeat(
                    withTiming(0.5, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
                    -1,
                    true
                );
            } else {
                cancelAnimation(opacity);
            }
        });

        return () => {
            cancelAnimation(opacity);
            subscription.remove();
        };
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value
    }));

    // Stable structure to prevent unmounting of children on theme switch
    return (
        <View style={[styles.container, { backgroundColor: theme === 'light' ? colors.background : (theme === 'trueDark' ? '#000000' : '#000000') }]}>
            <StatusBar barStyle={theme === 'light' ? "dark-content" : "light-content"} />

            {/* Background Layer - Entirely contained in absolute fill to avoid shifting children index */}
            <View style={[StyleSheet.absoluteFill, { zIndex: 0 }]}>
                {theme === 'light' && (
                    <>
                        {/* Light Mode Gradient Base */}
                        <LinearGradient
                            colors={['#FFFFFF', '#F5F7FA', '#E8EEF5']}
                            style={[StyleSheet.absoluteFill]}
                            start={{ x: 0.5, y: 0 }}
                            end={{ x: 0.5, y: 1 }}
                        />
                        {/* Subtle top glow */}
                        <LinearGradient
                            colors={['rgba(59, 130, 246, 0.05)', 'transparent']}
                            style={[StyleSheet.absoluteFill, { height: '30%' }]}
                            start={{ x: 0.5, y: 0 }}
                            end={{ x: 0.5, y: 1 }}
                        />
                    </>
                )}

                {theme === 'abyss' && (
                    <>
                        {/* Deep Void Base - Uniform color */}
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0A0F14' }]} />

                        {/* Bottom Mist (Subtle glow) */}
                        <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
                            <LinearGradient
                                colors={['transparent', 'rgba(139, 173, 214, 0.08)']}
                                style={[StyleSheet.absoluteFill, { top: '60%' }]}
                                start={{ x: 0.5, y: 0 }}
                                end={{ x: 0.5, y: 1 }}
                            />
                        </Animated.View>
                    </>
                )}
            </View>

            {/* Content Layer - ZIndex ensures it sits above background */}
            <View style={{ flex: 1, zIndex: 1 }}>
                {children}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    }
});
