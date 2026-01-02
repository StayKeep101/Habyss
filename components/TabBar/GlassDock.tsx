import React from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

const TabIcon = ({ name, focused, color }: { name: any, focused: boolean, color: string }) => {
    const scale = useSharedValue(focused ? 1 : 1);

    React.useEffect(() => {
        scale.value = withSpring(focused ? 1.2 : 1);
    }, [focused]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <Animated.View style={[animatedStyle, styles.iconContainer]}>
            <Ionicons name={name} size={24} color={color} />
            {focused && <View style={[styles.glowDot, { backgroundColor: color }]} />}
        </Animated.View>
    );
};

export const GlassDock = ({ state, descriptors, navigation }: any) => {
    const { theme } = useTheme();
    const colors = Colors[theme];

    // Separate routes into navigatable tabs vs actions
    // We assume the standard order: Home, Roadmap, Statistics, Settings
    // And we want to pull out the middle "action" we artificially injected before, 
    // or just render the tabs in the pill and the CREATE action in the orb.

    // Actually, the route config has 4 tabs. 
    // We will render all 4 routes in the Pill, and the Create button in the separate Orb.

    return (
        <View style={styles.container}>

            {/* 1. Navigation Pill (Left) */}
            <BlurView intensity={Platform.OS === 'ios' ? 80 : 40} tint="dark" style={styles.navPill}>
                <View style={styles.glassBorder} />

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

                        let iconName: any = 'square';
                        if (route.name === 'home') iconName = isFocused ? 'home' : 'home-outline';
                        if (route.name === 'roadmap') iconName = isFocused ? 'calendar' : 'calendar-outline';
                        if (route.name === 'statistics') iconName = isFocused ? 'people' : 'people-outline';
                        if (route.name === 'settings') iconName = isFocused ? 'person' : 'person-outline';

                        const iconColor = isFocused ? '#fff' : 'rgba(255,255,255,0.4)';

                        return (
                            <TouchableOpacity
                                key={route.key}
                                activeOpacity={0.7}
                                onPress={onPress}
                                style={styles.tabButton}
                            >
                                <TabIcon name={iconName} focused={isFocused} color={iconColor} />
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </BlurView>

            {/* 2. Creation Orb (Right) */}
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    navigation.navigate('create');
                }}
                style={styles.orbContainer}
            >
                {/* Gradient Background for Orb */}
                <LinearGradient
                    colors={['#8B5CF6', '#2DD4BF']} // Violet to Teal/Cyan (Premium)
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.orbGradient}
                >
                    <Ionicons name="add" size={32} color="#fff" />
                </LinearGradient>
            </TouchableOpacity>

        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 30,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        gap: 16, // Space between Pill and Orb
    },
    navPill: {
        flex: 1,
        height: 72,
        borderRadius: 40,
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        backgroundColor: Platform.OS === 'android' ? 'rgba(10, 15, 20, 0.95)' : 'rgba(10, 15, 20, 0.75)',
        // Subtle shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 10,
    },
    glassBorder: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 40,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        pointerEvents: 'none',
    },
    tabsRow: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 24, // Consistent spacing between icons
    },
    tabButton: {
        width: 44, // Fixed width touch target
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
    },
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    glowDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        marginTop: 4,
        position: 'absolute',
        bottom: -8,
        shadowColor: "#fff",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
    },
    orbContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        shadowColor: "#2DD4BF",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 10,
    },
    orbGradient: {
        flex: 1,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    }
});
