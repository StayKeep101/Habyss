import React from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, withSpring, useSharedValue, withTiming, interpolateColor } from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

const TabIcon = ({ name, focused, color }: { name: any, focused: boolean, color: string }) => {
    const scale = useSharedValue(focused ? 1.2 : 1);

    // React to focus changes
    React.useEffect(() => {
        scale.value = withSpring(focused ? 1.2 : 1, { damping: 12 });
    }, [focused]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
        };
    });

    return (
        <Animated.View style={[animatedStyle, styles.iconContainer]}>
            <Ionicons name={name} size={24} color={color} />
            {focused && <View style={[styles.dot, { backgroundColor: color }]} />}
        </Animated.View>
    );
};

export const GlassDock = ({ state, descriptors, navigation }: any) => {
    const { theme } = useTheme();
    const colors = Colors[theme];

    return (
        <View style={styles.container}>
            <BlurView intensity={Platform.OS === 'ios' ? 80 : 40} tint="dark" style={styles.blurContainer}>
                <LinearGradient
                    colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                    style={styles.gradientBorder}
                />

                <View style={styles.tabsRow}>
                    {state.routes.map((route: any, index: number) => {
                        const { options } = descriptors[route.key];
                        const isFocused = state.index === index;

                        const onPress = () => {
                            const event = navigation.emit({
                                type: 'tabPress',
                                target: route.key,
                                canPreventDefault: true,
                            });

                            if (!isFocused && !event.defaultPrevented) {
                                Haptics.selectionAsync();
                                navigation.navigate(route.name);
                            }
                        };

                        let iconName = 'square';
                        if (route.name === 'home') iconName = isFocused ? 'home' : 'home-outline';
                        if (route.name === 'roadmap') iconName = isFocused ? 'map' : 'map-outline';
                        if (route.name === 'statistics') iconName = isFocused ? 'stats-chart' : 'stats-chart-outline';
                        if (route.name === 'settings') iconName = isFocused ? 'settings' : 'settings-outline';
                        // settings is handled in home footer usually, but if it was a tab...
                        // Let's assume standard tabs for now based on current _layout

                        const iconColor = isFocused ? colors.primaryLight : 'rgba(255,255,255,0.5)';

                        return (
                            <TouchableOpacity
                                key={index}
                                activeOpacity={0.8}
                                onPress={onPress}
                                style={styles.tabButton}
                            >
                                <TabIcon name={iconName} focused={isFocused} color={iconColor} />
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </BlurView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 34,
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    blurContainer: {
        width: '100%',
        maxWidth: 380,
        borderRadius: 40,
        overflow: 'hidden',
        height: 80,
        justifyContent: 'center',
        // Deep shadow with bioluminescent hint
        shadowColor: "#00F0FF", // Electric Cyan Shadow
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15, // Subtle glow
        shadowRadius: 24,
        elevation: 12,
        backgroundColor: Platform.OS === 'android' ? 'rgba(18, 24, 38, 0.9)' : 'rgba(18, 24, 38, 0.4)', // Abyssal Navy
    },
    gradientBorder: {
        ...StyleSheet.absoluteFillObject,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)', // Glass White
        borderRadius: 40,
    },
    tabsRow: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        height: '100%',
        paddingHorizontal: 10,
    },
    tabButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
    },
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 50,
        height: 50,
    },
    dot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        position: 'absolute',
        bottom: 8,
        shadowColor: "white",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
    }
});
