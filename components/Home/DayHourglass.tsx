import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    Easing, interpolate, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue,
    withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { Hourglass } from './Hourglass';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { useAccent } from '@/context/AccentContext';
import { cachedDayWindow, getDayWindow, DEFAULT_DAY, type DayWindow } from '@/lib/echo';
import { clockLabel, flipDue, glassAt, type GlassState } from '@/lib/dayGlass';
import { localDateKey } from '@/lib/habitSchedule';
import { emit } from '@/lib/appEvents';
import { glassDesign } from '@/theme/hourglassDesigns';
import { CEREMONY, EASE, timingFor } from '@/theme/motion';
import { FontFamily } from '@/theme/designSystem';
import { s } from '@/theme/scale';
import { tint } from '@/theme/tokens';

/** The glass's height on Home, from the screen's width so every phone keeps the proportion. */
export const GLASS_HEIGHT = s(128);
const FLIP_KEY = 'habyss_glass_flipped';

// Built once, outside any worklet (a helper call inside one crashes natively).
const RISE = timingFor(CEREMONY.settle, EASE.enter);
const TURN = timingFor(CEREMONY.reveal, EASE.land);
const SETTLE = timingFor(CEREMONY.settle, EASE.move);
const BURST = timingFor(CEREMONY.gather, EASE.enter);
const DRIFT = timingFor(CEREMONY.count * 4, Easing.inOut(Easing.sin));

/**
 * Your day as an hourglass, at the heart of Home (lib/dayGlass.ts).
 *
 * The glass is your rank's (theme/hourglassDesigns.ts), standing in an arch
 * lit in your rank's colour with motes drifting through it. To its left, the
 * time gone since you woke; to its right, the time left until bed, both to
 * the second. The sand falls with the clock and nothing else.
 *
 * The first time you open Habyss in the morning (after waking, before noon,
 * once a day) the glass turns over: it rises, turns with weight, lands with a
 * thud of haptics and a ring of light, and the new day's sand begins. With
 * Reduce Motion it simply fills.
 *
 * Tap it to pull it apart onto your Roadmap (components/Home/GlassReveal.tsx).
 */
