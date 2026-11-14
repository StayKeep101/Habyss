import React, { useMemo } from 'react';
import {View, TouchableOpacity, StyleSheet} from 'react-native';
import { mixHex, readableAccent } from '@/lib/colorContrast';
import { textOn } from '@/theme/tokens';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { LinearGradient } from 'expo-linear-gradient';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import Animated, { Easing, useAnimatedStyle, withTiming, useSharedValue, interpolate, runOnJS, runOnUI } from 'react-native-reanimated';
import { focusLeave } from '@/lib/focusStage';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { DURATION, EASE, timingFor } from '@/theme/motion';
import { Colors } from '@/theme/colors';
import { Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { RAIL_WIDTH, useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { emit, on } from '@/lib/appEvents';
import { getTour, registerTarget } from '@/lib/coachMarks';
import { PLUS_ACTIONS, currentPlus, loadPlus, plusTabOf, runPlus, subscribePlus } from '@/lib/plusActions';
import { AppState } from 'react-native';
import { FriendsService } from '@/lib/friendsService';
import { getRemoveDrag, setOrbRect, subscribeRemoveDrag, type RemoveDrag } from '@/lib/dragBridge';
import { VoiceOrb } from './VoiceOrb';

/** The dock gathering or spreading: worked out once, so the UI thread only reads it. */
const MERGE_TIMING = timingFor(DURATION.emphasis, EASE.move);
import { FocusMiniBar, FOCUS_BAR_HEIGHT } from '@/components/Focus/FocusMiniBar';
import { useWindowDimensions } from 'react-native';
import { useUISound } from '@/hooks/useUISound';

interface TabIconProps {
    routeName: string;
    focused: boolean;
    colors: [string, string]; // Accent gradient colors
    isDark: boolean;
    foreground: string;
}

const TabIcon = ({ routeName, focused, colors, isDark, foreground, unread, background }: TabIconProps & { unread?: boolean; background: string }) => {
    // No scale on the chosen tab: an icon drawn and then enlarged is soft at rest, and it sprang.
    // The filled glyph in the accent says which tab it is, as the system tab bar does.

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
        <Animated.View style={styles.iconContainer}>
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
    const { colors: accentColors, shadowColor, foreground } = useAccentGradient();
    // The plus is a large icon, not text: it needs 3:1 against its white glyph,
    // not text's 4.5:1, so it keeps the accent's own colour instead of the
    // darkened one buttons with words use (which read as greyed out on warm accents).
    // A light accent (the top ranks' pale gold and iridescent white) keeps its own colour
    // and takes a dark glyph instead, as every other solid accent fill does (textOn).
    const lightOrb = textOn(mixHex(accentColors[0], accentColors[1])) !== Colors.common.white;
    const orbInk = lightOrb ? Colors.common.black : Colors.common.white;
    const orbColors = useMemo(() => (lightOrb ? [...accentColors] : accentColors.map(color => readableAccent(color, '#ffffff', 3))) as [string, string], [accentColors, lightOrb]);
    const palette = Colors[theme];
    const { mediumFeedback } = useHaptics();
    // Switching tabs is a choice: the select sound (lib/soundService.ts).
    const tabSound = useUISound('select');
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
        // Grows and turns red as something is carried over it, smoothly: no spring, no bounce.
        hover.value = withTiming(next.over ? 1 : 0, { duration: 180, easing: Easing.out(Easing.cubic) });
    }), [measureOrb, morph, hover]);
    const orbScale = useAnimatedStyle(() => ({ transform: [{ scale: 1 + hover.value * 0.14 }] }));
    const plusLayer = useAnimatedStyle(() => ({ opacity: 1 - morph.value, transform: [{ rotate: `${morph.value * 90}deg` }] }));
    const removeLayer = useAnimatedStyle(() => ({ opacity: morph.value, transform: [{ scale: interpolate(morph.value, [0, 1], [0.6, 1]) }] }));
    const removeFill = useAnimatedStyle(() => ({ opacity: hover.value }));

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

    const current = state.routes[state.index]?.name;
    const [barShown, setBarShown] = React.useState(false);
    const [expanded, setExpanded] = React.useState(false);
    const merged = !railed && current === 'roadmap' && barShown && !expanded;
    const merge = useSharedValue(merged ? 1 : 0);
    // One animation per change, on the UI thread: started when the tab is touched, and only
    // corrected (never restarted) once the navigation lands, so no frame runs in JavaScript.
    // Where the dock is heading, kept on the UI thread: the tab's touch starts the move there,
    // before any JavaScript runs (which may be busy with the tab it is leaving), and the
    // catch-up below only corrects it, never restarting a move already under way.
    const mergeTo = useSharedValue(merged ? 1 : 0);
    // Whether the dock may gather at all (no rail, a now bar, not opened out), for the UI thread.
    const mergeable = useSharedValue(!railed && barShown && !expanded);
    React.useEffect(() => { mergeable.set(!railed && barShown && !expanded); }, [railed, barShown, expanded, mergeable]);
    /** Puts the dock where this page wants it, whatever a touch started. */
    const settle = React.useCallback((to: number) => {
        runOnUI(() => {
            'worklet';
            if (mergeTo.value === to) return;
            mergeTo.value = to;
            merge.value = withTiming(to, MERGE_TIMING);
        })();
    }, [merge, mergeTo]);
    React.useEffect(() => { settle(merged ? 1 : 0); }, [merged, current, settle]);
    // A touch on a tab starts the move before the page changes. When the touch ends
    // without changing the page (slid off, cancelled), the dock goes back to what the
    // page wants: it is only ever gathered on the Roadmap.
    const mergedRef = React.useRef(merged);
    mergedRef.current = merged;
    const settleSoon = React.useCallback(() => { setTimeout(() => settle(mergedRef.current ? 1 : 0), 450); }, [settle]);
    /** A touch on a tab, on the UI thread: gather on the Roadmap, spread anywhere else. */
    const touchTab = (name: string) => Gesture.Manual().onTouchesDown(() => {
        'worklet';
        if (!mergeable.value) return;
        const to = name === 'roadmap' ? 1 : 0;
        if (mergeTo.value === to) return;
        mergeTo.value = to;
        merge.value = withTiming(to, MERGE_TIMING);
    })
        // Only watches the touch: never takes it over, so the tab's own press runs as before.
        .onTouchesUp((_event, manager) => { 'worklet'; manager.fail(); runOnJS(settleSoon)(); })
        .onTouchesCancelled((_event, manager) => { 'worklet'; manager.fail(); runOnJS(settleSoon)(); });
    // A tab switched on touch down: its press, when the finger lifts, is already done.
    const switchedOnDown = React.useRef<string | null>(null);
    const tabs = state.routes.map((route: any, index: number) => {
                        const { options } = descriptors[route.key];
                        const isFocused = state.index === index;

                        // On touch down, like the system tab bar: the switch starts while the finger is
                        // still on the glass, not after it lifts. The press that follows does nothing more.
                        const onPressIn = () => {
                            if (isFocused) return;
                            switchedOnDown.current = route.key;
                            go();
                        };
                        const onPress = () => {
                            if (switchedOnDown.current === route.key) { switchedOnDown.current = null; return; }
                            go();
                        };
                        const go = () => {
                            const event = navigation.emit({
                                type: 'tabPress',
                                target: route.key,
                                canPreventDefault: true,
                            });

                            emit('tab_selected', route.name);
                            if (!isFocused && !event.defaultPrevented) {
                                mediumFeedback();
                                tabSound();
                                navigation.navigate(route.name);
                            }
                        };

                        return (
                            <GestureDetector key={route.key} gesture={touchTab(route.name)}>
                            <TouchableOpacity
                                ref={(view: any) => { tabRefs.current[route.name] = view; }}
                                accessibilityRole="tab"
                                accessibilityLabel={options.title ?? route.name}
                                accessibilityHint={route.name === 'settings' ? 'Hold to send feedback' : undefined}
                                accessibilityState={{ selected: isFocused }}
                                activeOpacity={0.7}
                                onPressIn={onPressIn}
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
                            </GestureDetector>
                        );
                    });

    // What this tab's + does (lib/plusActions.ts): a menu, its one action, or on Settings a search lens.
    const plusTab = plusTabOf(state.routes[state.index]?.name);
    const plus = React.useSyncExternalStore(subscribePlus, currentPlus, currentPlus);
    React.useEffect(() => { void loadPlus(); }, []);
    const plusLabel = plusTab === 'settings' ? 'Search settings'
        : plus[plusTab].length === 1 ? PLUS_ACTIONS[plus[plusTab][0]].label
            : plusTab === 'community' ? 'Bet or challenge' : 'Create a habit, goal, or task';

    /**
     * On the Roadmap the dock gathers into one row, like a music app's: the tab pill
     * shrinks to a Roadmap disc on the left, the now bar slides down between it and
     * the +, and the page gets its room back. Swipe the disc to go to Home or
     * Community; tap it for every tab. Any other tab, or no now bar: the usual dock.
     */
    // Opened for every tab: gathers again after a few seconds if none was chosen.
    React.useEffect(() => {
        if (!expanded) return;
        const timer = setTimeout(() => setExpanded(false), 5000);
        return () => clearTimeout(timer);
    }, [expanded]);
    const dockGap = isCompactWidth ? 10 : 12;
    const pillMax = isCompactWidth ? 236 : 260;
    const pillWidth = Math.max(tabBarHeight, Math.min(pillMax, screenWidth - horizontalPadding * 2 - dockGap - floatingButtonSize));
    const rowHeight = Math.max(tabBarHeight, floatingButtonSize);
    // Gathered, the row is one height: the now bar's. The Roadmap disc and the + become
    // circles exactly as tall as it (never larger), so the three read as one row.
    const gathered = Math.min(tabBarHeight, floatingButtonSize, FOCUS_BAR_HEIGHT);
    const orbShrink = gathered / floatingButtonSize;
    // The usual dock is centred; gathered, the disc and the + go out to the edges.
    const slide = Math.max(0, (screenWidth - (pillWidth + dockGap + floatingButtonSize)) / 2 - horizontalPadding);
    const pillBox = useAnimatedStyle(() => ({
        width: interpolate(merge.value, [0, 1], [pillWidth, gathered]),
        height: interpolate(merge.value, [0, 1], [tabBarHeight, gathered]),
        transform: [{ translateX: -merge.value * slide }, { translateY: merge.value * (tabBarHeight - gathered) / 2 }],
    }));
    const tabsFade = useAnimatedStyle(() => ({ opacity: 1 - merge.value }));
    const discFade = useAnimatedStyle(() => ({ opacity: merge.value }));
    // Shrunk about its centre, then nudged out so its edge stays on the margin.
    const orbSlide = useAnimatedStyle(() => ({
        transform: [{ translateX: merge.value * (slide + (floatingButtonSize - gathered) / 2) }, { scale: interpolate(merge.value, [0, 1], [1, orbShrink]) }],
    }));
    const barAbove = tabBarBottomOffset + rowHeight + Spacing.sm;
    const barPlace = useAnimatedStyle(() => ({
        left: interpolate(merge.value, [0, 1], [horizontalPadding, horizontalPadding + gathered + dockGap]),
        right: interpolate(merge.value, [0, 1], [horizontalPadding, horizontalPadding + gathered + dockGap]),
        bottom: interpolate(merge.value, [0, 1], [barAbove, tabBarBottomOffset + (rowHeight - gathered) / 2]),
    }));
    const goTab = React.useCallback((name: string) => {
        mediumFeedback();
        tabSound();
        emit('tab_selected', name);
        navigation.navigate(name);
    }, [mediumFeedback, tabSound, navigation]);
    const disc = useMemo(() => {
        const swipe = Gesture.Pan().activeOffsetX([-14, 14]).failOffsetY([-24, 24]).onEnd(event => {
            if (event.translationX <= -32) runOnJS(goTab)('community');
            else if (event.translationX >= 32) runOnJS(goTab)('home');
        });
        const tap = Gesture.Tap().onEnd(() => { runOnJS(setExpanded)(true); });
        return Gesture.Exclusive(swipe, tap);
    }, [goTab]);

    const orb = (
            <Animated.View style={orbScale}>
            <TouchableOpacity
                ref={orbRef}
                onLayout={measureOrb}
                accessibilityRole="button"
                accessibilityLabel={removeDrag.active ? (removeDrag.label ?? 'Remove from goal') : plusLabel}
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
                    if (plusTab === 'settings') { emit('show_settings_search'); return; }
                    // One action: no menu for one choice (the tour still opens the menu, to teach it).
                    if (plus[plusTab].length === 1 && !getTour().active) { runPlus(plus[plusTab][0]); return; }
                    // The menu opens exactly on top of this button, wherever the
                    // phone puts it, so the plus can turn into the close button.
                    orbRef.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
                        emit('show_creation_modal', { x, y, size: width || floatingButtonSize, height, tab: plusTab });
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
                        colors={orbColors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.orbGradient, { borderRadius: floatingButtonSize / 2 }]}
                    >
                        <Ionicons name={plusTab === 'settings' ? 'search' : 'add'} size={isCompactWidth ? 28 : 32} color={orbInk} />
                    </LinearGradient>
                </Animated.View>
                <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, removeLayer]}>
                    <MatteSurface radius={floatingButtonSize / 2} elevation="floating" edge={dockEdge} hairline style={StyleSheet.absoluteFill}>
                        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: palette.error, borderRadius: floatingButtonSize / 2 }, removeFill]} />
                        <View style={styles.orbCenter}>
                            <Ionicons name={removeDrag.kind === 'delete' ? 'trash' : 'remove'} size={isCompactWidth ? 28 : 32} color={removeDrag.over ? '#FFFFFF' : palette.error} />
                        </View>
                    </MatteSurface>
                </Animated.View>
            </TouchableOpacity>
            </Animated.View>
    );

    // Stepping into Focus from Home (lib/focusStage.ts): the dock sinks out with the page.
    const sinkStyle = useAnimatedStyle(() => ({
        opacity: 1 - focusLeave.get(),
        transform: [{ translateY: focusLeave.get() * 160 }],
    }));

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
        <>
        <Animated.View style={[
            styles.container,
            {
                bottom: tabBarBottomOffset,
                paddingHorizontal: horizontalPadding,
                gap: isCompactWidth ? 10 : 12,
            },
            sinkStyle,
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

            {/* The matte card surface as a pill, floating on its shadow. Its place in the row keeps
                its full width, so the + never moves when it gathers into the Roadmap disc. */}
            <View style={{ width: pillWidth, height: tabBarHeight }}>
            <Animated.View style={[styles.pillBox, pillBox]}>
            <MatteSurface radius={tabBarHeight / 2} elevation="floating" edge={dockEdge} hairline style={styles.fill}>
                <View style={[styles.clip, { borderRadius: tabBarHeight / 2 }]}>
                    <Animated.View pointerEvents={merged ? 'none' : 'auto'} accessibilityElementsHidden={merged} importantForAccessibility={merged ? 'no-hide-descendants' : 'auto'}
                        style={[styles.tabsRow, { width: pillWidth, paddingHorizontal: isCompactWidth ? 12 : 16 }, tabsFade]}>
                        {tabs}
                    </Animated.View>
                    {/* Gathered: the Roadmap alone. Swipe it to Home or Community; tap for every tab. */}
                    <GestureDetector gesture={disc}>
                        <Animated.View pointerEvents={merged ? 'auto' : 'none'} accessibilityElementsHidden={!merged} importantForAccessibility={merged ? 'yes' : 'no-hide-descendants'}
                            accessible={merged} accessibilityRole="adjustable" accessibilityLabel="Roadmap"
                            accessibilityHint="Swipe up for Community, down for Home. Double-tap for every tab"
                            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }, { name: 'activate' }]}
                            onAccessibilityAction={event => {
                                const name = event.nativeEvent.actionName;
                                if (name === 'increment') goTab('community');
                                else if (name === 'decrement') goTab('home');
                                else setExpanded(true);
                            }}
                            style={[styles.disc, { width: gathered, height: gathered }, discFade]}>
                            <TabIcon routeName="roadmap" focused colors={accentColors} isDark={theme !== 'light'} foreground={foreground} background={palette.background} />
                        </Animated.View>
                    </GestureDetector>
                </View>
            </MatteSurface>
            </Animated.View>
            </View>

            {/* 2. Creation Orb (Plus Button) - Uses accent gradient. While an
                item in a goal is dragged it becomes the "Remove from goal" target. */}
            <Animated.View style={orbSlide}>{orb}</Animated.View>

            {/* Holding the plus stretches it into a listening pill over the dock. */}
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { left: horizontalPadding, right: horizontalPadding }]}>
                <VoiceOrb size={floatingButtonSize} maxWidth={Math.max(floatingButtonSize, screenWidth - horizontalPadding * 2)}
                    colors={orbColors} ink={orbInk} />
            </View>
        </Animated.View>
        {/* What to be doing now (or the focus session running) sits on top of the dock, on every tab.
            Beside the dock rather than inside it: iOS gives no touches to a
            view drawn outside its parent. After it, so the dock's fade never
            shades it. */}
        <Animated.View pointerEvents="box-none" style={[styles.focusBar, merged ? { height: gathered } : null, barPlace, sinkStyle]}>
            <FocusMiniBar docked={merged} onShown={setBarShown} />
        </Animated.View>
        </>
    );
};

const styles = StyleSheet.create({
    focusBar: { position: 'absolute' },
    pillBox: { position: 'absolute', left: 0, top: 0 },
    fill: { flex: 1 },
    clip: { flex: 1, overflow: 'hidden' },
    disc: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center' },
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
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'center',
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
    // The plus floats like the dock beside it, on a close, soft glow of its own colour.
    orbContainer: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
    },
    orbCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
    orbGradient: {
        flex: 1,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    }
});
