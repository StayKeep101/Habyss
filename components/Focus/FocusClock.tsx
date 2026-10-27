import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, ReduceMotion, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { FontFamily } from '@/theme/designSystem';
import { clockText, type ClockStyle } from '@/lib/focusClock';

const FOCUS_TEXT = '#FFFFFF';
const FOCUS_DIM = 'rgba(255,255,255,0.35)';
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
export function FocusClock({ seconds, progress, style, accent, label, running = true }: {
    /** What to show: time left for a timer, time spent for a stopwatch. */
    seconds: number;
    /** 0–1 for a timer; null for a stopwatch. */
    progress: number | null;
    style: ClockStyle;
    accent: string;
    label?: string;
    /** False while paused: the mark rests. */
    running?: boolean;
}) {
    const { width, height } = useWindowDimensions();
    const landscape = width > height;
    const text = clockText(seconds);
    const long = text.length > 5;
    const size = Math.min(width, height) * (landscape ? 0.82 : 0.78);
    const digits = (landscape ? width * 0.2 : width * 0.21) * (long ? 0.78 : 1);

    if (style === 'ring') {
        const ring = Math.min(width, height) * (landscape ? 0.6 : 0.66);
        const stroke = Math.round(ring * 0.055);
        const r = (ring - stroke) / 2;
        const c = 2 * Math.PI * r;
        const disc = r - stroke * 1.6;
        return (
            <View style={landscape ? styles.side : styles.center}>
                <View style={[styles.center, { width: ring, height: ring }]}>
                    <Svg width={ring} height={ring} style={StyleSheet.absoluteFill}>
                        <Circle cx={ring / 2} cy={ring / 2} r={r} stroke={RING_TRACK} strokeWidth={stroke} fill="none" />
                        <Circle cx={ring / 2} cy={ring / 2} r={disc} fill={RING_DISC} />
                        {/* A stopwatch has no end, so its ring is whole. */}
                        <Circle cx={ring / 2} cy={ring / 2} r={r} stroke={accent} strokeWidth={stroke} fill="none" strokeLinecap="round"
                            strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - (progress ?? 1))} rotation={-90} origin={`${ring / 2}, ${ring / 2}`} />
                    </Svg>
                    <Mark size={disc * 0.78} running={running} />
                </View>
                <View style={styles.center}>
                    <Text style={[styles.digits, { fontSize: digits * 0.92, color: FOCUS_TEXT, marginTop: landscape ? 0 : ring * 0.08 }]}>{text}</Text>
                    {label ? <Text style={[styles.label, { color: FOCUS_LABEL }]}>{label}</Text> : null}
                </View>
            </View>
        );
    }
    if (style === 'minimal') {
        return (
            <View style={styles.center}>
                <Text style={[styles.thin, { fontSize: digits * 1.05, color: FOCUS_TEXT }]}>{text}</Text>
                {progress !== null ? (
                    <View style={[styles.line, { width: size, backgroundColor: FOCUS_DIM }]}>
                        <View style={[styles.lineFill, { width: `${Math.round((progress ?? 0) * 100)}%`, backgroundColor: accent }]} />
                    </View>
                ) : null}
                {label ? <Text style={[styles.label, { color: FOCUS_LABEL }]}>{label}</Text> : null}
            </View>
        );
    }
    return (
        <View style={styles.center}>
            <Text style={[styles.digits, { fontSize: digits, color: FOCUS_TEXT }]}>{text}</Text>
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
    side: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 48 },
    digits: { fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'], letterSpacing: -2 },
    thin: { fontFamily: FontFamily.regular, fontVariant: ['tabular-nums'], letterSpacing: -3 },
    label: { fontFamily: FontFamily.medium, fontSize: 15, marginTop: 6 },
    line: { height: 2, marginTop: 18, borderRadius: 1, overflow: 'hidden' },
    lineFill: { height: '100%' },
});
