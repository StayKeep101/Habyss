import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, ReduceMotion, interpolate, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { AppIcon } from '@/components/ui/AppIcon';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { FontFamily, Radius } from '@/theme/designSystem';
import { ms, s, vs } from '@/theme/scale';

const LINE = ms(34);

/**
 * The trophy count going up by one: the old number rolls up and away, the new
 * one rolls in under it and the trophy jumps, with a tap you can feel.
 */
export function TrophyCount({ count, color, delay = 650 }: { count: number; color: string; delay?: number }) {
    const t = useTokens();
    const { successFeedback } = useHaptics();
    const roll = useSharedValue(0);
    const jump = useSharedValue(1);
    useEffect(() => {
        roll.set(withDelay(delay, withSpring(1, { damping: 13, stiffness: 140, reduceMotion: ReduceMotion.System })));
        jump.set(withDelay(delay, withSequence(
            withTiming(1.35, { duration: 180, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }),
            withSpring(1, { damping: 7, stiffness: 180, reduceMotion: ReduceMotion.System }),
        )));
        const tap = setTimeout(successFeedback, delay);
        return () => clearTimeout(tap);
    }, [roll, jump, delay, successFeedback]);

    const out = useAnimatedStyle(() => ({
        opacity: interpolate(roll.get(), [0, 0.6], [1, 0], 'clamp'),
        transform: [{ translateY: -roll.get() * LINE }],
    }));
    const into = useAnimatedStyle(() => ({
        opacity: interpolate(roll.get(), [0.2, 0.8], [0, 1], 'clamp'),
        transform: [{ translateY: (1 - roll.get()) * LINE }],
    }));
    const trophy = useAnimatedStyle(() => ({ transform: [{ scale: jump.get() }, { rotate: `${(jump.get() - 1) * 40}deg` }] }));

    return (
        <MatteSurface radius={Radius.pill} level="control" style={styles.pill}>
            <View accessible accessibilityLabel={`${count} ${count === 1 ? 'goal' : 'goals'} done`} style={styles.row}>
                <Animated.View style={trophy}>
                    <AppIcon name="trophy" filled size={s(22)} color={color} />
                </Animated.View>
                <View style={styles.window}>
                    <Animated.Text style={[styles.number, { color: t.color.textPrimary }, out]}>{Math.max(0, count - 1)}</Animated.Text>
                    <Animated.Text style={[styles.number, styles.under, { color: t.color.textPrimary }, into]}>{count}</Animated.Text>
                </View>
                <Text style={[styles.label, { color: t.color.textMuted }]}>{count === 1 ? 'goal done' : 'goals done'}</Text>
            </View>
        </MatteSurface>
    );
}

const styles = StyleSheet.create({
    pill: { alignSelf: 'center', marginTop: vs(10), paddingHorizontal: s(18), paddingVertical: vs(6) },
    row: { flexDirection: 'row', alignItems: 'center', gap: s(10) },
    // Only one line shows: the numbers roll through it.
    window: { height: LINE, overflow: 'hidden', minWidth: s(22) },
    number: { height: LINE, lineHeight: LINE, fontSize: ms(28), fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'], textAlign: 'center' },
    under: { position: 'absolute', left: 0, right: 0, top: 0 },
    label: { fontSize: ms(15), fontFamily: FontFamily.medium },
});
