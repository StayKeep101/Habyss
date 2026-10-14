import React, { useEffect, useRef, useState } from 'react';
import { Text, type StyleProp, type TextProps, type ViewStyle } from 'react-native';
import Animated, {
    Easing, FadeIn, ReduceMotion, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue,
    withDelay, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { Circle, Path, Rect } from 'react-native-svg';

/**
 * How every number, bar, ring and chart in the app moves.
 *
 * Two moments, one feel: when a page opens its charts grow in from nothing
 * (`intro`), and when something changes — a habit ticked, a task done — they
 * glide from the old value to the new one (`duration`). Both ease out, so the
 * movement settles rather than stops. With Reduce Motion on, everything simply
 * shows its value.
 */
export const MOTION = {
    /** A value changing while you look at it. */
    duration: 420,
    /** A chart arriving when its page opens. */
    intro: 700,
    /** The gap between neighbouring bars or cells growing in. */
    stagger: 35,
    easing: Easing.out(Easing.cubic),
} as const;

export const AnimatedRect = Animated.createAnimatedComponent(Rect);
export const AnimatedCircle = Animated.createAnimatedComponent(Circle);
export const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * A value that starts at zero, grows to `target` when it first appears, and
 * glides to every new target after that. Drive any style or SVG prop with it.
 */
export function useProgress(target: number, delay = 0): SharedValue<number> {
    const value = useSharedValue(0);
    const first = useRef(true);
    useEffect(() => {
        const duration = first.current ? MOTION.intro : MOTION.duration;
        const wait = first.current ? delay : 0;
        first.current = false;
        value.set(withDelay(wait, withTiming(target, { duration, easing: MOTION.easing, reduceMotion: ReduceMotion.System })));
    }, [target, delay, value]);
    return value;
}

const NUMBER = /-?\d[\d,]*(\.\d+)?/;

/**
 * A number as text that counts up when it appears and rolls to its new value
 * when it changes: "62%", "1,240", "4.5 h". Whatever surrounds the number is
 * kept as written. Use it only on text that is a figure.
 */
export function useCountUp(value: string | number): string {
    const text = String(value);
    const match = text.match(NUMBER);
    const target = match ? Number(match[0].replace(/,/g, '')) : NaN;
    const reduced = useReducedMotion();
    const [shown, setShown] = useState(reduced ? target : 0);
    const current = useRef(reduced ? target : 0);
    const first = useRef(true);

    useEffect(() => {
        if (!Number.isFinite(target)) return;
        const duration = first.current ? MOTION.intro : MOTION.duration;
        first.current = false;
        const start = current.current;
        if (reduced || start === target) { current.current = target; setShown(target); return; }
        const began = Date.now();
        let frame = 0;
        const tick = () => {
            const progress = Math.min(1, (Date.now() - began) / duration);
            const next = start + (target - start) * (1 - Math.pow(1 - progress, 3));
            current.current = next;
            setShown(next);
            if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [target, reduced]);

    if (!match || !Number.isFinite(target)) return text;
    const decimals = match[1] ? match[1].length - 1 : 0;
    const figure = match[0].includes(',')
        ? shown.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : shown.toFixed(decimals);
    return text.replace(match[0], figure);
}

/** `useCountUp` as a Text, for a figure drawn inside a list or with its own style. */
export function CountUp({ value, ...props }: { value: string | number } & TextProps) {
    const counted = useCountUp(value);
    return <Text accessibilityLabel={String(value)} {...props}>{counted}</Text>;
}

/**
 * A bar's fill: grows across its track when it appears and slides to each new
 * value. `progress` is 0 to 1; give it the fill's own look in `style`.
 */
export function AnimatedFill({ progress, style, delay = 0 }: { progress: number; style?: StyleProp<ViewStyle>; delay?: number }) {
    const shown = useProgress(Math.max(0, Math.min(1, progress)), delay);
    const width = useAnimatedStyle(() => ({ width: `${shown.get() * 100}%` }));
    return <Animated.View style={[style, width]} />;
}

/**
 * Draws its contents in from left to right, the way a line chart arrives.
 * The contents need a fixed width (an Svg with `width`), so they are uncovered
 * rather than squeezed.
 */
export function Reveal({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
    const shown = useProgress(1);
    const width = useAnimatedStyle(() => ({ width: `${shown.get() * 100}%` }));
    return <Animated.View style={[{ overflow: 'hidden' }, style, width]}>{children}</Animated.View>;
}

/** One of many small pieces (a heatmap cell, a dot) fading in after the one before it. */
export function PopIn({ index = 0, children, style }: { index?: number; children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
    return (
        <Animated.View
            entering={FadeIn.delay(Math.min(index, 40) * (MOTION.stagger / 2)).duration(MOTION.duration).reduceMotion(ReduceMotion.System)}
            style={style}
        >
            {children}
        </Animated.View>
    );
}

/** An SVG bar standing on `floor`, growing up to `height` and to each new height. */
export function GrowBar({ x, width, floor, height, rx, fill, opacity, delay = 0 }: {
    x: number; width: number; floor: number; height: number; rx?: number; fill: string; opacity?: number; delay?: number;
}) {
    const shown = useProgress(height, delay);
    const props = useAnimatedProps(() => ({ y: floor - shown.get(), height: shown.get() }));
    return <AnimatedRect x={x} width={width} rx={rx} fill={fill} opacity={opacity} animatedProps={props} />;
}
