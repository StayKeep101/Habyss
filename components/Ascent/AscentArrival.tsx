import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOut, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { Overlay } from '@/components/ui/Overlay';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { useAccentGradient } from '@/context/AccentContext';
import { on } from '@/lib/appEvents';
import { track } from '@/lib/analytics';
import { FontFamily, Radius, Spacing } from '@/theme/designSystem';
import { DURATION, EASE, timingFor } from '@/theme/motion';
import { ABYSS } from './AbyssWorld';

/** What the Ascent leaves for Home: the first step it made, and whether Home has pointed at it yet. */
export const FIRST_STEP_KEY = 'habyss_first_step';
interface FirstStep { goalId: string; stepId: string; stepKind: 'task' | 'habit'; title: string; arrived: boolean }

const FLOOD_MS = 1200;

/** Set by the Ascent as it hands over, so Home's first frame is already the light (no flash of Home before it). */
let arriving = false;
export function expectArrival() { arriving = true; }
const SAY_MS = 4200;

/**
 * Home, the first time after the Ascent: the light of the opening fading off
 * the screen (the climb ends here, not in a cut), then Echo, small, pointing
 * at the first step. When that step is done, wherever it is ticked, Echo says
 * "One step closer." with a soft ring and a success tap, once, and the
 * Ascent is over. Nothing shows for anyone who never went through it.
 */
export function AscentArrival() {
    const reduced = useReducedMotion();
    const insets = useSafeAreaInsets();
    const { successFeedback } = useHaptics();
    const [step, setStep] = useState<FirstStep | null>(null);
    const [flooding, setFlooding] = useState(arriving);
    const [say, setSay] = useState<{ text: string; done: boolean } | null>(null);
    const flood = useSharedValue(1);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const speak = (text: string, done: boolean) => {
        if (timer.current) clearTimeout(timer.current);
        setSay({ text, done });
        timer.current = setTimeout(() => setSay(null), SAY_MS);
    };

    const fadeIn = () => {
        setFlooding(true);
        flood.value = withTiming(0, timingFor(reduced ? 0 : FLOOD_MS, EASE.enter));
        setTimeout(() => setFlooding(false), reduced ? DURATION.base : FLOOD_MS);
    };

    useEffect(() => {
        let alive = true;
        AsyncStorage.getItem(FIRST_STEP_KEY).then(raw => {
            const saved = (() => { try { return JSON.parse(raw ?? 'null') as FirstStep | null; } catch { return null; } })();
            if (!alive) return;
            if (!saved?.stepId) { if (arriving) fadeIn(); arriving = false; return; }
            setStep(saved);
            if (saved.arrived) return;
            AsyncStorage.setItem(FIRST_STEP_KEY, JSON.stringify({ ...saved, arrived: true })).catch(() => undefined);
            if (arriving) fadeIn();
            arriving = false;
            setTimeout(() => speak('Your first step is waiting.', false), reduced ? 0 : FLOOD_MS * 0.7);
        });
        return () => { alive = false; if (timer.current) clearTimeout(timer.current); };
        // Once, as Home first opens.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // The first step done: said once, then the Ascent is finished for good.
    useEffect(() => {
        if (!step) return;
        const reached = () => {
            successFeedback();
            track('first_action_completed', { kind: step.stepKind });
            speak('One step closer.', true);
            setStep(null);
            AsyncStorage.removeItem(FIRST_STEP_KEY).catch(() => undefined);
        };
        const offHabit = on('habit_completion_updated', change => { if (change.habitId === step.stepId && change.completed) reached(); });
        const offTask = on('task_completed', change => { if (change.taskId === step.stepId) reached(); });
        return () => { offHabit.remove(); offTask.remove(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step]);

    const floodStyle = useAnimatedStyle(() => ({ opacity: flood.value }));
    if (!flooding && !say) return null;
    return (
        <Overlay>
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                {flooding ? <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: ABYSS.light }, floodStyle]} /> : null}
                {say ? <EchoSays key={say.text} text={say.text} done={say.done} bottom={insets.bottom + Spacing.xxl * 3} /> : null}
            </View>
        </Overlay>
    );
}

/** Echo, small, saying one thing; a ring goes out when it is good news. */
function EchoSays({ text, done, bottom }: { text: string; done: boolean; bottom: number }) {
    const tokens = useTokens();
    const { primary: color } = useAccentGradient();
    const ring = useSharedValue(0);
    useEffect(() => { if (done) ring.value = withTiming(1, timingFor(1200, EASE.enter)); }, [done, ring]);
    const ringStyle = useAnimatedStyle(() => ({ opacity: interpolate(ring.value, [0, 0.1, 1], [0, 0.7, 0]), transform: [{ scale: 1 + ring.value * 4 }] }));
    return (
        <Animated.View entering={FadeInDown.duration(DURATION.reward).easing(EASE.enter)} exiting={FadeOut.duration(DURATION.exit)}
            style={[styles.wrap, { bottom }]} accessible accessibilityLiveRegion="polite" accessibilityLabel={`Echo: ${text}`}>
            <MatteSurface radius={Radius.pill} level="control" style={styles.chip}>
                <View style={styles.light}>
                    <Animated.View style={[styles.dot, styles.ring, { borderColor: color }, ringStyle]} />
                    <View style={[styles.glow, { backgroundColor: color }]} />
                    <View style={[styles.dot, { backgroundColor: color }]} />
                </View>
                <Text style={[styles.text, { color: tokens.color.textPrimary }]}>{text}</Text>
            </MatteSurface>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    wrap: { position: 'absolute', alignSelf: 'center', left: Spacing.xl, right: Spacing.xl, alignItems: 'center' },
    chip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingLeft: Spacing.md, paddingRight: Spacing.lg, minHeight: 48 },
    light: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
    dot: { position: 'absolute', width: 12, height: 12, borderRadius: 6 },
    glow: { position: 'absolute', width: 20, height: 20, borderRadius: 10, opacity: 0.3 },
    ring: { backgroundColor: 'transparent', borderWidth: 1.5 },
    text: { fontFamily: FontFamily.semibold, fontSize: 16 },
});
