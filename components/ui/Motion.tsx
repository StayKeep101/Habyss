import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Text, type StyleProp, type TextProps, type ViewStyle } from 'react-native';
import { isIntroDone, subscribeIntro } from '@/lib/introGate';
import Animated, {
    Easing, FadeIn, FadeInDown, FadeOut, LinearTransition, ReduceMotion, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue,
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
 *
 * `replay` is for switches: give it whatever was switched (the month, "1W" or
 * "All", the tab) and the intro plays again from zero each time it changes, so
 * new data arrives the way the page did.
 */
/** Whether the launch animation has lifted (lib/introGate.ts). */
function useIntroDone(): boolean {
    return useSyncExternalStore(subscribeIntro, isIntroDone, isIntroDone);
}

/**
 * `introDuration` / `introEasing`: how the first growth runs, when a sequence
 * needs it different from the usual (a steady pour across several pieces).
 */
export function useProgress(target: number, delay = 0, replay?: unknown, introDuration: number = MOTION.intro,
    introEasing: typeof MOTION.easing = MOTION.easing): SharedValue<number> {
    const value = useSharedValue(0);
    const first = useRef(true);
    const lastReplay = useRef(replay);
    const ready = useIntroDone();
    useEffect(() => {
        // Waits at zero under the launch animation, then plays as the app appears.
        if (!ready) return;
        const again = lastReplay.current !== replay;
        lastReplay.current = replay;
        const intro = first.current || again;
        first.current = false;
        if (again) value.set(0);
        const duration = intro ? introDuration : MOTION.duration;
        value.set(withDelay(intro ? delay : 0, withTiming(target, { duration, easing: intro ? introEasing : MOTION.easing, reduceMotion: ReduceMotion.System })));
    }, [target, delay, replay, value, ready, introDuration, introEasing]);
    return value;
}

const NUMBERS = /-?\d[\d,]*(\.\d+)?/g;

/**
 * A figure as text that counts up when it appears and rolls to its new value
 * when it changes: "62%", "1,240", "3/5 done", "4.5 h". Every number in it
 * moves; whatever surrounds them is kept as written. Use it only on text that
 * is data. `replay` counts up from zero again when it changes (see useProgress).
 */
export function useCountUp(value: string | number, replay?: unknown): string {
    const text = String(value);
    const parts = text.match(NUMBERS) ?? [];
    const targets = parts.map(part => Number(part.replace(/,/g, '')));
    const key = targets.join('|');
    const reduced = useReducedMotion();
    const [shown, setShown] = useState<number[]>(() => (reduced ? targets : targets.map(() => 0)));
    const current = useRef<number[]>(reduced ? targets : targets.map(() => 0));
    const first = useRef(true);
    const lastReplay = useRef(replay);
    const ready = useIntroDone();

    useEffect(() => {
        if (targets.length === 0 || !ready) return;
        const again = lastReplay.current !== replay;
        lastReplay.current = replay;
        const duration = first.current || again ? MOTION.intro : MOTION.duration;
        first.current = false;
        const start = targets.map((_, index) => (again ? 0 : current.current[index] ?? 0));
        if (reduced || start.every((from, index) => from === targets[index])) {
            current.current = targets; setShown(targets); return;
        }
        const began = Date.now();
        let frame = 0;
        const tick = () => {
            const progress = Math.min(1, (Date.now() - began) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            const next = targets.map((to, index) => start[index] + (to - start[index]) * eased);
            current.current = next;
            setShown(next);
            if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
        // `key` stands for `targets`, which is a new array every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, replay, reduced, ready]);

    if (parts.length === 0) return text;
    let index = 0;
    return text.replace(NUMBERS, part => {
        const number = shown[index] ?? targets[index];
        index++;
        const decimals = part.includes('.') ? part.split('.')[1].length : 0;
        return part.includes(',')
            ? number.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
            : number.toFixed(decimals);
    });
}

/** `useCountUp` as a Text, for a figure drawn inside a list or with its own style. */
export function CountUp({ value, replay, ...props }: { value: string | number; replay?: unknown } & TextProps) {
    const counted = useCountUp(value, replay);
    return <Text accessibilityLabel={String(value)} {...props}>{counted}</Text>;
}

/**
 * A bar's fill: grows across its track when it appears and slides to each new
 * value. `progress` is 0 to 1; give it the fill's own look in `style`.
 */
export function AnimatedFill({ progress, style, delay = 0, replay }: { progress: number; style?: StyleProp<ViewStyle>; delay?: number; replay?: unknown }) {
    const shown = useProgress(Math.max(0, Math.min(1, progress)), delay, replay);
    const width = useAnimatedStyle(() => ({ width: `${shown.get() * 100}%` }));
    return <Animated.View style={[style, width]} />;
}

/**
 * Draws its contents in from left to right, the way a line chart arrives.
 * The contents need a fixed width (an Svg with `width`), so they are uncovered
 * rather than squeezed.
 */
export function Reveal({ children, style, replay }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; replay?: unknown }) {
    const shown = useProgress(1, 0, replay);
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
export function GrowBar({ x, width, floor, height, rx, fill, opacity, delay = 0, replay }: {
    x: number; width: number; floor: number; height: number; rx?: number; fill: string; opacity?: number; delay?: number; replay?: unknown;
}) {
    const shown = useProgress(height, delay, replay);
    const props = useAnimatedProps(() => ({ y: floor - shown.get(), height: shown.get() }));
    return <AnimatedRect x={x} width={width} rx={rx} fill={fill} opacity={opacity} animatedProps={props} />;
}

/** How rows move when the list around them changes: timed, never sprung, so nothing bounces. */
export const LIST_LAYOUT = LinearTransition.duration(MOTION.duration).easing(MOTION.easing).reduceMotion(ReduceMotion.System);

/**
 * A row in a list of habits, tasks or goals. It fades in when it is added,
 * fades out when it is removed or finished away, and when its neighbours come
 * and go it slides to its new place instead of jumping there.
 */
export function ListItem({ children, style, index = 0, rise = false }: {
    children: React.ReactNode; style?: StyleProp<ViewStyle>; index?: number;
    /**
     * Rows arrive one after another, each rising a little into place, at an
     * even beat — for a list read top to bottom in order, like the timeline.
     */
    rise?: boolean;
}) {
    const delay = Math.min(index, 14) * (rise ? MOTION.stagger * 2 : MOTION.stagger);
    return (
        <Animated.View
            entering={rise
                ? FadeInDown.delay(delay).duration(MOTION.duration).easing(MOTION.easing).reduceMotion(ReduceMotion.System)
                : FadeIn.delay(delay).duration(MOTION.duration).reduceMotion(ReduceMotion.System)}
            exiting={FadeOut.duration(MOTION.duration / 2).reduceMotion(ReduceMotion.System)}
            layout={LIST_LAYOUT}
            style={style}
        >
            {children}
        </Animated.View>
    );
}
