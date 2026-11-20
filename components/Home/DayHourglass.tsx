import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    cancelAnimation, Easing, interpolate, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue,
    withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { Hourglass } from './Hourglass';
import { ArtHourglass } from './ArtHourglass';
import { LIVE_HOURGLASS_ART, MATTE_HOURGLASS } from '@/theme/hourglassArt';
import { MatteHourglass } from './MatteHourglass';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { useOnScreen } from '@/hooks/useOnScreen';
import { useNowStep } from '@/hooks/useNowStep';
import { focusTurn } from '@/lib/focusStage';
import { AppIcon } from '@/components/ui/AppIcon';
import { useAccent } from '@/context/AccentContext';
import { cachedDayWindow, getDayWindow, DEFAULT_DAY, type DayWindow } from '@/lib/echo';
import { clockLabel, flipDue, glassAt, type GlassState } from '@/lib/dayGlass';
import { localDateKey } from '@/lib/habitSchedule';
import { emit } from '@/lib/appEvents';
import { glassDesign } from '@/theme/hourglassDesigns';
import { CEREMONY, EASE, timingFor } from '@/theme/motion';
import { FontFamily, Spacing } from '@/theme/designSystem';
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
 * Tap it to see every hourglass you can earn (components/Home/GlassCarousel.tsx).
 */
export function DayHourglass({ marks }: { marks: number }) {
    const t = useTokens();
    const { rippleFeedback, lightFeedback } = useHaptics();
    const { rankShown } = useAccent();
    const design = glassDesign(rankShown);
    const reduced = useReducedMotion();

    const [day, setDay] = useState<DayWindow>(() => cachedDayWindow() ?? DEFAULT_DAY);
    useEffect(() => { void getDayWindow().then(setDay).catch(() => undefined); }, []);
    const [glass, setGlass] = useState<GlassState>(() => glassAt(new Date(), day));
    const ran = useSharedValue(glass.ran);
    const [flipping, setFlipping] = useState(false);
    const flippingRef = useRef(false);

    // The clocks tick each second while Home is in front; the sand follows (a pixel every few minutes: no animation needed).
    const onScreen = useOnScreen();
    useEffect(() => {
        if (!onScreen) return;
        const tick = () => {
            const next = glassAt(new Date(), day);
            setGlass(next);
            if (!flippingRef.current) ran.set(next.ran);
        };
        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [day, ran, onScreen]);

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
        // Felt everywhere: rings roll out from the glass over the whole screen, and the
        // ripple rhythm (five taps, widening) rolls through the phone with them.
        rippleFeedback();
        glassRef.current?.measureInWindow((x, y, width, height) => {
            emit('glass_flipped', { x: x + width / 2, y: y + height / 2, color: design.sand[0] });
        });
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
            // Its morning flip, and the turn into Focus (lib/focusStage.ts).
            { rotate: `${180 * (turn.get() + focusTurn.get())}deg` },
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

    // The sand falls in the colour of what you are on now (a habit or task you picked a colour for).
    const step = useNowStep();
    const nowColor = step && !step.wait && (step.item.kind === 'habit' || step.item.kind === 'task') ? step.item.color : undefined;

    const glassRef = useRef<View>(null);
    const reveal = () => {
        if (flipping) return;
        lightFeedback();
        emit('glass_open', { rank: rankShown ?? 'Lost', marks });
    };

    const pastWords = `${Math.floor(glass.past / 3600)} hours ${Math.floor((glass.past % 3600) / 60)} minutes`;
    const leftWords = `${Math.floor(glass.left / 3600)} hours ${Math.floor((glass.left % 3600) / 60)} minutes`;

    return (
        // On the panel's top edge (Home): the glass half over the scene, half on the panel; the clocks on the panel beside it.
        <View style={styles.stage}>
            {/* What each clock is, said by shape, never words: the sun (since you woke) and the moon (until bed).
                Plain figures, no pill: they are read, not pressed, so they do not look like buttons. */}
            <View style={styles.clockPill}>
                <AppIcon name="sunny" size={CLOCK_ICON} color={t.color.textMuted} />
                <Text style={[styles.clock, { color: t.color.textMuted }]} accessibilityLabel={`${pastWords} of today gone`}>
                    {glass.resting === 'night' ? '—' : clockLabel(glass.past)}
                </Text>
            </View>
            <Pressable onPress={reveal} accessibilityRole="button" style={styles.glassBox}
                accessibilityLabel={glass.resting === 'night' ? 'Your day has run out. See every hourglass' : `Your day: ${leftWords} left. See every hourglass`}>
                <Animated.View style={[styles.flare, { backgroundColor: design.sand[0] }, flareStyle]} pointerEvents="none" />
                <Animated.View style={[styles.ring, { borderColor: design.sand[0] }, ringStyle]} pointerEvents="none" />
                <Animated.View style={[styles.ring, { borderColor: design.sand[0] }, echoRingStyle]} pointerEvents="none" />
                <Animated.View ref={glassRef} collapsable={false} style={glassStyle}>
                    {MATTE_HOURGLASS[rankShown ?? 'Lost'] ? (
                        <MatteHourglass glass={MATTE_HOURGLASS[rankShown ?? 'Lost']} design={design} size={GLASS_HEIGHT} ran={ran}
                            running={!flipping && glass.resting !== 'night'} streamColor={nowColor} />
                    ) : LIVE_HOURGLASS_ART[rankShown ?? 'Lost'] ? (
                        <ArtHourglass art={LIVE_HOURGLASS_ART[rankShown ?? 'Lost']} size={GLASS_HEIGHT} ran={ran} running={!flipping && glass.resting !== 'night'} />
                    ) : (
                        <Hourglass design={design} size={GLASS_HEIGHT} ran={ran} running={!flipping && glass.resting !== 'night'} streamColor={nowColor} />
                    )}
                </Animated.View>
            </Pressable>
            <View style={styles.clockPill}>
                <AppIcon name="moon" size={CLOCK_ICON} color={t.color.accentText} />
                <Text style={[styles.clock, { color: t.color.accentText }]} accessibilityLabel={`${leftWords} left today`}>
                    {glass.resting === 'night' ? '—' : clockLabel(glass.left)}
                </Text>
            </View>
        </View>
    );
}

/**
 * Behind Home's sheet, under the fixed header: your rank's light falling from
 * above, and specks of it drifting up, more the higher your rank.
 */
export function DayGlassBackdrop() {
    const t = useTokens();
    const { rankShown } = useAccent();
    const design = glassDesign(rankShown);
    const reduced = useReducedMotion();
    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <LinearGradient colors={[tint(t.color.accent, 'soft'), tint(t.color.accent, 'subtle'), 'transparent']} locations={[0, 0.35, 0.7]} style={StyleSheet.absoluteFill} />
            <Motes color={design.sand[0]} count={4 + design.rings * 3} still={reduced} />
        </View>
    );
}

