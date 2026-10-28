import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
    cancelAnimation, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { useTokens } from '@/hooks/useTokens';
import { Radius } from '@/theme/designSystem';
import { EASE } from '@/theme/motion';

const PARTICLES = 28;

/**
 * The world of the Ascent: an enormous dark shaft, a far opening of light
 * above, fog, and motes drifting at three depths. Drawn over the app's own
 * background (VoidShell) in the theme's colours and the user's accent, so it
 * is the same night as the rest of Habyss, only deeper. Driven by two values the
 * story moves: `depth` (0 at the top, 1 deep down: the camera sinking) and
 * `lift` (0 looking down, 1 looking up at the opening, past 1 rising through
 * it). Only transform and opacity move; with Reduce Motion it holds still and
 * only cross-fades.
 */
export function AbyssWorld({ depth, lift, children }: { depth: SharedValue<number>; lift: SharedValue<number>; children?: React.ReactNode }) {
    const { width, height } = useWindowDimensions();
    const reduced = useReducedMotion();
    const t = useTokens();
    const drift = useSharedValue(0);
    useEffect(() => {
        if (reduced) return;
        drift.value = withRepeat(withTiming(1, { duration: 24000, easing: EASE.move }), -1, true);
        return () => cancelAnimation(drift);
    }, [drift, reduced]);

    // Where each mote sits: fixed for the life of the screen.
    const motes = useMemo(() => Array.from({ length: PARTICLES }, (_, index) => ({
        x: ((index * 73) % 100) / 100 * width,
        y: ((index * 41) % 100) / 100 * height,
        size: 1.5 + (index % 3),
        layer: index % 3,
        alpha: 0.25 + ((index * 17) % 40) / 100,
    })), [width, height]);

    // The opening above: a soft disc that brightens as you look up, then floods the screen as you rise.
    const opening = useAnimatedStyle(() => ({
        opacity: interpolate(lift.value, [0, 1, 1.6], [0.12, 0.85, 1], 'clamp'),
        transform: [
            { translateY: interpolate(lift.value, [0, 1, 1.6], [-height * 0.32, -height * 0.18, 0], 'clamp') },
            { scale: interpolate(lift.value, [0, 1, 1.6], [0.6, 1, 9], 'clamp') },
        ],
    }));
    // The deep: darker the further down, lifting toward the light as you rise.
    const deepLayer = useAnimatedStyle(() => ({ opacity: interpolate(depth.value - lift.value * 0.6, [-0.6, 1], [0.15, 1], 'clamp') }));
    const fogA = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(drift.value, [0, 1], [-40, 40]) }, { translateY: interpolate(depth.value, [0, 1], [0, -60]) }] }));
    const fogB = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(drift.value, [0, 1], [30, -30]) }, { translateY: interpolate(depth.value, [0, 1], [0, -120]) }] }));

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <Animated.View pointerEvents="none" style={[styles.openingWrap, opening]}>
                <View style={[styles.halo, { backgroundColor: t.tint('soft') }]} />
                <View style={[styles.opening, { backgroundColor: t.color.textPrimary }]} />
            </Animated.View>
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.color.background }, deepLayer]} />
            <Animated.View pointerEvents="none" style={[styles.fog, { backgroundColor: t.tint('subtle'), top: height * 0.55, left: -width * 0.3, width: width * 1.2, height: height * 0.45 }, fogA]} />
            <Animated.View pointerEvents="none" style={[styles.fog, { backgroundColor: t.tint('subtle'), top: height * 0.2, left: width * 0.1, width: width * 1.1, height: height * 0.35 }, fogB]} />
            {motes.map((mote, index) => <Mote key={index} {...mote} color={t.color.textPrimary} depth={depth} lift={lift} drift={drift} height={height} />)}
            {children}
        </View>
    );
}

/** One mote: nearer layers move further as the camera sinks or rises (parallax). */
function Mote({ x, y, size, layer, alpha, depth, lift, drift, height, color }: {
    x: number; y: number; size: number; layer: number; alpha: number; height: number; color: string;
    depth: SharedValue<number>; lift: SharedValue<number>; drift: SharedValue<number>;
}) {
    const reach = (layer + 1) * 90;
    const style = useAnimatedStyle(() => {
        // Sinking, the world rises past; rising, it streams down past you.
        const shift = depth.value * reach - Math.max(0, lift.value - 1) * height * (layer + 1) * 0.8;
        const wrapped = ((y - shift) % height + height) % height;
        return {
            opacity: alpha * interpolate(lift.value, [1, 1.6], [1, 0.3], 'clamp'),
            transform: [
                { translateX: x + interpolate(drift.value, [0, 1], [-6, 6]) * (layer + 1) },
                { translateY: wrapped },
                { scaleY: 1 + Math.max(0, lift.value - 1) * 6 * (layer + 1) },
            ],
        };
    });
    return <Animated.View pointerEvents="none" style={[styles.mote, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
    openingWrap: { position: 'absolute', top: '50%', left: '50%', width: 0, height: 0, alignItems: 'center', justifyContent: 'center' },
    halo: { position: 'absolute', width: 260, height: 260, borderRadius: 130, opacity: 0.35 },
    opening: { position: 'absolute', width: 90, height: 90, borderRadius: 45, opacity: 0.9 },
    // The accent's faintest tint, faded further: fog, not a shape.
    fog: { position: 'absolute', borderRadius: Radius.pill, opacity: 0.4 },
    mote: { position: 'absolute', top: 0, left: 0 },
});
