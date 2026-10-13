import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';

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
 * The box springs up and settles, and a ring of its own colour expands once
 * and fades. It only plays when the state actually changes to done, never on
 * first render, so a list of finished things does not fire twenty rings when
 * it appears.
 */
export const CheckPop: React.FC<Props> = ({ active, color, size, children }) => {
    const scale = useSharedValue(1);
    const ring = useSharedValue(0);
    const first = useRef(true);

    useEffect(() => {
        if (first.current) { first.current = false; return; }
        if (!active) return;
        scale.value = withSequence(
            withTiming(1.22, { duration: 130, easing: Easing.out(Easing.quad) }),
            withSpring(1, { damping: 9, stiffness: 220 }),
        );
        ring.value = 0;
        ring.value = withDelay(30, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
    }, [active]);

    const boxStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    const ringStyle = useAnimatedStyle(() => ({
        opacity: ring.value === 0 || ring.value === 1 ? 0 : 0.55 * (1 - ring.value),
        transform: [{ scale: 1 + ring.value * 1.1 }],
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
