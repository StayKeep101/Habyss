import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Line, Path, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
    Easing, cancelAnimation, interpolate, runOnJS, useAnimatedStyle, useDerivedValue, useReducedMotion,
    useSharedValue, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { useHaptics } from '@/hooks/useHaptics';
import { Colors } from '@/theme/colors';
import { DURATION, FOCUS_ENTRY, FOCUS_EXIT, OVERLAY } from '@/theme/motion';
import { focusExitFull, takeFocusRitual } from '@/lib/focusRitual';
import { SandField } from './SandField';
import { useUISound } from '@/hooks/useUISound';

/**
 * Focus is always drawn dark (styles/screens/focus.styles.ts `screen`), so its
 * colours are the dark theme's whatever the app's theme: the void, a pale glass
 * line, and the sand in silver. No accent: light and shadow only.
 */
const VOID = '#000000';
const GLASS = '#FFFFFF';
const SAND = Colors.abyss.silver;

// Each beat as a share of the whole, so one value (`arrive`, 0 → 1) runs it all.
const TOTAL = Object.values(FOCUS_ENTRY).reduce((sum, ms) => sum + ms, 0);
const mark = (ms: number) => ms / TOTAL;
const APPEAR_END = mark(FOCUS_ENTRY.appear);
const FLIP_START = mark(FOCUS_ENTRY.appear + FOCUS_ENTRY.hold);
const FLIP_END = FLIP_START + mark(FOCUS_ENTRY.flip);
const ZOOM_START = FLIP_END + mark(FOCUS_ENTRY.settle);
const ZOOM_END = ZOOM_START + mark(FOCUS_ENTRY.zoom);
/** Where the sand starts to come apart: the page behind settles from here. */
export const DISSOLVE_FROM = ZOOM_END;

/** Deep enough into the sand that it covers every corner. */
const ZOOM_DEPTH = 60;
/** The slow push in before the plunge: the camera never stops. */
const DOLLY = 1.12;
/** One slow cinematic curve for every beat: eased in and out, a long tail. */
const CINE = Easing.bezierFn(0.65, 0, 0.35, 1);
/** The plunge: hesitant, then all at once. */
const PLUNGE = Easing.bezierFn(0.7, 0, 0.84, 0);

/**
 * Stepping into Focus, and out of it (docs/motion-system.md §4.6).
 *
 * In: pitch dark. A minimalist hourglass comes out of it in a faint aura,
 * hangs there breathing as the camera drifts closer, turns over, and the sand
 * begins to run. You are drawn into the sand until it is all there is; then it
 * crumbles, grain by grain from the top, and falls away to the Focus page.
 *
 * Out: the same sand rises and gathers back into a sheet over the page, and
 * the page fades away with it.
 *
 * Slow on purpose, once a day: the first session of the day gets all of it,
 * every one after goes straight to the sand falling away (lib/focusRitual.ts).
 * A tap skips it; with Reduce Motion the dark simply fades in, and leaving is
 * immediate.
 */
