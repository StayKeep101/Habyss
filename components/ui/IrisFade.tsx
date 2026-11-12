import React, { useId } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** How soft the iris's edge is, as a share of its radius. */
const FEATHER = 0.8;

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
    const open = Math.hypot(cx, cy) / (1 - FEATHER) + 2;
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
