import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { AppIcon } from './AppIcon';
import { useTokens } from '@/hooks/useTokens';
import { DURATION, EASE, STAGGER, timingFor } from '@/theme/motion';
import { Spacing } from '@/theme/designSystem';

const DOT = Spacing.xl;
const LINE = Spacing.xs / 2;

/** One step: a ring that fills in the accent, a tick landing in it. */
function Step({ done, index }: { done: boolean; index: number }) {
    const t = useTokens();
    const lit = useSharedValue(0);
    useEffect(() => { lit.set(withDelay(index * STAGGER.stage, withTiming(done ? 1 : 0, timingFor(DURATION.emphasis, EASE.move)))); }, [done, index, lit]);
    const fill = useAnimatedStyle(() => ({ opacity: lit.get(), transform: [{ scale: 0.6 + lit.get() * 0.4 }] }));
    return (
        <View style={[styles.dot, { borderColor: done ? t.color.accent : t.color.textSubtle }]}>
            <Animated.View style={[StyleSheet.absoluteFill, styles.fill, { backgroundColor: t.color.accent }, fill]}>
                <AppIcon name="checkmark" size={Spacing.md} color={t.color.onAccent} />
            </Animated.View>
        </View>
    );
}

/** The line between two steps, lit once the step before it is done. */
function Joint({ lit, index }: { lit: boolean; index: number }) {
    const t = useTokens();
    const on = useSharedValue(0);
    useEffect(() => { on.set(withDelay(index * STAGGER.stage, withTiming(lit ? 1 : 0, timingFor(DURATION.emphasis, EASE.move)))); }, [lit, index, on]);
    const grow = useAnimatedStyle(() => ({ width: `${on.get() * 100}%` }));
    return (
        <View style={[styles.line, { backgroundColor: t.color.textSubtle }]}>
            <Animated.View style={[styles.lineFill, { backgroundColor: t.color.accent }, grow]} />
        </View>
    );
}

/**
 * Steps along a line: a ring each, filling in the accent as each is done, the
 * line between them lighting up behind. "1 of 3" for the eye; VoiceOver hears
 * the count, never colour alone.
 */
export function StepTrack({ done, label }: { done: boolean[]; label?: string }) {
    const count = done.filter(Boolean).length;
    return (
        <View style={styles.row} accessible accessibilityRole="progressbar"
            accessibilityLabel={label ?? 'Steps'} accessibilityValue={{ min: 0, max: done.length, now: count, text: `${count} of ${done.length} done` }}>
            {done.map((step, index) => (
                <React.Fragment key={index}>
                    {index > 0 ? <Joint lit={done[index - 1]! && step} index={index} /> : null}
                    <Step done={step} index={index} />
                </React.Fragment>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center' },
    dot: { width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: LINE, overflow: 'hidden' },
    fill: { alignItems: 'center', justifyContent: 'center', borderRadius: DOT / 2 },
    line: { width: Spacing.xxl, height: LINE, overflow: 'hidden' },
    lineFill: { height: '100%' },
});