export function FocusPortal({ mode, arrive, onDone }: {
    mode: 'enter' | 'leave';
    /** 0 → 1 across the entrance: the page behind settles with the dissolve. */
    arrive: SharedValue<number>;
    onDone: () => void;
}) {
    const { width, height } = useWindowDimensions();
    const reduced = useReducedMotion();
    const { lightFeedback, mediumFeedback } = useHaptics();
    const whoosh = useUISound('transition');
    const finished = useRef(false);
    const beats = useRef<ReturnType<typeof setTimeout>[]>([]);
    // Leaving: the sand's own clock, run from fallen (1) back to whole (0).
    const gathered = useSharedValue(1);
    // The whole ritual once a day; after that, straight to the sand falling away (lib/focusRitual.ts).
    const [full] = useState(() => mode === 'enter' ? takeFocusRitual() : focusExitFull());

    // Numbers worked out here: worklets only read numbers.
    const glassH = Math.min(width, height) * 0.34;
    const glassW = glassH * 0.62;
    const cx = width / 2;
    const cy = height / 2;
    // The sand, once the glass has turned over, sits at the top: the point you are drawn into.
    const sandY = cy - glassH * 0.3;

    const finish = () => {
        if (finished.current) return;
        finished.current = true;
        beats.current.forEach(clearTimeout);
        onDone();
    };

    useEffect(() => {
        // A whole new place, heard: into Focus and back out of it.
        whoosh();
        if (mode === 'leave') {
            if (reduced) { finish(); return; }
            lightFeedback();
            gathered.set(withTiming(0, { duration: full ? FOCUS_EXIT.gather : DURATION.emphasis, easing: CINE }, done => { if (done) runOnJS(finish)(); }));
            return () => cancelAnimation(gathered);
        }
        if (reduced) {
            arrive.set(withTiming(1, OVERLAY.in, done => { if (done) runOnJS(finish)(); }));
            return;
        }
        if (!full) {
            // Already in the sand: it falls away to the page, one light tap.
            lightFeedback();
            arrive.set(DISSOLVE_FROM);
            arrive.set(withTiming(1, { duration: DURATION.reward, easing: Easing.linear }, done => { if (done) runOnJS(finish)(); }));
            return () => cancelAnimation(arrive);
        }
        // Felt as well as seen: the glass coming out of the dark, landing after its turn, the sand letting go.
        beats.current = [
            setTimeout(lightFeedback, 0),
            setTimeout(mediumFeedback, FLIP_END * TOTAL),
            setTimeout(lightFeedback, ZOOM_END * TOTAL),
        ];
        arrive.set(withTiming(1, { duration: TOTAL, easing: Easing.linear }, done => { if (done) runOnJS(finish)(); }));
        return () => { cancelAnimation(arrive); beats.current.forEach(clearTimeout); };
    }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

    const skip = () => {
        if (mode === 'leave') { cancelAnimation(gathered); finish(); return; }
        cancelAnimation(arrive);
        arrive.set(1);
        finish();
    };

    // The sand's state: hidden until it covers the screen, then falling away (in), or gathering (out).
    const fall = useDerivedValue(() => mode === 'leave' ? gathered.get()
        : arrive.get() < DISSOLVE_FROM ? -1 : CINE(interpolate(arrive.get(), [DISSOLVE_FROM, 1], [0, 1], 'clamp')));

    // The dark: whole until the sand covers the screen, then gone under it.
    const dark = useAnimatedStyle(() => ({
        opacity: reduced ? 1 - arrive.get() : arrive.get() < ZOOM_END ? 1 : 0,
    }));
    // The camera: a slow drift closer the whole time, then drawn into the sand.
    const camera = useAnimatedStyle(() => {
        const a = arrive.get();
        const drift = 1 + (DOLLY - 1) * CINE(interpolate(a, [0, ZOOM_START], [0, 1], 'clamp'));
        const plunge = PLUNGE(interpolate(a, [ZOOM_START, ZOOM_END], [0, 1], 'clamp'));
        return {
            opacity: a >= ZOOM_END ? 0 : CINE(interpolate(a, [0, APPEAR_END], [0, 1], 'clamp')),
            transform: [{ scale: drift * (1 + plunge * (ZOOM_DEPTH - 1)) }],
        };
    });
    // The glass rises a breath into place as it appears, then turns over like a hand doing it.
    const glass = useAnimatedStyle(() => {
        const a = arrive.get();
        return {
            transform: [
                { translateY: (1 - CINE(interpolate(a, [0, APPEAR_END], [0, 1], 'clamp'))) * glassH * 0.06 },
                { rotate: `${CINE(interpolate(a, [FLIP_START, FLIP_END], [0, 1], 'clamp')) * 180}deg` },
            ],
        };
    });
    // The aura: it gathers slowly as the glass appears, swells through the turn, and breathes.
    const aura = useAnimatedStyle(() => {
        const a = arrive.get();
        const breath = 0.85 + 0.15 * Math.sin(a * TOTAL / 600);
        return { opacity: interpolate(a, [0, APPEAR_END, FLIP_END], [0, 0.6, 1], 'clamp') * breath };
    });
    // The thread of sand through the neck, once it has turned.
    const stream = useAnimatedStyle(() => ({
        opacity: CINE(interpolate(arrive.get(), [FLIP_END, ZOOM_START], [0, 1], 'clamp')),
    }));

    if (mode === 'enter' && reduced) {
        return (
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: VOID }, dark]}
                accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        );
    }

    return (
        <Pressable style={StyleSheet.absoluteFill} onPress={skip} accessible={false}
            accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {mode === 'enter' ? (
                <>
                    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: VOID }, dark]} />
                    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transformOrigin: [cx, sandY, 0] }, camera]}>
                        <Animated.View style={[StyleSheet.absoluteFill, aura]}>
                            <Svg width={width} height={height}>
                                <Defs>
                                    <RadialGradient id="aura" cx={cx} cy={cy} r={glassH * 1.3} gradientUnits="userSpaceOnUse">
                                        <Stop offset="0" stopColor={GLASS} stopOpacity={0.14} />
                                        <Stop offset="0.45" stopColor={GLASS} stopOpacity={0.05} />
                                        <Stop offset="1" stopColor={GLASS} stopOpacity={0} />
                                    </RadialGradient>
                                </Defs>
                                <Circle cx={cx} cy={cy} r={glassH * 1.3} fill="url(#aura)" />
                            </Svg>
                        </Animated.View>
                        <Animated.View style={[StyleSheet.absoluteFill, stream]}>
                            <Svg width={width} height={height}>
                                <Line x1={cx} y1={cy} x2={cx} y2={cy + glassH * 0.44} stroke={SAND} strokeWidth={1} strokeLinecap="round" />
                            </Svg>
                        </Animated.View>
                        <Animated.View style={[styles.glass, { left: cx - glassW / 2, top: cy - glassH / 2, width: glassW, height: glassH }, glass]}>
                            <Hourglass width={glassW} height={glassH} />
                        </Animated.View>
                    </Animated.View>
                </>
            ) : null}
            <SandField fall={fall} width={width} height={height} color={SAND} />
        </Pressable>
    );
}

