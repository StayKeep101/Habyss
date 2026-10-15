import React, { useEffect } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
    Easing, ReduceMotion, cancelAnimation, useAnimatedProps, useAnimatedStyle, useSharedValue,
    withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Colors } from '@/theme/colors';
import { FontFamily, surfaceFor } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { formatClock } from '@/lib/habitMeasurement';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
    /** 0 to 1, of the whole day's target. */
    progress: number;
    /** Seconds still to do today. */
    remaining: number;
    /** The day's target, in words ("4 hours"). */
    targetLabel: string;
    /** What has been banked, in words ("1 h 20 min done"), or null. */
    doneLabel: string | null;
    running: boolean;
    paused: boolean;
    complete: boolean;
    color: string;
    success: string;
}

/**
 * The focus timer, drawn like an instrument rather than a progress bar.
 *
 * Sixty ticks run round the face, one lighting for every sixtieth of the
 * session, so the time already put in is something you can see accumulate. The
 * arc inside them carries a gradient and a lit head, the clock reads hours,
 * minutes and seconds, and while it runs the whole face breathes, slowly, the
 * way a resting pulse does. Paused, it holds still.
 */
export function FocusDial({ progress, remaining, targetLabel, doneLabel, running, paused, complete, color, success }: Props) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { width } = useWindowDimensions();
    const size = Math.min(width - 72, 300);
    const center = size / 2;
    const arcRadius = center - 34;
    const circumference = 2 * Math.PI * arcRadius;
    const tint = complete ? success : color;
    const light = theme === 'light';

    const ring = useSharedValue(progress);
    useEffect(() => {
        ring.set(withTiming(progress, { duration: running ? 950 : 500, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
    }, [progress, running, ring]);
    const arcProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - ring.get()) }));

    // The breath: only while running, and never under Reduce Motion.
    const breath = useSharedValue(0);
    useEffect(() => {
        if (running && !paused) {
            breath.set(withRepeat(withSequence(
                withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
            ), -1, false, undefined, ReduceMotion.System));
        } else {
            cancelAnimation(breath);
            breath.set(withTiming(0, { duration: 400 }));
        }
    }, [running, paused, breath]);
    const halo = useAnimatedStyle(() => ({
        opacity: 0.18 + breath.get() * 0.22,
        transform: [{ scale: 1 + breath.get() * 0.035 }],
    }));


    // Where the head of the arc sits, for its glow.
    const headAngle = Math.min(1, progress) * Math.PI * 2 - Math.PI / 2;
    const head = { x: center + Math.cos(headAngle) * arcRadius, y: center + Math.sin(headAngle) * arcRadius };

    const clock = complete ? formatClock(0) : formatClock(remaining);
    const caption = complete ? 'Complete' : paused ? 'Paused' : running ? 'Remaining' : progress > 0 ? 'Left today' : 'Ready';

    return (
        <View
            style={[styles.wrap, { width: size, height: size }]}
            accessible
            accessibilityRole="timer"
            accessibilityLabel={complete ? `Complete. ${targetLabel}.` : `${caption.toLowerCase()}: ${clock}, of ${targetLabel}.`}
        >
            <Animated.View pointerEvents="none" style={[styles.halo, { width: size, height: size, borderRadius: size / 2, backgroundColor: tint }, halo]} />
            <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
                <Defs>
                    <LinearGradient id="focusArc" x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0" stopColor={tint} stopOpacity={0.55} />
                        <Stop offset="1" stopColor={tint} stopOpacity={1} />
                    </LinearGradient>
                    {/* The card's matte material: lit from the top. */}
                    <LinearGradient id="focusFace" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={surfaceFor(theme).top} stopOpacity={1} />
                        <Stop offset="1" stopColor={surfaceFor(theme).bottom} stopOpacity={1} />
                    </LinearGradient>
                </Defs>
                <Circle cx={center} cy={center} r={center - 2} fill="url(#focusFace)" />
                <Circle cx={center} cy={center} r={arcRadius} stroke={light ? 'rgba(15,23,42,0.07)' : 'rgba(255,255,255,0.06)'} strokeWidth={10} fill="none" />
                <AnimatedCircle
                    cx={center} cy={center} r={arcRadius}
                    stroke="url(#focusArc)" strokeWidth={10} strokeLinecap="round" fill="none"
                    strokeDasharray={`${circumference} ${circumference}`}
                    animatedProps={arcProps}
                    rotation={-90} origin={`${center},${center}`}
                    opacity={progress > 0 ? 1 : 0}
                />
                {progress > 0 && progress < 1 ? (
                    <>
                        <Circle cx={head.x} cy={head.y} r={6.5} fill="#FFFFFF" />
                    </>
                ) : null}
            </Svg>

            <View style={styles.face} pointerEvents="none">
                <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[styles.clock, { color: colors.textPrimary, fontSize: clock.length > 5 ? size * 0.17 : size * 0.2 }]}
                >
                    {clock}
                </Text>
                <Text style={[styles.target, { color: complete ? success : colors.textTertiary }]}>{complete ? 'Done' : `of ${targetLabel}`}</Text>
                {doneLabel ? <Text style={[styles.done, { color: tint }]}>{doneLabel}</Text> : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginVertical: 10 },
    halo: { position: 'absolute' },
    face: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, maxWidth: '100%' },
    clock: { fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'], letterSpacing: -1.5 },
    target: { fontSize: 13, fontFamily: FontFamily.regular, marginTop: 2 },
    done: { fontSize: 12, fontFamily: FontFamily.medium, marginTop: 6 },
});
