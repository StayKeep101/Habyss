import React from 'react';
import { Keyboard, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, ReduceMotion, SlideInDown, useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';

const enter = SlideInDown.duration(220).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System);

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

    // The card rides on top of the keyboard...
    const lift = useAnimatedStyle(() => ({ paddingBottom: keyboard.height.value }));

    // ...and is flush with the bottom of the screen when there is no keyboard,
    // carrying the home indicator's room inside itself rather than floating
    // above it. The room gives way as the keyboard takes over, so the two
    // never add up to a gap.
    const pad = useAnimatedStyle(() => ({
        paddingBottom: Math.max(8, insets.bottom - Math.min(keyboard.height.value, insets.bottom)),
        // The card grows upward, so without a ceiling it grows off the top of
        // the screen: open a long setting with the keyboard up and the
        // sentence and the close button are the parts that disappear. The
        // ceiling is whatever the keyboard has left, and the written part
        // gives up its room first because it is the part that can scroll.
        maxHeight: screen - keyboard.height.value - insets.top - 12,
    }));

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
            <View style={styles.fill}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    style={styles.backdrop}
                    onPress={() => { Keyboard.dismiss(); onClose(); }}
                />

                <Animated.View pointerEvents="box-none" style={[styles.bottom, lift]}>
                    <Animated.View
                        entering={enter}
                        style={[styles.card, pad, { backgroundColor: colors.background, borderColor: colors.border }]}
                    >
                        {children}
                    </Animated.View>
                </Animated.View>
            </View>
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
