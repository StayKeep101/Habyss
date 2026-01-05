import React from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions, Platform, Alert, DeviceEventEmitter } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Home, Calendar, Users, User, Plus } from 'lucide-react-native';
import Animated, { useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';


const { width } = Dimensions.get('window');

interface TabIconProps {
    routeName: string;
    focused: boolean;
    color: string;
}

const TabIcon = ({ routeName, focused, color }: TabIconProps) => {
    const scale = useSharedValue(focused ? 1 : 1);

    React.useEffect(() => {
        scale.value = withSpring(focused ? 1.2 : 1);
    }, [focused]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const getIcon = () => {
        const size = 22;
        const strokeWidth = focused ? 2 : 1.5;

        switch (routeName) {
            case 'home':
                return <Home size={size} color={color} strokeWidth={strokeWidth} />;
            case 'roadmap':
                return <Calendar size={size} color={color} strokeWidth={strokeWidth} />;
            case 'community':
                return <Users size={size} color={color} strokeWidth={strokeWidth} />;
            case 'settings':
                return <User size={size} color={color} strokeWidth={strokeWidth} />;
            default:
                return <Home size={size} color={color} strokeWidth={strokeWidth} />;
        }
    };

    return (
        <Animated.View style={[animatedStyle, styles.iconContainer]}>
            {getIcon()}
        </Animated.View>
    );
};

import { useHaptics } from '@/hooks/useHaptics';

export const GlassDock = ({ state, descriptors, navigation }: any) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { mediumFeedback, selectionFeedback } = useHaptics();

    return (
        <View style={styles.container}>

            {/* 1. Navigation Pill */}
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
                                selectionFeedback();
                                navigation.navigate(route.name);
                            }
                        };

                        const iconColor = isFocused ? '#8BADD6' : 'rgba(255,255,255,0.4)';

                        return (
                            <TouchableOpacity
                                key={route.key}
                                activeOpacity={0.7}
                                onPress={onPress}
                                style={styles.tabButton}
                            >
                                <TabIcon routeName={route.name} focused={isFocused} color={iconColor} />
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </BlurView>

            {/* 2. Creation Orb (Plus Button) */}
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                    mediumFeedback();
                    // Emit event for home.tsx to show creation modal
                    DeviceEventEmitter.emit('show_creation_modal');
                }}
                style={styles.orbContainer}
            >
                <LinearGradient
                    colors={['#3A5A8C', '#8BADD6']}
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
        backgroundColor: Platform.OS === 'android' ? 'rgba(10, 15, 20, 0.95)' : 'rgba(10, 15, 20, 0.75)',
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
        borderColor: 'rgba(255,255,255,0.08)',
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
        width: 64,
        height: 64,
        borderRadius: 32,
        shadowColor: "#8BADD6",
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
