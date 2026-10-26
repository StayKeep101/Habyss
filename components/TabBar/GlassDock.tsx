import React from 'react';
import {View, TouchableOpacity, StyleSheet} from 'react-native';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { LinearGradient } from 'expo-linear-gradient';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import Animated, { useAnimatedStyle, withSpring, withTiming, useSharedValue, interpolate } from 'react-native-reanimated';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { RAIL_WIDTH, useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { emit, on } from '@/lib/appEvents';
import { registerTarget } from '@/lib/coachMarks';
import { AppState } from 'react-native';
import { FriendsService } from '@/lib/friendsService';
import { getRemoveDrag, setOrbRect, subscribeRemoveDrag, type RemoveDrag } from '@/lib/dragBridge';
import { VoiceOrb } from './VoiceOrb';
import { useWindowDimensions } from 'react-native';

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
    // A barely-there edge so the bar lifts off the page; never a white outline.
    const dockEdge = theme === 'light' ? 'rgba(15,23,42,0.07)' : 'rgba(255,255,255,0.08)';
    const { colors: accentColors, shadowColor, foreground, buttonColors } = useAccentGradient();
    const palette = Colors[theme];
    const { mediumFeedback } = useHaptics();
    const { horizontalPadding, tabBarHeight, floatingButtonSize, tabBarBottomOffset, isCompactWidth, railed, insets } = useResponsiveLayout();
    const orbRef = React.useRef<any>(null);
    // The first-run walkthrough lights up the + button and the tabs (lib/coachMarks.ts).
    const tabRefs = React.useRef<Record<string, any>>({});
    React.useEffect(() => {
        const measure = (view: any) => () => new Promise<{ x: number; y: number; width: number; height: number } | null>(resolve => {
            if (!view?.measureInWindow) { resolve(null); return; }
            view.measureInWindow((x: number, y: number, width: number, height: number) => resolve(width > 0 ? { x, y, width, height } : null));
        });
        const offs = [
            registerTarget('plus', () => measure(orbRef.current)()),
            ...['home', 'roadmap', 'community', 'settings'].map(name => registerTarget(`tab-${name}`, () => measure(tabRefs.current[name])())),
        ];
        return () => offs.forEach(off => off());
    }, []);
    const { width: screenWidth } = useWindowDimensions();
    /** True while the button is held for voice, so letting go stops listening. */
    const voiceHeld = React.useRef(false);
    // Whether the microphone is on (VoiceCapture says so): a tap then stops it
    // rather than opening the create menu on top of it.
    const voiceOn = React.useRef(false);
    React.useEffect(() => {
        const sub = on('voice_state', state => { voiceOn.current = !!state?.listening; });
        return () => sub.remove();
    }, []);

    /**
     * While something in a goal is dragged on the Roadmap, the plus becomes
     * "Remove from goal" — same round button, same place — and turns red when
     * the finger is over it. The page does the hit-testing against the rect
     * measured here.
     */
    const [removeDrag, setRemoveDragState] = React.useState<RemoveDrag>(getRemoveDrag());
    const morph = useSharedValue(0);
    const hover = useSharedValue(0);
    const measureOrb = React.useCallback(() => {
        orbRef.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
            if (width) setOrbRect({ x, y, width, height });
        });
    }, []);
    React.useEffect(() => subscribeRemoveDrag(next => {
        setRemoveDragState(next);
        if (next.active) measureOrb();
        morph.value = withTiming(next.active ? 1 : 0, { duration: 220 });
        hover.value = withSpring(next.over ? 1 : 0, { damping: 14, stiffness: 260 });
    }), [measureOrb, morph, hover]);
    const orbScale = useAnimatedStyle(() => ({ transform: [{ scale: 1 + hover.value * 0.14 }] }));
    const plusLayer = useAnimatedStyle(() => ({ opacity: 1 - morph.value, transform: [{ rotate: `${morph.value * 90}deg` }] }));
    const removeLayer = useAnimatedStyle(() => ({ opacity: morph.value, transform: [{ scale: interpolate(morph.value, [0, 1], [0.6, 1]) }] }));
    const removeFill = useAnimatedStyle(() => ({ opacity: hover.value }));
    const removeLabel = useAnimatedStyle(() => ({ opacity: morph.value, transform: [{ translateY: (1 - morph.value) * 6 }] }));

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

    const tabs = state.routes.map((route: any, index: number) => {
                        const { options } = descriptors[route.key];
                        const isFocused = state.index === index;

                        const onPress = () => {
                            const event = navigation.emit({
                                type: 'tabPress',
                                target: route.key,
                                canPreventDefault: true,
                            });

                            emit('tab_selected', route.name);
                            if (!isFocused && !event.defaultPrevented) {
                                mediumFeedback();
                                navigation.navigate(route.name);
                            }
                        };

                        return (
                            <TouchableOpacity
                                key={route.key}
                                ref={(view: any) => { tabRefs.current[route.name] = view; }}
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
                    });

    const orb = (
            <Animated.View style={orbScale}>
            {removeDrag.active ? (
                <Animated.Text pointerEvents="none" numberOfLines={1}
                    style={[styles.removeLabel, { bottom: floatingButtonSize + 10, color: removeDrag.over ? palette.error : palette.textPrimary }, removeLabel]}>
                    Remove from goal
                </Animated.Text>
            ) : null}
            <TouchableOpacity
                ref={orbRef}
                onLayout={measureOrb}
                accessibilityRole="button"
                accessibilityLabel={removeDrag.active ? 'Remove from goal' : 'Create a habit, goal, or task'}
                accessibilityHint={removeDrag.active ? undefined : 'Hold to say it instead'}
                activeOpacity={0.8}
                disabled={removeDrag.active}
                // Hold to speak a habit, task or goal; let go to open it.
                delayLongPress={350}
                onLongPress={() => { voiceHeld.current = true; emit('voice_start'); }}
                onPressOut={() => { if (voiceHeld.current) { voiceHeld.current = false; emit('voice_stop'); } }}
                onPress={() => {
                    // Listening: the tap ends it, and what was said is used.
                    if (voiceOn.current) { mediumFeedback(); emit('voice_stop'); return; }
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
                        shadowColor: removeDrag.active ? '#000000' : shadowColor,
                    }
                ]}
            >
                <Animated.View style={[StyleSheet.absoluteFill, plusLayer]}>
                    <LinearGradient
                        colors={buttonColors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.orbGradient, { borderRadius: floatingButtonSize / 2 }]}
                    >
                        <Ionicons name="add" size={isCompactWidth ? 28 : 32} color="#fff" />
                    </LinearGradient>
                </Animated.View>
                <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, removeLayer]}>
                    <MatteSurface radius={floatingButtonSize / 2} elevation="floating" edge={dockEdge} hairline style={StyleSheet.absoluteFill}>
                        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: palette.error, borderRadius: floatingButtonSize / 2 }, removeFill]} />
                        <View style={styles.orbCenter}>
                            <Ionicons name="remove" size={isCompactWidth ? 28 : 32} color={removeDrag.over ? '#FFFFFF' : palette.error} />
                        </View>
                    </MatteSurface>
                </Animated.View>
            </TouchableOpacity>
            </Animated.View>
    );

    // iPad and an open foldable: the same pill and plus, standing down the
    // left edge, the page beside them instead of under them.
    if (railed) {
        return (
            <View style={[styles.rail, { width: RAIL_WIDTH, backgroundColor: palette.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
                <MatteSurface radius={tabBarHeight / 2} elevation="floating" edge={dockEdge} hairline style={[styles.railPill, { width: tabBarHeight }]}>
                    {tabs}
                </MatteSurface>
                {orb}
            </View>
        );
    }

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
            <MatteSurface radius={tabBarHeight / 2} elevation="floating" edge={dockEdge} hairline style={[
                styles.navPill,
                {
                    height: tabBarHeight,
                    paddingHorizontal: isCompactWidth ? 12 : 16,
                    maxWidth: isCompactWidth ? 236 : 260,
                },
            ]}>

                <View style={styles.tabsRow}>
                    {tabs}
                </View>
            </MatteSurface>

            {/* 2. Creation Orb (Plus Button) - Uses accent gradient. While an
                item in a goal is dragged it becomes the "Remove from goal" target. */}
            {orb}

            {/* Holding the plus stretches it into a listening pill over the dock. */}
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { left: horizontalPadding, right: horizontalPadding }]}>
                <VoiceOrb size={floatingButtonSize} maxWidth={Math.max(floatingButtonSize, screenWidth - horizontalPadding * 2)}
                    colors={buttonColors} ink="#fff" />
            </View>
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
    rail: { alignItems: 'center', justifyContent: 'center', gap: Spacing.xxl },
    railPill: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, gap: Spacing.sm },
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
    orbCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
    removeLabel: { position: 'absolute', right: 0, width: 160, textAlign: 'right', fontSize: 13, fontFamily: FontFamily.medium },
    orbGradient: {
        flex: 1,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    }
});