export function DayHourglass() {
    const t = useTokens();
    const { resonance, lightFeedback } = useHaptics();
    const { rankShown } = useAccent();
    const design = glassDesign(rankShown);
    const reduced = useReducedMotion();

    const [day, setDay] = useState<DayWindow>(() => cachedDayWindow() ?? DEFAULT_DAY);
    useEffect(() => { void getDayWindow().then(setDay).catch(() => undefined); }, []);
    const [glass, setGlass] = useState<GlassState>(() => glassAt(new Date(), day));
    const ran = useSharedValue(glass.ran);
    const [flipping, setFlipping] = useState(false);
    const flippingRef = useRef(false);

    // The clocks tick each second; the sand follows (a pixel every few minutes: no animation needed).
    useEffect(() => {
        const tick = () => {
            const next = glassAt(new Date(), day);
            setGlass(next);
            if (!flippingRef.current) ran.set(next.ran);
        };
        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [day, ran]);

    // The morning flip.
    const turn = useSharedValue(0);
    const lift = useSharedValue(0);
    const burst = useSharedValue(0);
    useEffect(() => {
        let alive = true;
        void (async () => {
            const today = localDateKey(new Date());
            const last = await AsyncStorage.getItem(FLIP_KEY).catch(() => null);
            if (!alive || !flipDue(new Date(), day, today, last)) return;
            await AsyncStorage.setItem(FLIP_KEY, today).catch(() => undefined);
            playFlip();
        })();
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [day]);

    const landed = () => {
        // The rarest rhythm in the app: three slow taps, as for a goal reached.
        void resonance();
        flippingRef.current = false;
        setFlipping(false);
        ran.set(glassAt(new Date(), day).ran);
    };
    const playFlip = () => {
        flippingRef.current = true;
        setFlipping(true);
        // Last night's glass: all the sand below.
        ran.set(1);
        if (reduced) { ran.set(glassAt(new Date(), day).ran); landed(); return; }
        lightFeedback();
        lift.set(withSequence(withTiming(1, RISE), withDelay(CEREMONY.reveal, withTiming(0, SETTLE))));
        turn.set(withDelay(CEREMONY.settle, withTiming(1, TURN, finished => {
            if (!finished) return;
            // Turned over, the full bulb is now on top: the same picture as the new day's glass.
            turn.set(0);
            ran.set(0);
            burst.set(0);
            burst.set(withTiming(1, BURST));
            runOnJS(landed)();
        })));
    };

    const glassStyle = useAnimatedStyle(() => ({
        transform: [
            { translateY: -20 * lift.get() },
            { scale: 1 + 0.25 * lift.get() },
            { rotate: `${180 * turn.get()}deg` },
        ],
    }));
    const ringStyle = useAnimatedStyle(() => ({
        opacity: interpolate(burst.get(), [0, 0.15, 1], [0, 0.9, 0]),
        transform: [{ scale: interpolate(burst.get(), [0, 1], [0.4, 3.2]) }],
    }));
    // A second ring, a beat behind the first.
    const echoRingStyle = useAnimatedStyle(() => ({
        opacity: interpolate(burst.get(), [0, 0.3, 0.45, 1], [0, 0, 0.6, 0]),
        transform: [{ scale: interpolate(burst.get(), [0, 0.3, 1], [0.4, 0.4, 2.4]) }],
    }));
    // The arch blazes as the glass lands, then settles back to its glow.
    const flareStyle = useAnimatedStyle(() => ({ opacity: interpolate(burst.get(), [0, 0.1, 1], [0, 1, 0]) }));

    const glassRef = useRef<View>(null);
    const reveal = () => {
        if (flipping) return;
        lightFeedback();
        glassRef.current?.measureInWindow((x, y, width, height) => {
            emit('glass_reveal', { rank: rankShown ?? 'Lost', ran: ran.get(), frame: { x, y, width, height } });
        });
    };

    const pastWords = `${Math.floor(glass.past / 3600)} hours ${Math.floor((glass.past % 3600) / 60)} minutes`;
    const leftWords = `${Math.floor(glass.left / 3600)} hours ${Math.floor((glass.left % 3600) / 60)} minutes`;

    return (
        <View style={styles.stage}>
            {/* The arch: your rank's light, falling into the page. */}
            <View style={[styles.arch, { borderColor: tint(t.color.accent, 'subtle') }]} pointerEvents="none">
                <LinearGradient colors={[tint(t.color.accent, 'soft'), tint(t.color.accent, 'subtle'), 'transparent']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
            </View>
            <Animated.View style={[styles.arch, styles.flare, flareStyle]} pointerEvents="none">
                <LinearGradient colors={[design.sand[0], tint(design.sand[0], 'soft'), 'transparent']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
            </Animated.View>
            <Motes color={design.sand[0]} count={4 + design.rings * 3} still={reduced} />

            <Text style={[styles.clock, { color: t.color.textMuted }]} accessibilityLabel={`${pastWords} of today gone`}>
                {glass.resting === 'night' ? '—' : clockLabel(glass.past)}
            </Text>

            <Pressable onPress={reveal} accessibilityRole="button" style={styles.glassBox}
                accessibilityLabel={glass.resting === 'night' ? 'Your day has run out. Open your Roadmap' : `Your day: ${leftWords} left. Open your Roadmap`}>
                <Animated.View style={[styles.ring, { borderColor: design.sand[0] }, ringStyle]} pointerEvents="none" />
                <Animated.View style={[styles.ring, { borderColor: design.sand[0] }, echoRingStyle]} pointerEvents="none" />
                <Animated.View ref={glassRef} collapsable={false} style={glassStyle}>
                    <Hourglass design={design} size={GLASS_HEIGHT} ran={ran} running={!flipping && glass.resting !== 'night'} />
                </Animated.View>
            </Pressable>

            <Text style={[styles.clock, { color: t.color.accent }]} accessibilityLabel={`${leftWords} left today`}>
                {glass.resting === 'night' ? '—' : clockLabel(glass.left)}
            </Text>
        </View>
    );
}

/** Specks of light drifting up through the arch, slowly; more of them the higher your rank. */
function Motes({ color, count, still }: { color: string; count: number; still: boolean }) {
    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {Array.from({ length: count }, (_, index) => <Mote key={index} index={index} color={color} still={still} />)}
        </View>
    );
}

function Mote({ index, color, still }: { index: number; color: string; still: boolean }) {
    const rise = useSharedValue(0);
    useEffect(() => {
        if (still) return;
        rise.set(withDelay(index * 380, withRepeat(withTiming(1, DRIFT), -1, false)));
    }, [rise, index, still]);
    // Where each speck starts, the same every time (worked out here, not in the worklet).
    const left = `${8 + ((index * 37) % 84)}%` as const;
    const travel = s(70) + (index % 3) * s(14);
    const style = useAnimatedStyle(() => ({
        opacity: interpolate(rise.get(), [0, 0.2, 0.8, 1], [0, 0.7, 0.7, 0]),
        transform: [{ translateY: -travel * rise.get() }],
    }));
    return <Animated.View style={[styles.mote, { left, backgroundColor: color }, style]} />;
}


const styles = StyleSheet.create({
    stage: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: s(18), paddingBottom: s(6), paddingHorizontal: s(6), overflow: 'hidden' },
    arch: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderTopLeftRadius: s(200), borderTopRightRadius: s(200), borderWidth: 1, borderBottomWidth: 0, overflow: 'hidden' },
    clock: { width: s(96), textAlign: 'center', fontFamily: FontFamily.semibold, fontSize: s(17), fontVariant: ['tabular-nums'] },
    glassBox: { alignItems: 'center', justifyContent: 'center' },
    flare: { borderWidth: 0 },
    ring: { position: 'absolute', width: GLASS_HEIGHT * 0.7, height: GLASS_HEIGHT * 0.7, borderRadius: GLASS_HEIGHT, borderWidth: 2 },
    mote: { position: 'absolute', bottom: s(10), width: 3, height: 3, borderRadius: 1.5 },
});
