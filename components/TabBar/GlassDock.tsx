import React from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions, Platform, DeviceEventEmitter } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';

const { width } = Dimensions.get('window');

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
                return focused ? 'settings' : 'settings-outline'; // Gear icon
            default:
                return 'home-outline';
        }
    };

    const iconColor = focused ? colors[0] : (
        // Check if we can access theme here, otherwise pass it as prop or context
        // TabIcon is inside GlassDock which has theme access, but separate component.
        // Let's pass theme or determine color based on context if possible, but keep simple.
        // We will pass 'isDark' prop to TabIcon or just fix it in parent.
        // Actually, let's fix in parent.
        'rgba(255,255,255,0.4)' // Default invalid, will override in parent
    );

    return (
        <Animated.View style={[animatedStyle, styles.iconContainer]}>
            <Ionicons name={getIconName()} size={24} color={iconColor} />
            {focused && (
                <View style={[styles.focusDot, { backgroundColor: colors[0] }]} />
            )}
        </Animated.View>
    );
};

export const GlassDock = ({ state, descriptors, navigation }: any) => {
    const { theme } = useTheme();
    const themeColors = Colors[theme];
    const { colors: accentColors, shadowColor } = useAccentGradient();
    const { mediumFeedback, selectionFeedback } = useHaptics();

    return (
        <View style={styles.container}>

            {/* 1. Navigation Pill */}
            <BlurView intensity={Platform.OS === 'ios' ? 80 : 40} tint={theme === 'light' ? 'light' : 'dark'} style={[
                styles.navPill,
                { backgroundColor: theme === 'light' ? 'rgba(255, 255, 255, 0.75)' : (Platform.OS === 'android' ? 'rgba(10, 15, 20, 0.95)' : 'rgba(10, 15, 20, 0.75)') }
            ]}>
                <View style={[styles.glassBorder, { borderColor: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)' }]} />

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
                                selectionFeedback();
                                navigation.navigate(route.name);
                            }
                        };

                        return (
                            <TouchableOpacity
                                key={route.key}
                                activeOpacity={0.7}
                                onPress={onPress}
                                style={styles.tabButton}
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
                style={[styles.orbContainer, { shadowColor }]}
            >
                <LinearGradient
                    colors={accentColors}
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
        paddingHorizontal: 20,
        gap: 12,
    },
    navPill: {
        flex: 1,
        maxWidth: 260,
        height: 64,
        borderRadius: 32,
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,

        // backgroundColor set inline for dynamic theme
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 10,
    },
    glassBorder: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 32,
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
        width: 48,
        height: 48,
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
        width: 64,
        height: 64,
        borderRadius: 32,
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
