import React, { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { interpolate, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Hourglass } from './Hourglass';
import { on, type AppEvents } from '@/lib/appEvents';
import { useTokens } from '@/hooks/useTokens';
import { glassDesign } from '@/theme/hourglassDesigns';
import { CEREMONY, DURATION, EASE, timingFor } from '@/theme/motion';

type Reveal = AppEvents['glass_reveal'];

// Built once, outside any worklet (a helper call inside one crashes natively).
const SPIN = timingFor(CEREMONY.gather, EASE.move);
const PART = timingFor(CEREMONY.reveal, EASE.enter);
const COVER_IN = timingFor(DURATION.base, EASE.enter);
const COVER_OUT = timingFor(CEREMONY.reveal, EASE.exit);

/**
 * Tapping the day's hourglass on Home (DayHourglass): the glass turns once,
 * the page darkens behind it, then its two halves pull apart, the top up and
 * away, the bottom down, and the Roadmap is there underneath, quiet. Drawn
 * over everything, from the app's root, so it spans Home and the Roadmap.
 * With Reduce Motion it simply opens the Roadmap.
 */
export function GlassReveal() {
    const t = useTokens();
    const reduced = useReducedMotion();
    const { height: screen } = useWindowDimensions();
    const [reveal, setReveal] = useState<Reveal | null>(null);
    const spin = useSharedValue(0);
    const part = useSharedValue(0);
    const cover = useSharedValue(0);
    const ran = useSharedValue(0);

    useEffect(() => {
        const sub = on('glass_reveal', event => {
            if (reduced) { router.navigate('/(root)/(tabs)/roadmap' as never); return; }
            ran.set(event.ran);
            spin.set(0); part.set(0); cover.set(0);
            setReveal(event);
        });
        return () => sub.remove();
    }, [reduced, ran, spin, part, cover]);

    useEffect(() => {
        if (!reveal) return;
        const open = () => router.navigate('/(root)/(tabs)/roadmap' as never);
        const finish = () => setReveal(null);
        cover.set(withTiming(1, COVER_IN));
        spin.set(withTiming(1, SPIN, done => {
            if (!done) return;
            runOnJS(open)();
            part.set(withTiming(1, PART, gone => { if (gone) runOnJS(finish)(); }));
            cover.set(withSequence(withTiming(1, { duration: DURATION.quick }), withTiming(0, COVER_OUT)));
        }));
    }, [reveal, spin, part, cover]);

    // Plain numbers for the worklets.
    const frame = reveal?.frame ?? { x: 0, y: 0, width: 0, height: 0 };
    const up = frame.y + frame.height;
    const down = screen - frame.y;

    const coverStyle = useAnimatedStyle(() => ({ opacity: cover.get() }));
    const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${360 * spin.get()}deg` }] }));
    const topStyle = useAnimatedStyle(() => ({
        opacity: interpolate(part.get(), [0, 0.8, 1], [1, 1, 0]),
        transform: [{ translateY: -up * part.get() }, { rotate: `${-14 * part.get()}deg` }],
    }));
    const bottomStyle = useAnimatedStyle(() => ({
        opacity: interpolate(part.get(), [0, 0.8, 1], [1, 1, 0]),
        transform: [{ translateY: down * part.get() }, { rotate: `${10 * part.get()}deg` }],
    }));

    if (!reveal) return null;
    const design = glassDesign(reveal.rank);
    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.color.background }, coverStyle]} />
            <Animated.View style={[styles.glass, { left: frame.x, top: frame.y, width: frame.width, height: frame.height }, spinStyle]}>
                <Animated.View style={[StyleSheet.absoluteFill, topStyle]}>
                    <Hourglass design={design} size={frame.height} ran={ran} running={false} part="top" />
                </Animated.View>
                <Animated.View style={[StyleSheet.absoluteFill, bottomStyle]}>
                    <Hourglass design={design} size={frame.height} ran={ran} running={false} part="bottom" />
                </Animated.View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    glass: { position: 'absolute' },
});
