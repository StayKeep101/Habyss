import React from 'react';
import {View, TouchableOpacity, StyleSheet} from 'react-native';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { LinearGradient } from 'expo-linear-gradient';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import Animated, { useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { emit, on } from '@/lib/appEvents';
import { AppState } from 'react-native';
import { FriendsService } from '@/lib/friendsService';

interface TabIconProps {
    routeName: string;
    focused: boolean;
    colors: [string, string]; // Accent gradient colors
    isDark: boolean;
    foreground: string;
}

const TabIcon = ({ routeName, focused, colors, isDark, foreground, unread, background }: TabIconProps & { unread?: boolean; background: string }) => {
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
        ? foreground
        : (isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)');

    return (
        <Animated.View style={[animatedStyle, styles.iconContainer]}>
            <Ionicons name={getIconName()} size={24} color={iconColor} />
            {/* Something has happened and nobody has looked at it. A dot rather
                than a number: on a tab bar the question is only ever whether to
                go and look. */}
            {unread ? <View style={[styles.unread, { borderColor: background }]} /> : null}
        </Animated.View>
    );
};

export const GlassDock = ({ state, descriptors, navigation }: any) => {
    const { theme } = useTheme();
    const { colors: accentColors, shadowColor, foreground, buttonColors } = useAccentGradient();
    const palette = Colors[theme];
    const { mediumFeedback } = useHaptics();
    const { horizontalPadding, tabBarHeight, floatingButtonSize, tabBarBottomOffset, isCompactWidth } = useResponsiveLayout();
    const orbRef = React.useRef<any>(null);

    /**
     * Whether anything is waiting, for the dot on Community.
     *
     * Read here rather than passed down: the dock is the one component that is
     * on screen whatever anybody is doing, which makes it the only place a
     * notice can appear the moment it arrives.
     */
    const [unread, setUnread] = React.useState(0);
    React.useEffect(() => {
        let alive = true;
        const check = () => {
            FriendsService.unreadCount()
                .then(count => { if (alive) setUnread(count); })
                .catch(() => undefined);
        };
        check();
        const stop = on('social_state_updated', check);
        const app = AppState.addEventListener('change', state => { if (state === 'active') check(); });
        return () => { alive = false; stop.remove(); app.remove(); };
    }, []);

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
            {/* The fade the page sinks into, behind the dock: content dims as it
                scrolls underneath, the way Phantom's bottom edge does, so the
                dock floats over it instead of sitting on a hard line. */}
            <LinearGradient
                pointerEvents="none"
                colors={[palette.background + '00', palette.background + 'B3', palette.background + 'F2']}
                locations={[0, 0.45, 1]}
                style={[styles.fade, { bottom: -tabBarBottomOffset, height: tabBarBottomOffset + tabBarHeight + 56 }]}
            />

            {/* The matte card surface as a pill, floating on its shadow. */}
            <MatteSurface radius={tabBarHeight / 2} elevation="floating" style={[
                styles.navPill,
                {
                    height: tabBarHeight,
                    paddingHorizontal: isCompactWidth ? 12 : 16,
                    maxWidth: isCompactWidth ? 236 : 260,
                },
            ]}>

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
                                accessibilityRole="tab"
                                accessibilityLabel={options.title ?? route.name}
                                accessibilityHint={route.name === 'settings' ? 'Hold to send feedback' : undefined}
                                accessibilityState={{ selected: isFocused }}
                                activeOpacity={0.7}
                                onPress={onPress}
                                // Holding the last tab opens the feedback box.
                                // It costs no room on any screen, and the row in
                                // Settings says it is there so it is not a
                                // secret only the author knows.
                                onLongPress={route.name === 'settings'
                                    ? () => { mediumFeedback(); emit('show_feedback', { screen: state.routes[state.index]?.name }); }
                                    : undefined}
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
                                    foreground={foreground}
                                    unread={route.name === 'community' && unread > 0}
                                    background={palette.background}
                                />
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </MatteSurface>

            {/* 2. Creation Orb (Plus Button) - Uses accent gradient */}
            <TouchableOpacity
                ref={orbRef}
                accessibilityRole="button"
                accessibilityLabel="Create a habit, goal, or task"
                activeOpacity={0.8}
                onPress={() => {
                    mediumFeedback();
                    // The menu opens exactly on top of this button, wherever the
                    // phone puts it, so the plus can turn into the close button.
                    orbRef.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
                        emit('show_creation_modal', { x, y, size: width || floatingButtonSize, height });
                    });
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
                    colors={buttonColors}
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
    fade: { position: 'absolute', left: 0, right: 0 },
    navPill: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
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
    unread: {
        position: 'absolute', top: -1, right: -2,
        width: 10, height: 10, borderRadius: 5,
        backgroundColor: '#EF4444', borderWidth: 2,
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
    // The plus floats like the dock beside it, on a glow of its own colour.
    orbContainer: {
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.55,
        shadowRadius: 20,
        elevation: 14,
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
