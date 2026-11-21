import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, ReduceMotion, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { FontFamily } from '@/theme/designSystem';
import { clockText, type ClockStyle } from '@/lib/focusClock';

const FOCUS_TEXT = '#FFFFFF';
/** Words under the clock (Paused, Over time): 0.6 white on black reads at 7:1, the dim tone only 3:1. */
const FOCUS_LABEL = 'rgba(255,255,255,0.6)';
/** The ring's track and the disc inside it: there, but quieter than anything you read. */
const RING_TRACK = 'rgba(255,255,255,0.08)';
const RING_DISC = 'rgba(255,255,255,0.035)';

/**
 * The focus clock, drawn as cheaply as possible: plain text and, for the
 * ring, one arc that moves once a second. Sized from the screen, so on its
 * side it fills the width.
 *
 * Ring (the default): a thick ring of how far the session has got around a
 * quiet disc holding Habyss's mark, which breathes slowly while the clock
 * runs and rests when it is paused (still under Reduce Motion), and the time
 * in large figures under it. Digital is the figures alone; Minimal, thin
 * figures over a hairline.
 */
export function FocusClock({ seconds, progress, style, accent, label, running = true, heading }: {
    /** What to show: time left for a timer, time spent for a stopwatch. */
    seconds: number;
    /** 0–1 for a timer; null for a stopwatch. */
    progress: number | null;
    style: ClockStyle;
    accent: string;
    label?: string;
    /** False while paused: the mark rests. */
    running?: boolean;
    /** What is being focused on: under the hourglass (on its podium), above any other clock. */
    heading?: React.ReactNode;
}) {
    const { width, height } = useWindowDimensions();
    const landscape = width > height;
    const text = clockText(seconds);
    const long = text.length > 5;
    const digits = (landscape ? width * 0.2 : width * 0.21) * (long ? 0.78 : 1);

    if (style === 'hourglass') {
        // The hourglass on Home's podium (components/Focus/FocusHourglass.tsx), the time under it.
        const { FocusHourglass } = require('./FocusHourglass') as typeof import('./FocusHourglass');
        const glass = Math.min(width, height) * (landscape ? 0.6 : 0.62);
        return (
            <View style={landscape ? styles.side : styles.center}>
                <FocusHourglass size={glass} progress={progress} seconds={seconds} running={running} />
                {heading}
                <FocusDigits seconds={seconds} size={digits * 0.75} label={label} gap={landscape ? 0 : glass * 0.04} />
            </View>
        );
    }
    if (style === 'ring') {
        const ring = Math.min(width, height) * (landscape ? 0.6 : 0.66);
        return (
            <View style={landscape ? styles.side : styles.center}>
                {heading}
                <FocusRing size={ring} progress={progress} accent={accent} running={running} />
                <FocusDigits seconds={seconds} size={digits * 0.92} label={label} gap={landscape ? 0 : ring * 0.08} />
            </View>
        );
    }
    return (
        <View style={styles.center}>
            {heading}
            <SteadyTime text={text} size={digits} color={FOCUS_TEXT} />
            {label ? <Text style={[styles.label, { color: FOCUS_LABEL }]}>{label}</Text> : null}
        </View>
    );
}

/**
 * The ring alone: how far the session has got, around a quiet disc holding
 * Habyss's mark. Sized by the page, so it can sit above the figures or beside
 * them.
 */
export function FocusRing({ size, progress, accent, running = true }: { size: number; progress: number | null; accent: string; running?: boolean }) {
    const stroke = Math.round(size * 0.055);
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const disc = r - stroke * 1.6;
    return (
        <View style={[styles.center, { width: size, height: size }]}>
            <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
                <Circle cx={size / 2} cy={size / 2} r={r} stroke={RING_TRACK} strokeWidth={stroke} fill="none" />
                <Circle cx={size / 2} cy={size / 2} r={disc} fill={RING_DISC} />
                {/* A stopwatch has no end, so its ring is whole. */}
                <Circle cx={size / 2} cy={size / 2} r={r} stroke={accent} strokeWidth={stroke} fill="none" strokeLinecap="round"
                    strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - (progress ?? 1))} rotation={-90} origin={`${size / 2}, ${size / 2}`} />
            </Svg>
            <Mark size={disc * 0.78} running={running} />
        </View>
    );
}

/**
 * A time where every digit has a slot of its own, the same width whatever the
 * digit, so the time never shifts sideways as it counts. The font's own
 * digits are not all one width.
 */
export function SteadyTime({ text, size, color, weight = 'bold' }: { text: string; size: number; color: string; weight?: 'bold' | 'regular' }) {
    const digit = size * 0.64;
    const colon = size * 0.3;
    return (
        <View style={styles.steady} accessible accessibilityLabel={text}>
            {[...text].map((char, index) => (
                <Text key={index} style={[weight === 'bold' ? styles.digits : styles.thin,
                    { fontSize: size, lineHeight: size * 1.08, color, width: char === ':' ? colon : digit, textAlign: 'center', letterSpacing: 0 }]}>
                    {char}
                </Text>
            ))}
        </View>
    );
}

/** The figures alone, with a quiet line under them. */
export function FocusDigits({ seconds, size, label, gap = 0 }: { seconds: number; size: number; label?: string; gap?: number }) {
    return (
        <View style={[styles.center, { marginTop: gap }]}>
            <SteadyTime text={clockText(seconds)} size={size} color={FOCUS_TEXT} />
            {label ? <Text style={[styles.label, { color: FOCUS_LABEL }]}>{label}</Text> : null}
        </View>
    );
}

/** Habyss's mark in the ring: a slow breath while focusing, still when paused. */
function Mark({ size, running }: { size: number; running: boolean }) {
    const breath = useSharedValue(1);
    useEffect(() => {
        if (running) {
            breath.value = withRepeat(withTiming(1.06, { duration: 2400, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.System }), -1, true);
        } else {
            cancelAnimation(breath);
            breath.value = withTiming(1, { duration: 300, reduceMotion: ReduceMotion.System });
        }
    }, [running, breath]);
    const style = useAnimatedStyle(() => ({ transform: [{ scale: breath.value }] }));
    return (
        <Animated.View style={[style, { opacity: running ? 1 : 0.45 }]}>
            <Image source={require('@/assets/images/habyss-mark.png')} style={{ width: size, height: size }} resizeMode="contain"
                accessibilityIgnoresInvertColors accessible={false} />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    center: { alignItems: 'center', justifyContent: 'center' },
    steady: { flexDirection: 'row', alignItems: 'center' },
    side: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 48 },
    digits: { fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'], letterSpacing: -2 },
    thin: { fontFamily: FontFamily.regular, fontVariant: ['tabular-nums'], letterSpacing: -3 },
    label: { fontFamily: FontFamily.medium, fontSize: 15, marginTop: 6 },
});
