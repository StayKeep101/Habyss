import React, { useId } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** How soft the iris's edge is, as a share of its radius. */
const FEATHER = 0.8;

/**
 * How covered one point under an iris is, 0 (clear) to 1 (hidden): the same
 * sums the iris draws with, so something laid over the view (a button on a
 * graph) can fade exactly as the view under it does at that spot. A worklet.
 */
export function irisCoverAt(progress: number, from: number, to: number, width: number, height: number, follow: boolean, x: number, y: number): number {
    'worklet';
    const cx = width / 2;
    const open = (Math.sqrt(cx * cx + (height / 2) * (height / 2)) * 1.35) / (1 - FEATHER * 0.4);
    const t = Math.min(1, Math.max(0, (progress - from) / Math.max(1, to - from)));
    const eased = t * t * (3 - 2 * t);
    const r = open * (1 - eased);
    if (r <= 0) return 1;
    const shown = follow ? Math.max(0, height - Math.max(0, progress)) : height;
    const u = Math.sqrt((x - cx) * (x - cx) + (y - shown / 2) * (y - shown / 2)) / r;
    // The gradient's stops (below), as a line through them.
    const stops = [[0, 0], [1 - FEATHER, 0], [1 - FEATHER * 0.6, 0.15], [1 - FEATHER * 0.3, 0.5], [1, 1]];
    if (u >= 1) return 1;
    for (let index = 1; index < stops.length; index++) {
        const [u1, c1] = stops[index];
        if (u <= u1) {
            const [u0, c0] = stops[index - 1];
            return c0 + ((u - u0) / Math.max(1e-6, u1 - u0)) * (c1 - c0);
        }
    }
    return 1;
}

/**
 * Covers what is under it from the outside in, like an iris closing: a
 * soft-edged circle of `color` shrinks towards the middle as `progress` goes
 * from `from` to `to`, until nothing shows. Laid over a view (absolute), never
 * catching touches.
 */
export function IrisFade({ progress, from, to, width, height, color, follow = false }: {
    /** Keep the circle centred on what still shows above a page rising over it (by `progress` points). */
    follow?: boolean;
    progress: SharedValue<number>;
    /** Where it starts closing, and where it is shut. */
    from: number;
    to: number;
    width: number;
    height: number;
    color: string;
}) {
    const id = useId().replace(/[^a-zA-Z0-9]/g, '');
    const cx = width / 2;
    const cy = height / 2;
    // Open: the clear middle (inside the soft edge) reaches past every corner.
    // Open: even the soft edge starts well past every corner, so at rest nothing is dimmed (text in the corners included).
    const open = (Math.hypot(cx, cy) * 1.35) / (1 - FEATHER * 0.4);
    // The solid part beyond the soft edge: a ring wide enough to cover the rest.
    const ring = Math.hypot(width, height) * 2;

    // Plain numbers in the worklets. Eased (smoothstep): it starts closing gently, moves, then settles shut.
    const softEdge = useAnimatedProps(() => {
        const t = interpolate(progress.get(), [from, to], [0, 1], Extrapolation.CLAMP);
        const eased = t * t * (3 - 2 * t);
        const shown = follow ? Math.max(0, height - Math.max(0, progress.get())) : height;
        return { r: open * (1 - eased), cy: shown / 2 };
    });
    const solid = useAnimatedProps(() => {
        const t = interpolate(progress.get(), [from, to], [0, 1], Extrapolation.CLAMP);
        const eased = t * t * (3 - 2 * t);
        const shown = follow ? Math.max(0, height - Math.max(0, progress.get())) : height;
        return { r: open * (1 - eased) + ring / 2, cy: shown / 2 };
    });
    return (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
                <RadialGradient id={`iris${id}`} cx="50%" cy="50%" r="50%">
                    <Stop offset={0} stopColor={color} stopOpacity={0} />
                    <Stop offset={1 - FEATHER} stopColor={color} stopOpacity={0} />
                    {/* A long, eased falloff rather than a straight ramp: no visible ring. */}
                    <Stop offset={1 - FEATHER * 0.6} stopColor={color} stopOpacity={0.15} />
                    <Stop offset={1 - FEATHER * 0.3} stopColor={color} stopOpacity={0.5} />
                    <Stop offset={1} stopColor={color} stopOpacity={1} />
                </RadialGradient>
            </Defs>
            <AnimatedCircle cx={cx} fill={`url(#iris${id})`} animatedProps={softEdge} />
            <AnimatedCircle cx={cx} fill="none" stroke={color} strokeWidth={ring} animatedProps={solid} />
        </Svg>
    );
}
