import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
    cancelAnimation, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { useLowPower } from '@/lib/lowPower';
import { useTokens } from '@/hooks/useTokens';
import { s } from '@/theme/scale';
import { EASE, timingFor } from '@/theme/motion';
import type { EchoMood } from '@/lib/echo';

/** The two sizes Echo comes in: on its own in a scene, or beside a line it says. */
const SIZES = { large: s(28), small: s(10) } as const;
const RINGS = 3;

/** What each mood does: how near, how bright, how fast it breathes, how high it floats. */
const MOODS: Record<EchoMood, { near: number; bright: number; breath: number; rise: number }> = {
    appear: { near: 0.9, bright: 0.6, breath: 3200, rise: 0 },
    idle: { near: 1, bright: 0.7, breath: 2200, rise: 0 },
    listen: { near: 1.12, bright: 0.65, breath: 3400, rise: -6 },
    speak: { near: 1, bright: 0.85, breath: 1600, rise: 0 },
    curious: { near: 1.06, bright: 0.8, breath: 2200, rise: -10 },
    think: { near: 0.94, bright: 0.5, breath: 4200, rise: 4 },
    empathetic: { near: 1.04, bright: 0.5, breath: 4600, rise: 10 },
    excited: { near: 1.1, bright: 1, breath: 1400, rise: -14 },
    encourage: { near: 1.06, bright: 0.9, breath: 2400, rise: -8 },
    celebrate: { near: 1.18, bright: 1, breath: 1200, rise: -18 },
};

const MOOD_EASE = timingFor(900, EASE.move);
const ARRIVE = timingFor(1600, EASE.enter);
const BURST = timingFor(1400, EASE.enter);

/**
 * Echo, drawn: the one look it has everywhere (the Ascent, Home, Echo's
 * settings). A light in the accent with sound rings travelling out of it and
 * fading, the way an echo comes back out of the dark. Its mood moves it a
 * little nearer when it asks something personal, quieter and lower on
 * something hard, brighter when something good happens; it breathes faster
 * while it speaks, and celebrating sends one ring out. With Reduce Motion it
 * holds still, in its mood.
 *
 * The drawing is in this one file so a designed Echo (a Rive file with the
 * same moods as inputs) can replace it without any screen changing.
 */
export function Echo({ mood = 'idle', speaking, size = 'large', color }: { mood?: EchoMood; speaking?: boolean; size?: keyof typeof SIZES; color?: string }) {
    const t = useTokens();
    // Low Power Mode calms it like Reduce Motion: no looping breath on a throttled phone.
    const lowPower = useLowPower();
    const reduced = useReducedMotion() || lowPower;
    const ink = color ?? t.color.accent;
    const core = SIZES[size];
    const look = MOODS[mood];
    const presence = useSharedValue(reduced ? 1 : 0);
    const near = useSharedValue(look.near);
    const bright = useSharedValue(look.bright);
    const rise = useSharedValue(reduced ? 0 : look.rise);
    const breath = useSharedValue(0);
    const burst = useSharedValue(0);
    // Worked out here: worklets only read numbers.
    const reach = size === 'large' ? 1 : 0.4;

    // Arriving out of the dark, once.
    useEffect(() => { presence.set(withTiming(1, ARRIVE)); }, [presence]);

    // A mood is eased into, never snapped.
    useEffect(() => {
        near.set(withTiming(look.near, MOOD_EASE));
        bright.set(withTiming(look.bright, MOOD_EASE));
        rise.set(withTiming(reduced ? 0 : look.rise * reach, MOOD_EASE));
        if (mood === 'celebrate' || mood === 'excited') {
            burst.set(0);
            burst.set(withTiming(1, BURST));
        }
    }, [mood, look, near, bright, rise, burst, reduced, reach]);

    // Breathing: slow when quiet, quicker while speaking.
    useEffect(() => {
        if (reduced) return;
        const pace = speaking ? Math.min(look.breath, 1500) : look.breath;
        const half = timingFor(pace / 2, EASE.move);
        breath.set(0);
        breath.set(withRepeat(withSequence(withTiming(1, half), withTiming(0, half)), -1, false));
        return () => cancelAnimation(breath);
    }, [speaking, look.breath, breath, reduced]);

    const body = useAnimatedStyle(() => ({
        opacity: presence.get(),
        transform: [{ translateY: rise.get() + (1 - presence.get()) * 20 * reach }, { scale: near.get() * (0.7 + presence.get() * 0.3) }],
    }));
    const heart = useAnimatedStyle(() => ({ opacity: 0.55 + bright.get() * 0.45, transform: [{ scale: 1 + breath.get() * 0.12 }] }));
    const glow = useAnimatedStyle(() => ({ opacity: (0.25 + breath.get() * 0.2) * (0.5 + bright.get()), transform: [{ scale: 1.6 + breath.get() * 0.3 + bright.get() * 0.5 }] }));
    const ring = useAnimatedStyle(() => ({ opacity: interpolate(burst.get(), [0, 0.1, 1], [0, 0.6, 0]), transform: [{ scale: 1 + burst.get() * 6 }] }));

    const field = core * 5;
    const disc = { width: core, height: core, borderRadius: core / 2 };
    return (
        <Animated.View style={[styles.field, { width: field, height: field }, body]} pointerEvents="none"
            accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {size === 'large' && !reduced
                ? Array.from({ length: RINGS }, (_, index) => (
                    <Ring key={`${look.breath}-${index}`} delay={(index * look.breath * 1.4) / RINGS} period={look.breath * 1.4} color={ink} disc={disc} />
                ))
                : null}
            <Animated.View style={[styles.disc, disc, styles.ring, { borderColor: ink }, ring]} />
            <Animated.View style={[styles.disc, disc, { backgroundColor: t.tint('soft', ink) }, glow]} />
            <Animated.View style={[styles.disc, disc, { backgroundColor: ink }, heart]} />
        </Animated.View>
    );
}

/** One sound ring, travelling out and fading. */
function Ring({ delay, period, color, disc }: { delay: number; period: number; color: string; disc: object }) {
    const grow = useSharedValue(0);
    useEffect(() => {
        grow.set(withDelay(delay, withRepeat(withTiming(1, timingFor(period, EASE.enter)), -1, false)));
        return () => cancelAnimation(grow);
    }, [delay, period, grow]);
    const style = useAnimatedStyle(() => ({ opacity: (1 - grow.get()) * 0.5, transform: [{ scale: 1 + grow.get() * 4 }] }));
    return <Animated.View style={[styles.disc, disc, styles.ring, { borderColor: color }, style]} />;
}

const styles = StyleSheet.create({
    field: { alignItems: 'center', justifyContent: 'center' },
    disc: { position: 'absolute' },
    ring: { borderWidth: StyleSheet.hairlineWidth * 2 },
});

export type { EchoMood };
