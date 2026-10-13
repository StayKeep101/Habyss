import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    Easing, ReduceMotion, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { ms, s, vs } from '@/theme/scale';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const OPEN = { duration: 260, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };
const CLOSE = { duration: 190, easing: Easing.in(Easing.cubic), reduceMotion: ReduceMotion.System };

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
 * Drag it down to dismiss. The whole panel is the handle, not the small bar at
 * the top, because that bar is much too small a target to be the only one and
 * people grab the sheet itself.
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
}> = ({ visible, onClose, title, caption, children, footer }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const { lightFeedback } = useHaptics();

    // Kept mounted through the closing animation, or it would vanish instantly.
    const [mounted, setMounted] = useState(visible);
    const progress = useSharedValue(0);
    /** How far it has been dragged down, in points. */
    const drag = useSharedValue(0);

    // Mounted while rendering rather than from the effect: the panel has to
    // exist before the opening animation can run on it, and setting state in an
    // effect to do that costs an extra render with the sheet already open at
    // zero progress. React supports this adjust-while-rendering pattern; the
    // effect below only takes it away again, once the close has finished.
    if (visible && !mounted) setMounted(true);

    useEffect(() => {
        if (visible) {
            drag.set(0);
            progress.set(withTiming(1, OPEN));
            return;
        }
        progress.set(withTiming(0, CLOSE, finished => {
            if (finished) runOnJS(setMounted)(false);
        }));
    }, [visible, progress, drag]);

    const scrim = useAnimatedStyle(() => ({
        opacity: progress.get() * 0.55 * (1 - Math.min(1, drag.get() / 300)),
    }));
    const panel = useAnimatedStyle(() => ({
        transform: [{
            // Off the bottom when closed, and following the finger when dragged.
            translateY: interpolate(progress.get(), [0, 1], [height, 0]) + drag.get(),
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

                <GestureDetector gesture={pull}>
                    <Animated.View
                        accessibilityViewIsModal
                        style={[
                            styles.panel,
                            panel,
                            {
                                // Never more than two thirds of the screen. Past
                                // that it is a screen, and should be a page sheet.
                                maxHeight: height * 0.68,
                                paddingBottom: insets.bottom + vs(8),
                                borderColor: colors.border,
                                backgroundColor: isLight ? 'rgba(255,255,255,0.96)' : 'rgba(16,19,24,0.96)',
                            },
                        ]}
                    >
                        <BlurView intensity={isLight ? 30 : 50} tint={isLight ? 'light' : 'dark'} style={StyleSheet.absoluteFill} />

                        <View style={[styles.grabber, { backgroundColor: colors.textTertiary }]} />

                        <View style={styles.head}>
                            <View style={styles.headText}>
                                <Text numberOfLines={1} style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
                                {caption ? (
                                    <Text numberOfLines={1} style={[styles.caption, { color: colors.textTertiary }]}>{caption}</Text>
                                ) : null}
                            </View>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Close"
                                hitSlop={10}
                                onPress={dismiss}
                                style={[styles.close, { backgroundColor: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.08)' }]}
                            >
                                <Ionicons name="close" size={ms(16)} color={colors.textSecondary} />
                            </Pressable>
                        </View>

                        {children}
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
        overflow: 'hidden',
        paddingTop: vs(8),
    },
    grabber: { alignSelf: 'center', width: s(36), height: vs(4), borderRadius: 999, opacity: 0.4 },
    head: {
        flexDirection: 'row', alignItems: 'center', gap: s(10),
        paddingHorizontal: s(18), paddingTop: vs(10), paddingBottom: vs(6),
    },
    headText: { flex: 1 },
    title: { fontSize: ms(17), fontFamily: FontFamily.semibold },
    caption: { fontSize: ms(12), fontFamily: FontFamily.regular, marginTop: vs(1) },
    close: { width: s(28), height: s(28), borderRadius: s(14), alignItems: 'center', justifyContent: 'center' },
});
