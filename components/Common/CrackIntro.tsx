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
 * size), so the handover cannot be seen; then the two pieces part and rush
 * past the edges, faster and faster, as if you are falling in, while the
 * black falls away and the app is there. Once per launch, a little over a
 * second, and it never blocks a tap for longer than that.
 */
export function CrackIntro({ onDone }: { onDone: () => void }) {
    const { width, height } = useWindowDimensions();
    const fall = useSharedValue(0);

    useEffect(() => {
        fall.value = withDelay(180, withTiming(1, { duration: 950, easing: Easing.in(Easing.cubic), reduceMotion: ReduceMotion.System }, done => {
            if (done) runOnJS(onDone)();
        }));
    }, [fall, onDone]);

    const ground = useAnimatedStyle(() => ({ opacity: interpolate(fall.value, [0, 0.35, 0.9], [1, 1, 0], 'clamp') }));
    const piece = (side: -1 | 1) => () => {
        'worklet';
        return {
            opacity: interpolate(fall.value, [0, 0.6, 1], [1, 1, 0], 'clamp'),
            transform: [
                { translateX: side * fall.value * width * 0.7 },
                { translateY: -side * fall.value * height * 0.32 },
                { scale: interpolate(fall.value, [0, 1], [1, 6]) },
            ],
        };
    };
    const left = useAnimatedStyle(piece(-1));
    const right = useAnimatedStyle(piece(1));
    const box = { left: (width - LOGO_WIDTH) / 2, top: (height - LOGO_HEIGHT) / 2, width: LOGO_WIDTH, height: LOGO_HEIGHT };

    return (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.ground, ground]}>
            <Animated.View style={[styles.piece, box, left]}>
                <Image source={LEFT} style={styles.image} resizeMode="contain" />
            </Animated.View>
            <Animated.View style={[styles.piece, box, right]}>
                <Image source={RIGHT} style={styles.image} resizeMode="contain" />
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    ground: { backgroundColor: '#000000', zIndex: 9999, elevation: 9999 },
    piece: { position: 'absolute' },
    image: { width: '100%', height: '100%' },
});
