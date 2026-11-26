import React, { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { interpolate, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { on, type AppEvents } from '@/lib/appEvents';
import { CEREMONY, EASE, timingFor } from '@/theme/motion';

type Flip = AppEvents['glass_flipped'];

/** Each ring is drawn at this size and scaled out to the far corner of the screen. */
const RING = 100;
const RINGS = 3;
const GAP = 220;
// Built once, outside any worklet (a helper call inside one crashes natively).
const WAVE = timingFor(CEREMONY.reveal, EASE.enter);
const FLASH = timingFor(CEREMONY.gather, EASE.exit);

/**
 * The morning flip, felt everywhere: when the glass lands
 * (components/Home/DayHourglass.tsx), rings of its light roll out from it
 * across the whole screen, over every card and the tab bar, one after
 * another, and the page itself flashes faintly. Drawn from the app's root,
 * above everything, never in the way of a touch. Not played with Reduce Motion.
 */
export function GlassRipple() {
    const reduced = useReducedMotion();
    const { width, height } = useWindowDimensions();
    const [flip, setFlip] = useState<Flip | null>(null);
    const flash = useSharedValue(0);

    useEffect(() => {
        const sub = on('glass_flipped', event => { if (!reduced) setFlip(event); });
        return () => sub.remove();
    }, [reduced]);

    useEffect(() => {
        if (!flip) return;
        const done = () => setFlip(null);
        flash.set(0);
        flash.set(withTiming(1, FLASH, finished => { if (finished) runOnJS(done)(); }));
    }, [flip, flash]);

    const flashStyle = useAnimatedStyle(() => ({ opacity: interpolate(flash.get(), [0, 0.08, 1], [0, 0.16, 0]) }));
    if (!flip) return null;

    // Far enough to reach the farthest corner from where the glass sits.
    const reach = Math.hypot(Math.max(flip.x, width - flip.x), Math.max(flip.y, height - flip.y));
    const scale = (reach * 2) / RING;
    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: flip.color }, flashStyle]} />
            {Array.from({ length: RINGS }, (_, index) => (
                <Ring key={index} index={index} x={flip.x} y={flip.y} scale={scale} color={flip.color} />
            ))}
        </View>
    );
}

function Ring({ index, x, y, scale, color }: { index: number; x: number; y: number; scale: number; color: string }) {
    const wave = useSharedValue(0);
    useEffect(() => { wave.set(withDelay(index * GAP, withTiming(1, WAVE))); }, [wave, index]);
    // Each ring a little fainter than the one before it.
    const strength = 0.85 - index * 0.2;
    const style = useAnimatedStyle(() => ({
        // Strong for most of the way, so it is still felt crossing the tab bar; gone only at the edge.
        opacity: interpolate(wave.get(), [0, 0.08, 0.75, 1], [0, strength, strength * 0.7, 0]),
        transform: [{ scale: 0.2 + wave.get() * scale }],
    }));
    return <Animated.View style={[styles.ring, { left: x - RING / 2, top: y - RING / 2, borderColor: color }, style]} />;
}

const styles = StyleSheet.create({
    ring: { position: 'absolute', width: RING, height: RING, borderRadius: RING / 2, borderWidth: 1 },
});
