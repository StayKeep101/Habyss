import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform, DeviceEventEmitter } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

interface TabIconProps {
    routeName: string;
    focused: boolean;
    colors: [string, string]; // Accent gradient colors
    isDark: boolean;
}

const TabIcon = ({ routeName, focused, colors, isDark }: TabIconProps) => {
    const scale = useSharedValue(focused ? 1 : 1);

    React.useEffect(() => {
        scale.value = withSpring(focused ? 1.15 : 1);
    }, [focused]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    // Get Ionicons name based on route
    const getIconName = (): keyof typeof Ionicons.glyphMap => {
        switch (routeName) {
            case 'home':
                return focused ? 'home' : 'home-outline';
            case 'roadmap':
                return focused ? 'map' : 'map-outline';
            case 'community':
                return focused ? 'people' : 'people-outline';
            case 'settings':
                return focused ? 'settings' : 'settings-outline';
            default:
                return 'home-outline';
        }
    };

    // When focused, use accent color; otherwise white for dark mode, dark for light mode
    const iconColor = focused
        ? colors[0]
        : (isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)');

    return (
        <Animated.View style={[animatedStyle, styles.iconContainer]}>
            <Ionicons name={getIconName()} size={24} color={iconColor} />
            {/* Dot removed per request */}
        </Animated.View>
    );
};

export const GlassDock = ({ state, descriptors, navigation }: any) => {
    const { theme } = useTheme();
    const { colors: accentColors, shadowColor } = useAccentGradient();
    const { mediumFeedback } = useHaptics();
    const { horizontalPadding, tabBarHeight, floatingButtonSize, tabBarBottomOffset, isCompactWidth } = useResponsiveLayout();

    return (
        <View style={[
            styles.container,
            {
                bottom: tabBarBottomOffset,
                paddingHorizontal: horizontalPadding,
                gap: isCompactWidth ? 10 : 12,
            }
        ]}>

            {/* 1. Navigation Pill */}
            <BlurView intensity={Platform.OS === 'ios' ? 80 : 40} tint={theme === 'light' ? 'light' : 'dark'} style={[
                styles.navPill,
                {
                    height: tabBarHeight,
                    borderRadius: tabBarHeight / 2,
                    paddingHorizontal: isCompactWidth ? 12 : 16,
                    maxWidth: isCompactWidth ? 236 : 260,
                },
                { backgroundColor: theme === 'light' ? 'rgba(255, 255, 255, 0.75)' : (Platform.OS === 'android' ? 'rgba(10, 15, 20, 0.95)' : 'rgba(10, 15, 20, 0.75)') }
            ]}>
                <View style={[styles.glassBorder, { borderRadius: tabBarHeight / 2, borderColor: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)' }]} />

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
                                mediumFeedback();
                                navigation.navigate(route.name);
                            }
                        };

                        return (
                            <TouchableOpacity
                                key={route.key}
                                activeOpacity={0.7}
                                onPress={onPress}
                                style={[
                                    styles.tabButton,
                                    {
                                        width: isCompactWidth ? 44 : 48,
                                        height: isCompactWidth ? 44 : 48,
                                    }
                                ]}
                            >
                                <TabIcon
                                    routeName={route.name}
                                    focused={isFocused}
                                    colors={accentColors}
                                    isDark={theme !== 'light'}
                                />
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </BlurView>

            {/* 2. Creation Orb (Plus Button) - Uses accent gradient */}
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                    mediumFeedback();
                    DeviceEventEmitter.emit('show_creation_modal');
                }}
                style={[
                    styles.orbContainer,
                    {
                        width: floatingButtonSize,
                        height: floatingButtonSize,
                        borderRadius: floatingButtonSize / 2,
                        shadowColor,
                    }
                ]}
            >
                <LinearGradient
                    colors={accentColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.orbGradient, { borderRadius: floatingButtonSize / 2 }]}
                >
                    <Ionicons name="add" size={isCompactWidth ? 28 : 32} color="#fff" />
                </LinearGradient>
            </TouchableOpacity>

        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    navPill: {
        flex: 1,
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',

        // backgroundColor set inline for dynamic theme
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 10,
    },
    glassBorder: {
        ...StyleSheet.absoluteFillObject,
        borderWidth: 1,
        // borderColor set inline
        pointerEvents: 'none',
    },
    tabsRow: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        flex: 1,
    },
    tabButton: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    focusDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        marginTop: 4,
    },
    orbContainer: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 10,
    },
    orbGradient: {
        flex: 1,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    }
});
