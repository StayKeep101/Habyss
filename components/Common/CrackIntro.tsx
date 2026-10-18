import React, { useEffect } from 'react';
import { Image, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { Easing, ReduceMotion, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

/** The logo as the native launch screen draws it: 200pt image, the mark 41% of it. */
const LOGO_WIDTH = 82;
const LOGO_HEIGHT = 94;
const LEFT = require('@/assets/images/crack-left.png');
const RIGHT = require('@/assets/images/crack-right.png');

/**
 * Opening the app is going down the crack.
 *
 * The logo is two pieces with a crack between them: the abyss. This starts on
 * exactly the launch screen's frame (black, the mark in the middle, the same
 * size), so the handover cannot be seen; then the camera pushes slowly into
 * the crack as it opens, and dives through it as the two pieces fly past the
 * edges, while the black falls away and the app is there. Once per launch,
 * about two seconds, and it never blocks a tap.
 */
export function CrackIntro({ onDone }: { onDone: () => void }) {
    const { width, height } = useWindowDimensions();
    const fall = useSharedValue(0);

    useEffect(() => {
        // About two seconds: a slow push in while the crack opens, then the dive.
        fall.value = withDelay(250, withTiming(1, { duration: 1750, easing: Easing.inOut(Easing.cubic), reduceMotion: ReduceMotion.System }, done => {
            if (done) runOnJS(onDone)();
        }));
    }, [fall, onDone]);

    // The black stays until you are deep in the crack, then falls away.
    const ground = useAnimatedStyle(() => ({ opacity: interpolate(fall.value, [0, 0.7, 1], [1, 1, 0], 'clamp') }));
    // The camera: pushes into the crack, gently then all at once.
    const camera = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(fall.value, [0, 0.4, 1], [1, 1.6, 4.5]) }] }));
    const piece = (side: -1 | 1) => () => {
        'worklet';
        // The crack opens a little while the camera pushes in, then the two
        // sides fly past the edges as you go through.
        const part = interpolate(fall.value, [0, 0.4, 1], [0, 0.06, 0.75]);
        return {
            opacity: interpolate(fall.value, [0, 0.8, 1], [1, 1, 0], 'clamp'),
            transform: [
                { translateX: side * part * width },
                { translateY: -side * part * height * 0.45 },
                { scale: interpolate(fall.value, [0, 0.4, 1], [1, 1.05, 2]) },
            ],
        };
    };
    const left = useAnimatedStyle(piece(-1));
    const right = useAnimatedStyle(piece(1));
    const box = { left: (width - LOGO_WIDTH) / 2, top: (height - LOGO_HEIGHT) / 2, width: LOGO_WIDTH, height: LOGO_HEIGHT };

    return (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.ground, ground]}>
            <Animated.View style={[StyleSheet.absoluteFill, camera]}>
                <Animated.View style={[styles.piece, box, left]}>
                    <Image source={LEFT} style={styles.image} resizeMode="contain" />
                </Animated.View>
                <Animated.View style={[styles.piece, box, right]}>
                    <Image source={RIGHT} style={styles.image} resizeMode="contain" />
                </Animated.View>
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    ground: { backgroundColor: '#000000', zIndex: 9999, elevation: 9999 },
    piece: { position: 'absolute' },
    image: { width: '100%', height: '100%' },
});
