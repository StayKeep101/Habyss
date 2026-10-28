import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    cancelAnimation, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { DURATION, EASE, timingFor } from '@/theme/motion';
import type { Mood } from '@/lib/ascent/story';

const CORE = 30;

/** What each mood does to Echo: how near, how bright, how fast it breathes, how high it floats. */
const MOODS: Record<Mood, { near: number; bright: number; breath: number; rise: number }> = {
    appear: { near: 0.9, bright: 0.6, breath: 3200, rise: 0 },
    idle: { near: 1, bright: 0.7, breath: 3000, rise: 0 },
    listen: { near: 1.12, bright: 0.65, breath: 3400, rise: -6 },
    speak: { near: 1, bright: 0.85, breath: 1600, rise: 0 },
    curious: { near: 1.06, bright: 0.8, breath: 2200, rise: -10 },
    think: { near: 0.94, bright: 0.5, breath: 4200, rise: 4 },
    empathetic: { near: 1.04, bright: 0.5, breath: 4600, rise: 10 },
    excited: { near: 1.1, bright: 1, breath: 1400, rise: -14 },
    encourage: { near: 1.06, bright: 0.9, breath: 2400, rise: -8 },
    celebrate: { near: 1.18, bright: 1, breath: 1200, rise: -18 },
};

/**
 * Echo, the companion of the Ascent: a living light, grown from the onboarding
 * orb. Its mood (lib/ascent/story.ts) moves it a little nearer when it asks
 * something personal, quieter and lower on something hard, brighter when
 * something good happens; it breathes faster while it speaks. Celebrating
 * sends one ring out. Never more than that: it should feel alive, not busy.
 */
export function EchoLight({ mood, color, speaking }: { mood: Mood; color: string; speaking?: boolean }) {
    const reduced = useReducedMotion();
    const look = MOODS[mood];
    const presence = useSharedValue(0);
    const near = useSharedValue(look.near);
    const bright = useSharedValue(look.bright);
    const rise = useSharedValue(look.rise);
    const breath = useSharedValue(0);
    const ring = useSharedValue(0);

    // Arriving out of the dark, once.
    useEffect(() => { presence.value = withTiming(1, timingFor(reduced ? DURATION.base : 1600, EASE.enter)); }, [presence, reduced]);

    // A mood is eased into, never snapped.
    useEffect(() => {
        const ease = timingFor(900, EASE.move);
        near.value = withTiming(look.near, ease);
        bright.value = withTiming(look.bright, ease);
        rise.value = withTiming(reduced ? 0 : look.rise, ease);
        if (mood === 'celebrate' || mood === 'excited') {
            ring.value = 0;
            ring.value = withTiming(1, timingFor(1400, EASE.enter));
        }
    }, [mood, look, near, bright, rise, ring, reduced]);

    // Breathing: slow when quiet, quicker while speaking.
    useEffect(() => {
        if (reduced) return;
        const pace = speaking ? Math.min(look.breath, 1500) : look.breath;
        breath.value = 0;
        breath.value = withRepeat(withSequence(withTiming(1, timingFor(pace / 2, EASE.move)), withTiming(0, timingFor(pace / 2, EASE.move))), -1, false);
        return () => cancelAnimation(breath);
    }, [speaking, look.breath, breath, reduced]);

    const body = useAnimatedStyle(() => ({
        opacity: presence.value,
        transform: [{ translateY: rise.value + (1 - presence.value) * 20 }, { scale: near.value * (0.7 + presence.value * 0.3) }],
    }));
    const core = useAnimatedStyle(() => ({ opacity: 0.55 + bright.value * 0.45, transform: [{ scale: 1 + breath.value * 0.1 }] }));
    const glow = useAnimatedStyle(() => ({ opacity: (0.18 + breath.value * 0.14) * (0.5 + bright.value), transform: [{ scale: 2.4 + breath.value * 0.5 + bright.value * 0.6 }] }));
    const halo = useAnimatedStyle(() => ({ opacity: 0.08 * bright.value, transform: [{ scale: 5 + breath.value * 0.6 }] }));
    const burst = useAnimatedStyle(() => ({ opacity: interpolate(ring.value, [0, 0.1, 1], [0, 0.6, 0]), transform: [{ scale: 1 + ring.value * 6 }] }));

    return (
        <Animated.View style={[styles.field, body]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
            <Animated.View style={[styles.core, { backgroundColor: color }, halo]} />
            <Animated.View style={[styles.core, { backgroundColor: color }, glow]} />
            <Animated.View style={[styles.core, styles.ring, { borderColor: color }, burst]} />
            <Animated.View style={[styles.core, { backgroundColor: color }, core]}>
                <View style={styles.heart} />
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    field: { width: CORE * 6, height: CORE * 6, alignItems: 'center', justifyContent: 'center' },
    core: { position: 'absolute', width: CORE, height: CORE, borderRadius: CORE / 2, alignItems: 'center', justifyContent: 'center' },
    ring: { backgroundColor: 'transparent', borderWidth: 1.5 },
    heart: { width: CORE * 0.42, height: CORE * 0.42, borderRadius: CORE, backgroundColor: 'rgba(255,255,255,0.85)' },
});
