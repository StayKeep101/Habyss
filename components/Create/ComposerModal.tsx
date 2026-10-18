import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { Keyboard, Modal, Pressable, StyleSheet, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated, {
    Easing, ReduceMotion, runOnJS, useAnimatedKeyboard, useAnimatedStyle,
    useSharedValue, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';

const OPEN = { duration: 260, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };
const SHUT = { duration: 210, easing: Easing.in(Easing.cubic), reduceMotion: ReduceMotion.System };
/** Used until the card has been measured once. */
const ASSUMED_HEIGHT = 360;

/**
 * How much room the card has: the tallest it may be on this phone right now,
 * and how tall it is. An open panel uses this to grow into all the space the
 * card has (up to the top of the screen) and its contents to shrink to fit,
 * so nothing is ever cut off and scrolled on a small phone.
 */
export const ComposerSpace = createContext<{ ceiling: number; cardHeight: number } | null>(null);

/**
 * The card you write a habit, a goal or a task into.
 *
 * It is exactly as tall as what it holds — a sentence, the row of settings and
 * the save button — and it rides on top of the keyboard, the way Todoist's
 * quick add does. A full-height sheet put the field you were typing in at the
 * top of the screen and the keyboard at the bottom, with your eyes crossing
 * all the dead space between; here the writing, the settings and saving are
 * one block under your thumb.
 *
 * The keyboard's own frame drives the card's position, rather than
 * `KeyboardAvoidingView`. Inside a modal that component measures the screen
 * and not the modal's window, which is why the card could sit below the
 * keyboard instead of on it. Reading the frame directly also means the card
 * tracks the keyboard rather than chasing it: tapping a setting puts the
 * keyboard away, and the card, the sentence and the save button all come down
 * with it in the same motion, at the same speed.
 *
 * Closing is the same motion in reverse, and deliberately not a fade. The card
 * arrived from the bottom, so it leaves that way. The modal stays mounted
 * until the slide has finished: unmounting it while the field still had focus
 * was what made the keyboard flick back up and then drop a second time.
 *
 * Tapping the dimmed area above closes it, as tapping away from a field does
 * everywhere else.
 */
export const ComposerModal: React.FC<{
    visible: boolean;
    onClose: () => void;
    children: React.ReactNode;
}> = ({ visible, onClose, children }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const insets = useSafeAreaInsets();
    const { height: screen } = useWindowDimensions();
    const keyboard = useAnimatedKeyboard();

    // The modal outlives `visible` by exactly one slide, so the card has
    // somewhere to animate out to.
    const [mounted, setMounted] = useState(visible);
    const [height, setHeight] = useState(ASSUMED_HEIGHT);
    const shown = useSharedValue(0);

    const unmount = useCallback(() => setMounted(false), []);

    useEffect(() => {
        if (visible) {
            setMounted(true);
            shown.value = withTiming(1, OPEN);
            return;
        }
        if (!mounted) return;
        // The keyboard goes first; the card follows it down rather than
        // racing it, and nothing is left focused when the modal disappears.
        Keyboard.dismiss();
        shown.value = withTiming(0, SHUT, finished => {
            if (finished) runOnJS(unmount)();
        });
    }, [visible, mounted, shown, unmount]);

    /**
     * Riding the keyboard without re-laying-out the card every frame.
     *
     * The card used to follow the keyboard by animating its padding and its
     * maximum height, which made Yoga lay out every row, chip and picker in it
     * on every frame of the keyboard's motion — and tapping any chip puts the
     * keyboard away, so every tap paid for a quarter-second of that. Now the
     * card moves by transform, which costs no layout at all, and its ceiling
     * and bottom room change once per keyboard change rather than per frame.
     */
    const [keyboardUp, setKeyboardUp] = useState(0);
    useEffect(() => {
        const show = Keyboard.addListener('keyboardWillShow', event => setKeyboardUp(event.endCoordinates.height));
        const change = Keyboard.addListener('keyboardWillChangeFrame', event => {
            if (event.endCoordinates.screenY < screen) setKeyboardUp(event.endCoordinates.height);
        });
        const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardUp(0));
        return () => { show.remove(); change.remove(); hide.remove(); };
    }, [screen]);

    const lift = useAnimatedStyle(() => ({ transform: [{ translateY: -keyboard.height.value }] }));

    // Flush with the bottom when there is no keyboard, carrying the home
    // indicator's room inside itself; over the keyboard that room is not needed.
    const pad = useAnimatedStyle(() => ({
        // Down and out of sight, never a fade.
        transform: [{ translateY: (1 - shown.value) * (height + insets.bottom) }],
    }));
    const ceiling = {
        paddingBottom: keyboardUp ? 8 : Math.max(8, insets.bottom),
        // The card grows upward, so without a ceiling it grows off the top of
        // the screen. The ceiling is whatever the keyboard has left; the
        // written part and the open panel give up room first, because they
        // are the parts that scroll.
        maxHeight: screen - keyboardUp - insets.top - 12,
    };

    const space = useMemo(() => ({ ceiling: ceiling.maxHeight, cardHeight: height }), [ceiling.maxHeight, height]);

    // The dimming comes and goes with the card, so the screen behind is never
    // left dark under a card that has already gone.
    const scrim = useAnimatedStyle(() => ({ opacity: shown.value }));

    return (
        <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
            <GestureHandlerRootView style={styles.fill}>
                <Animated.View style={[styles.backdrop, scrim]}>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Close"
                        style={styles.fill}
                        onPress={onClose}
                    />
                </Animated.View>

                <Animated.View pointerEvents="box-none" style={[styles.bottom, lift]}>
                    <Animated.View
                        onLayout={(event: LayoutChangeEvent) => setHeight(event.nativeEvent.layout.height)}
                        style={[styles.card, pad, ceiling, { backgroundColor: colors.background, borderColor: colors.border }]}
                    >
                        <ComposerSpace.Provider value={space}>{children}</ComposerSpace.Provider>
                    </Animated.View>
                </Animated.View>
            </GestureHandlerRootView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    fill: { flex: 1 },
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
    bottom: { flex: 1, justifyContent: 'flex-end' },
    card: {
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        borderTopWidth: StyleSheet.hairlineWidth, borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
});
