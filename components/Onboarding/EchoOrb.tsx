import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Easing, ReduceMotion, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { useTokens } from '@/hooks/useTokens';
import { s } from '@/theme/scale';

const CORE = s(28);
const FIELD = CORE * 5;
const RINGS = 3;
const EASE = { easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System };

/**
 * Echo, drawn: a light with sound rings travelling out of it and fading, the
 * way an echo comes back out of the dark. `pace` is how long one breath
 * takes: a calm voice breathes slowly, an impatient one fast.
 */
export function EchoOrb({ pace = 2200 }: { pace?: number }) {
    const t = useTokens();
    const breath = useSharedValue(0);
    useEffect(() => {
        breath.value = 0;
        breath.value = withRepeat(withSequence(
            withTiming(1, { duration: pace / 2, ...EASE }), withTiming(0, { duration: pace / 2, ...EASE })), -1, false);
        return () => cancelAnimation(breath);
    }, [pace, breath]);
    const core = useAnimatedStyle(() => ({ transform: [{ scale: 1 + breath.value * 0.12 }] }));
    const glow = useAnimatedStyle(() => ({ opacity: 0.25 + breath.value * 0.2, transform: [{ scale: 1.6 + breath.value * 0.3 }] }));
    return (
        <View style={styles.field} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {Array.from({ length: RINGS }, (_, index) => (
                <Ring key={`${pace}-${index}`} delay={(index * pace * 1.4) / RINGS} period={pace * 1.4} color={t.color.accent} />
            ))}
            <Animated.View style={[styles.core, { backgroundColor: t.tint('soft') }, glow]} />
            <Animated.View style={[styles.core, { backgroundColor: t.color.accent }, core]} />
        </View>
    );
}

function Ring({ delay, period, color }: { delay: number; period: number; color: string }) {
    const grow = useSharedValue(0);
    useEffect(() => {
        grow.value = withDelay(delay, withRepeat(withTiming(1, { duration: period, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }), -1, false));
        return () => cancelAnimation(grow);
    }, [delay, period, grow]);
    const style = useAnimatedStyle(() => ({ opacity: (1 - grow.value) * 0.5, transform: [{ scale: 1 + grow.value * 4 }] }));
    return <Animated.View style={[styles.core, styles.ring, { borderColor: color }, style]} />;
}

const styles = StyleSheet.create({
    field: { width: FIELD, height: FIELD, alignItems: 'center', justifyContent: 'center' },
    core: { position: 'absolute', width: CORE, height: CORE, borderRadius: CORE / 2 },
    ring: { borderWidth: StyleSheet.hairlineWidth * 2 },
});
