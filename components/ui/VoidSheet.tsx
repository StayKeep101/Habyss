import React, { useEffect, useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { elevationFor, surfaceFor } from '@/theme/designSystem';
import { Gesture, GestureDetector, GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import Animated, {
    Easing, ReduceMotion, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { ms, s, vs } from '@/theme/scale';
import { useTheme } from '@/context/ThemeContext';
import { sheetBottom } from './sheetBottom';
import { InSheet } from './inSheet';
import { OVERLAY } from '@/theme/motion';
import { useHaptics } from '@/hooks/useHaptics';
import { useUISound } from '@/hooks/useUISound';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
// Every overlay opens and closes the same way (theme/motion.ts).
const OPEN = OVERLAY.in;
const CLOSE = OVERLAY.out;

/**
 * A sheet that rises from the bottom and is only as tall as what is in it.
 *
 * The app had one presentation for everything: `VoidModal`, a UIKit page
 * sheet, which is a whole screen. Asking which two friends to share a habit
 * with took over the phone to show two rows and left the rest black — so the
 * question looked far bigger than it was, and the habit being shared went off
 * screen behind it.
 *
 * This is the other half of that pair, for choices small enough to answer
 * without leaving where you are: the thing you were looking at stays visible
 * above it. A page sheet is still right for anything with its own body of
 * work — writing a habit, editing a goal.
 *
 * Nothing on it but its title and what it asks: no grabber bar, no × (they
 * were noise). It closes the ways people already know: drag the panel down
 * (the whole panel is the handle), tap outside it, the back gesture, or
 * VoiceOver's escape. When the keyboard opens, the sheet rides up on top of
 * it, so the field being typed in is never hidden.
 */
export const VoidSheet: React.FC<{
    visible: boolean;
    onClose: () => void;
    /** A short name for what is being asked. Two or three words. */
    title: string;
    /** What it is about — the habit's name, say. Optional, and never a sentence. */
    caption?: string;
    children: React.ReactNode;
    /** Pinned under the content, outside the scroll: usually one button. */
    footer?: React.ReactNode;
    /** The most of the screen it may take (0–1). Two thirds by default. */
    maxShare?: number;
    /**
     * Content taller than the sheet: it scrolls, and only the title area
     * drags the sheet down, so scrolling back up never closes it.
     */
    scrollable?: boolean;
}> = ({ visible, onClose, title, caption, children, footer, maxShare = 0.68, scrollable = false }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const tone = surfaceFor(theme);
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const { lightFeedback } = useHaptics();
    const appear = useUISound('open');

    // Kept mounted through the closing animation, or it would vanish instantly.
    const [mounted, setMounted] = useState(visible);
    const progress = useSharedValue(0);
    /** How far it has been dragged down, in points. */
    const drag = useSharedValue(0);
    /** The keyboard's height while it is open, so the sheet sits on top of it. */
    const keyboard = useSharedValue(0);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    useEffect(() => {
        if (!mounted) return;
        const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', event => {
            setKeyboardHeight(event.endCoordinates.height);
            keyboard.set(withTiming(event.endCoordinates.height, { duration: event.duration || 250, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
        });
        const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', event => {
            setKeyboardHeight(0);
            keyboard.set(withTiming(0, { duration: event.duration || 220, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
        });
        return () => { show.remove(); hide.remove(); };
    }, [mounted, keyboard]);

    // Mounted while rendering rather than from the effect: the panel has to
    // exist before the opening animation can run on it, and setting state in an
    // effect to do that costs an extra render with the sheet already open at
    // zero progress. React supports this adjust-while-rendering pattern; the
    // effect below only takes it away again, once the close has finished.
    if (visible && !mounted) setMounted(true);

    useEffect(() => {
        if (visible) {
            drag.set(0);
            // Starts from the keyboard as it is now. A sheet closed with the
            // keyboard up stopped listening before it went away, kept its
            // height, and opened next time that far up the screen.
            const open = Keyboard.isVisible() ? Keyboard.metrics()?.height ?? 0 : 0;
            keyboard.set(open);
            setKeyboardHeight(open);
            appear();
            progress.set(withTiming(1, OPEN));
            return;
        }
        progress.set(withTiming(0, CLOSE, finished => {
            if (finished) runOnJS(setMounted)(false);
        }));
        // Never left behind: an interrupted close would keep an invisible modal over
        // the app, swallowing every tap. Gone shortly after the close, whatever happened.
        const gone = setTimeout(() => setMounted(false), (CLOSE.duration ?? 300) + 250);
        return () => clearTimeout(gone);
    }, [visible, progress, drag, keyboard]); // eslint-disable-line react-hooks/exhaustive-deps -- the sound plays as it opens, not when the setting changes

    const scrim = useAnimatedStyle(() => ({
        opacity: progress.get() * 0.55 * (1 - Math.min(1, drag.get() / 300)),
    }));
    const panel = useAnimatedStyle(() => ({
        transform: [{
            // Off the bottom when closed, and following the finger when dragged.
            translateY: interpolate(progress.get(), [0, 1], [height, 0]) + drag.get() - keyboard.get(),
        }],
    }));

    const dismiss = () => { lightFeedback(); onClose(); };

    const pull = Gesture.Pan()
        // Downwards only: a sheet that also moves up would fight its own scroll.
        .activeOffsetY(12)
        .failOffsetY(-12)
        .onUpdate(event => { drag.set(Math.max(0, event.translationY)); })
        .onEnd(event => {
            // Far enough, or fast enough. Distance alone makes a flick feel
            // ignored; velocity alone dismisses on a twitch.
            if (event.translationY > 110 || event.velocityY > 900) {
                runOnJS(onClose)();
            } else {
                drag.set(withTiming(0, OPEN));
            }
        });

    if (!mounted) return null;

    return (
        <Modal visible transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
            <GestureHandlerRootView style={StyleSheet.absoluteFill}>
                <AnimatedPressable
                    accessibilityRole="button"
                    accessibilityLabel={`Close ${title}`}
                    onPress={dismiss}
                    style={[StyleSheet.absoluteFill, scrim, { backgroundColor: '#000' }]}
                />

                <GestureDetector gesture={scrollable ? Gesture.Native() : pull}>
                    <Animated.View
                        accessibilityViewIsModal
                        onAccessibilityEscape={dismiss}
                        style={[
                            styles.panel,
                            panel,
                            {
                                // Never more than two thirds of the screen. Past
                                // that it is a screen, and should be a page sheet.
                                // With the keyboard up, whatever is left above it.
                                maxHeight: keyboardHeight ? Math.min(height * maxShare, height - keyboardHeight - insets.top - vs(12)) : height * maxShare,
                                paddingBottom: keyboardHeight ? vs(8) : sheetBottom(insets.bottom),
                                borderColor: tone.lip,
                                backgroundColor: tone.fill,
                            },
                            // Floats over the page: the shadow is cast upward.
                            { ...elevationFor(theme, 'floating'), shadowOffset: { width: 0, height: -10 } },
                        ]}
                    >
                        {/* The matte card surface: lighter at the top, no blur. */}
                        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.fillLayer]}>
                            <LinearGradient colors={[tone.top, tone.fill, tone.bottom]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
                        </View>

                        {scrollable ? (
                            <GestureDetector gesture={pull}>
                                <View style={styles.head}>
                                    <View style={styles.headText}>
                                        <Text numberOfLines={1} style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
                                        {caption ? <Text numberOfLines={1} style={[styles.caption, { color: colors.textTertiary }]}>{caption}</Text> : null}
                                    </View>
                                </View>
                            </GestureDetector>
                        ) : (
                            <View style={styles.head}>
                                <View style={styles.headText}>
                                    <Text numberOfLines={1} style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
                                    {caption ? (
                                        <Text numberOfLines={1} style={[styles.caption, { color: colors.textTertiary }]}>{caption}</Text>
                                    ) : null}
                                </View>
                            </View>
                        )}

                        {/* Inside a sheet, a settings group draws no card of its own (InSheet). */}
                        <InSheet.Provider value>
                        {scrollable ? (
                            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                                {children}
                            </ScrollView>
                        ) : children}
                        </InSheet.Provider>
                        {footer}
                    </Animated.View>
                </GestureDetector>
            </GestureHandlerRootView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    panel: {
        position: 'absolute', left: 0, right: 0, bottom: 0,
        borderTopLeftRadius: s(24), borderTopRightRadius: s(24),
        borderTopWidth: StyleSheet.hairlineWidth,
        borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth,
        // Not clipped, so its shadow shows; the gradient layer clips itself.
        paddingTop: vs(8),
    },
    head: {
        flexDirection: 'row', alignItems: 'center', gap: s(10),
        paddingHorizontal: s(18), paddingTop: vs(14), paddingBottom: vs(10),
    },
    headText: { flex: 1 },
    title: { fontSize: ms(20), fontFamily: FontFamily.bold },
    caption: { fontSize: ms(12), fontFamily: FontFamily.regular, marginTop: vs(1) },
    scroll: { flexShrink: 1 },
    scrollContent: { paddingHorizontal: s(18), paddingBottom: vs(12) },
    fillLayer: { borderTopLeftRadius: s(24), borderTopRightRadius: s(24), overflow: 'hidden' },
});
