import React, { useEffect } from 'react';
import { Modal, Pressable, StyleProp, StyleSheet, useWindowDimensions, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/constants/themeContext';
import { Colors } from '@/constants/Colors';
import { VoidShell } from '@/components/Layout/VoidShell';

interface VoidModalProps {
    visible: boolean;
    onClose: () => void;
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    /** Runs once the sheet has finished dismissing (iOS only, as per RN's Modal). */
    onDismiss?: () => void;
}

/** Drag past this, or flick faster than this, and the sheet closes. */
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;

/**
 * Tall rounded sheet with drag-to-dismiss.
 *
 * Uses the same VoidShell background as the app's screens so the contents look
 * identical to a pushed screen, but stops short of the top so the rounded
 * corners read as a sheet. The scrim behind is deliberately light: the previous
 * 55% black wash was the heavy shadowed layer that made opening feel abrupt.
 *
 * The drag is driven by a shared value, so the sheet tracks the finger on the UI
 * thread instead of waiting for the gesture to end.
 */
export const VoidModal: React.FC<VoidModalProps> = ({ visible, onClose, children, style, onDismiss }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();

    // Leave a sliver of the screen behind visible so the corners read as a sheet.
    const sheetHeight = Math.max(320, height - insets.top - 12);
    const translateY = useSharedValue(0);

    useEffect(() => {
        // Reset after a drag-dismiss so the next open starts from the top.
        if (visible) translateY.value = 0;
    }, [visible, translateY]);

    const dragToDismiss = Gesture.Pan()
        .activeOffsetY(10)
        .failOffsetY(-10)
        .onUpdate(event => {
            translateY.value = Math.max(0, event.translationY);
        })
        .onEnd(event => {
            if (event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
                translateY.value = withTiming(sheetHeight, { duration: 180 }, finished => {
                    if (finished) runOnJS(onClose)();
                });
            } else {
                translateY.value = withSpring(0, { damping: 22, stiffness: 220 });
            }
        });

    const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
            onDismiss={onDismiss}
            statusBarTranslucent
        >
            <GestureHandlerRootView style={styles.root}>
                <Pressable
                    accessibilityLabel="Close sheet"
                    style={[StyleSheet.absoluteFill, styles.scrim]}
                    onPress={onClose}
                />

                <Animated.View
                    accessibilityViewIsModal
                    style={[
                        styles.sheet,
                        { height: sheetHeight, borderColor: colors.border },
                        sheetStyle,
                        style,
                    ]}
                >
                    <VoidShell>
                        <GestureDetector gesture={dragToDismiss}>
                            <View style={styles.handleArea}>
                                <View style={[styles.handle, { backgroundColor: colors.textTertiary }]} />
                            </View>
                        </GestureDetector>

                        <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                            {children}
                        </View>
                    </VoidShell>
                </Animated.View>
            </GestureHandlerRootView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1, justifyContent: 'flex-end' },
    scrim: { backgroundColor: 'rgba(0,0,0,0.2)' },
    sheet: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        overflow: 'hidden',
        borderWidth: 1,
        borderBottomWidth: 0,
    },
    handleArea: { height: 22, alignItems: 'center', justifyContent: 'center' },
    handle: { width: 40, height: 4, borderRadius: 2, opacity: 0.45 },
    content: { flex: 1 },
});
