import React, { useEffect } from 'react';
import { Image, StyleSheet, useWindowDimensions } from 'react-native';
import { releaseIntro } from '@/lib/introGate';
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
 * the crack as it opens, and dives until the two sides meet the edges of the
 * screen, while the black falls away and the app is there, its numbers and
 * charts starting as it appears. Once per launch, about three seconds, and it
 * never blocks a tap.
 */
export function CrackIntro({ onDone }: { onDone: () => void }) {
    const { width, height } = useWindowDimensions();
    const fall = useSharedValue(0);
    // How far to zoom so the logo's outer edges reach the screen's edges.
    const fill = width / LOGO_WIDTH;

    useEffect(() => {
        // A slow push in while the crack opens, then the dive, until the two
        // sides meet the edges of the screen; the app shows through as it ends.
        const DURATION = 2600;
        fall.value = withDelay(300, withTiming(1, { duration: DURATION, easing: Easing.inOut(Easing.cubic), reduceMotion: ReduceMotion.System }, done => {
            if (done) runOnJS(onDone)();
        }));
        // Numbers, bars and rings start as the app comes into view, not under the black.
        const release = setTimeout(releaseIntro, 300 + DURATION * 0.8);
        return () => clearTimeout(release);
    }, [fall, onDone]);

    // The app is revealed only once the two sides have spread out.
    const ground = useAnimatedStyle(() => ({ opacity: interpolate(fall.value, [0, 0.8, 1], [1, 1, 0], 'clamp') }));
    // The camera, pushing into the crack: gently, then all the way to the edges.
    // The zoom runs ahead of the parting: it reaches the edges at 70% of the
    // way, while the crack keeps opening at its own pace to the end.
    const camera = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(fall.value, [0, 0.3, 0.7], [1, 1.6, fill], 'clamp') }] }));
    const piece = (side: -1 | 1) => () => {
        'worklet';
        // The crack opens as you go in; the sides stay at the screen's edges.
        // Fully spread out by 80% of the way: the reveal only starts after.
        const part = interpolate(fall.value, [0, 0.45, 0.8], [0, 0.015, 0.2], 'clamp');
        return {
            opacity: interpolate(fall.value, [0, 0.8, 0.9], [1, 1, 0], 'clamp'),
            transform: [
                { translateX: side * part * width },
                { translateY: -side * part * height * 0.35 },
            ],
        };
    };
    const left = useAnimatedStyle(piece(-1));
    const right = useAnimatedStyle(piece(1));
    const box = { left: (width - LOGO_WIDTH) / 2, top: (height - LOGO_HEIGHT) / 2, width: LOGO_WIDTH, height: LOGO_HEIGHT };

    return (
        // A real launch screen: it takes every touch (and hides the app from VoiceOver) until it is done,
        // so nothing under it can be tapped open while it plays.
        <Animated.View pointerEvents="auto" accessibilityViewIsModal onStartShouldSetResponder={() => true}
            style={[StyleSheet.absoluteFill, styles.ground, ground]}>
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