/** Specks of light drifting up through the arch, slowly; more of them the higher your rank. */
function Motes({ color, count, still }: { color: string; count: number; still: boolean }) {
    // Drifting only while Home is in front (hooks/useOnScreen.ts).
    const onScreen = useOnScreen();
    still = still || !onScreen;
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
        return () => cancelAnimation(rise);
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


const CLOCK_ICON = s(14);

const styles = StyleSheet.create({
    // Half above the panel's edge: pulled up by half the glass; the clocks sit level with its lower half, on the panel.
    stage: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: -GLASS_HEIGHT / 2 },
    // The same figures as the stats bar: Lexend bold, tabular, on the app's matte pill.
    // Bigger figures, the icon before them, the same inner spacing all round (8 / 12).
    clockPill: { width: s(128), marginBottom: GLASS_HEIGHT / 4 - s(20), paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs },
    clock: { fontFamily: FontFamily.bold, fontSize: s(19), fontVariant: ['tabular-nums'] },
    glassBox: { alignItems: 'center', justifyContent: 'center' },
    flare: { position: 'absolute', width: GLASS_HEIGHT, height: GLASS_HEIGHT, borderRadius: GLASS_HEIGHT / 2 },
    ring: { position: 'absolute', width: GLASS_HEIGHT * 0.7, height: GLASS_HEIGHT * 0.7, borderRadius: GLASS_HEIGHT, borderWidth: 2 },
    mote: { position: 'absolute', bottom: '30%', width: 3, height: 3, borderRadius: 1.5 },
});
