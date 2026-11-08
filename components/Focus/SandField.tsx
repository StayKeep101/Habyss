import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { EASE } from '@/theme/motion';

/** Strips the sheet comes apart in, top to bottom. */
const BANDS = 16;
/** Grains in each strip fall at one of these few speeds, so neighbours part. */
const LAYERS = 4;
/** Grains per layer of a strip: about 1,500 on the whole screen. */
const GRAINS = 24;
/** How long one strip's sheet takes to crumble, and its grains to fall, as shares of the whole. */
const CRUMBLE = 0.22;
const FALL = 0.55;
/** When the last strip starts: the top goes first, the bottom last. */
const SPREAD = 1 - FALL - 0.1;

/** A fixed scatter, the same every time (no Math.random in a render). */
function seeded(seed: number) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * A screen of sand that comes apart like sand (FocusPortal). `fall` runs
 * 0 → 1: at 0 a whole sheet; then, strip by strip from the top, the sheet
 * crumbles into grains that drop and drift apart at different speeds and fade.
 * Run backwards (1 → 0) the grains rise and gather back into the sheet. Below
 * 0 it is not shown.
 *
 * About eighty moving layers, each a still drawing of its grains: the grains
 * are drawn once, and only whole layers move, on the UI thread.
 */
export function SandField({ fall, width, height, color }: {
    fall: SharedValue<number>; width: number; height: number; color: string;
}) {
    const band = Math.ceil(height / BANDS);
    const strips = useMemo(() => Array.from({ length: BANDS }, (_, index) => {
        const random = seeded(index + 1);
        return {
            index,
            layers: Array.from({ length: LAYERS }, (_, layer) => ({
                layer,
                // Each layer leaves a little early or late, falls its own distance, drifts its own way.
                lag: random() * 0.06,
                drop: band * (1.5 + layer * 0.9 + random()),
                drift: (random() - 0.5) * band * 0.8,
                grains: Array.from({ length: GRAINS }, () => ({
                    x: random() * width, y: random() * band, r: 0.7 + random() * random() * 2.2,
                })),
            })),
        };
    }), [band, width]);
    return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {strips.map(strip => (
                <React.Fragment key={strip.index}>
                    <Sheet fall={fall} top={strip.index * band} height={band + 1} start={(strip.index / BANDS) * SPREAD} color={color} />
                    {strip.layers.map(layer => (
                        <Grains key={layer.layer} fall={fall} top={strip.index * band} width={width} height={band}
                            start={(strip.index / BANDS) * SPREAD + layer.lag} drop={layer.drop} drift={layer.drift}
                            grains={layer.grains} color={color} />
                    ))}
                </React.Fragment>
            ))}
        </View>
    );
}

/** One strip of the whole sheet: it thins away as its grains come loose. */
function Sheet({ fall, top, height, start, color }: { fall: SharedValue<number>; top: number; height: number; start: number; color: string }) {
    const style = useAnimatedStyle(() => {
        const f = fall.get();
        return { opacity: f < 0 ? 0 : 1 - EASE.move(interpolate(f, [start, start + CRUMBLE], [0, 1], 'clamp')) };
    });
    return <Animated.View style={[styles.strip, { top, height, backgroundColor: color }, style]} />;
}

/** One layer of grains in a strip: still on the sheet, then falling under gravity, drifting, fading. */
function Grains({ fall, top, width, height, start, drop, drift, grains, color }: {
    fall: SharedValue<number>; top: number; width: number; height: number; start: number; drop: number; drift: number;
    grains: { x: number; y: number; r: number }[]; color: string;
}) {
    const style = useAnimatedStyle(() => {
        const f = fall.get();
        if (f < 0) return { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }] };
        const q = interpolate(f, [start, start + FALL], [0, 1], 'clamp');
        // Gravity: slow to leave, quicker as it goes.
        return {
            opacity: 1 - interpolate(q, [0.45, 1], [0, 1], 'clamp'),
            transform: [{ translateX: q * drift }, { translateY: q * q * drop }],
        };
    });
    return (
        <Animated.View style={[styles.strip, { top, height }, style]}>
            <Svg width={width} height={height}>
                {grains.map((grain, index) => <Circle key={index} cx={grain.x} cy={grain.y} r={grain.r} fill={color} />)}
            </Svg>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    strip: { position: 'absolute', left: 0, right: 0, overflow: 'visible' },
});
