import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming,
} from 'react-native-reanimated';
import { DURATION, EASE } from '@/theme/motion';

/** How far the box swells as it fills, and how far its ring travels: small, so neither is cut off at a card's edge. */
const SWELL = 1.12;
const RING = 0.45;

interface Props {
    /** True once the thing is done. */
    active: boolean;
    color: string;
    size: number;
    children: React.ReactNode;
}

/**
 * The little moment of completing something.
 *
 * The box swells a little and settles (eased, no bounce: docs/motion-system.md),
 * and a ring of its own colour widens once, close to it, and fades. It only
 * plays when the state actually changes to done, never on first render, so a
 * list of finished things does not fire twenty rings when it appears. Reduce
 * Motion shows it done with no movement.
 */
export const CheckPop: React.FC<Props> = ({ active, color, size, children }) => {
    const scale = useSharedValue(1);
    const ring = useSharedValue(0);
    const first = useRef(true);

    useEffect(() => {
        if (first.current) { first.current = false; return; }
        if (!active) return;
        scale.value = withSequence(
            withTiming(SWELL, { duration: DURATION.tap, easing: EASE.enter, reduceMotion: ReduceMotion.System }),
            withTiming(1, { duration: DURATION.quick, easing: EASE.move, reduceMotion: ReduceMotion.System }),
        );
        ring.value = 0;
        ring.value = withDelay(DURATION.tap / 4, withTiming(1, { duration: DURATION.base, easing: EASE.enter, reduceMotion: ReduceMotion.System }));
    }, [active]);

    const boxStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    const ringStyle = useAnimatedStyle(() => ({
        opacity: ring.value === 0 || ring.value === 1 ? 0 : 0.55 * (1 - ring.value),
        transform: [{ scale: 1 + ring.value * RING }],
    }));

    return (
        <View style={styles.wrap}>
            <Animated.View
                pointerEvents="none"
                style={[
                    styles.ring,
                    { width: size, height: size, borderRadius: size / 2, borderColor: color },
                    ringStyle,
                ]}
            />
            <Animated.View style={boxStyle}>{children}</Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: { alignItems: 'center', justifyContent: 'center' },
    ring: { position: 'absolute', borderWidth: 2 },
});