/**
 * The hourglass, still: two caps, a glass pinched at the neck, and the sand
 * at rest in the lower bulb (it is about to be turned over).
 */
function Hourglass({ width: w, height: h }: { width: number; height: number }) {
    const cap = h * 0.06;
    const glass = `M${w * 0.12} ${cap}L${w * 0.88} ${cap}Q${w * 0.88} ${h * 0.32} ${w * 0.54} ${h * 0.5}`
        + `Q${w * 0.88} ${h * 0.68} ${w * 0.88} ${h - cap}L${w * 0.12} ${h - cap}`
        + `Q${w * 0.12} ${h * 0.68} ${w * 0.46} ${h * 0.5}Q${w * 0.12} ${h * 0.32} ${w * 0.12} ${cap}Z`;
    const sand = `M${w * 0.2} ${h * 0.76}Q${w * 0.5} ${h * 0.64} ${w * 0.8} ${h * 0.76}`
        + `L${w * 0.86} ${h - cap - 1.5}L${w * 0.14} ${h - cap - 1.5}Z`;
    return (
        <Svg width={w} height={h}>
            <Path d={sand} fill={SAND} />
            <Path d={glass} fill="none" stroke={GLASS} strokeOpacity={0.55} strokeWidth={1} strokeLinejoin="round" />
            <Line x1={0} y1={cap / 2} x2={w} y2={cap / 2} stroke={GLASS} strokeOpacity={0.85} strokeWidth={2} strokeLinecap="round" />
            <Line x1={0} y1={h - cap / 2} x2={w} y2={h - cap / 2} stroke={GLASS} strokeOpacity={0.85} strokeWidth={2} strokeLinecap="round" />
        </Svg>
    );
}

/** The page behind the portal: a little closer at first, settling as the sand falls away (still with Reduce Motion). */
export function usePortalArrival(arrive: SharedValue<number>) {
    const reduced = useReducedMotion();
    return useAnimatedStyle(() => ({
        transform: [{ scale: reduced ? 1 : 1 + 0.06 * (1 - CINE(interpolate(arrive.get(), [DISSOLVE_FROM, 1], [0, 1], 'clamp'))) }],
    }));
}

const styles = StyleSheet.create({
    glass: { position: 'absolute' },
});
