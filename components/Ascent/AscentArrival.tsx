import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { Echo, MatteSurface, Overlay, Text } from '@/components/ui';
import { useHaptics } from '@/hooks/useHaptics';
import { on } from '@/lib/appEvents';
import { track } from '@/lib/analytics';
import { Control, Radius, Spacing } from '@/theme/designSystem';
import { DURATION, EASE } from '@/theme/motion';

/** What the Ascent leaves for Home: the first step it made, and whether Home has pointed at it yet. */
export const FIRST_STEP_KEY = 'habyss_first_step';
interface FirstStep { goalId: string; stepId: string; stepKind: 'task' | 'habit'; title: string; arrived: boolean }

const SAY_MS = 4200;
/** A beat after Home appears, so the first thing seen is Home, then Echo. */
const SETTLE_MS = 800;

/**
 * Home, the first time after the Ascent: Echo, small, pointing at the first
 * step. When that step is done, wherever it is ticked, Echo says
 * "One step closer." with a soft ring and a success tap, once, and the
 * Ascent is over. Nothing shows for anyone who never went through it.
 */
export function AscentArrival() {
    const reduced = useReducedMotion();
    const insets = useSafeAreaInsets();
    const { successFeedback } = useHaptics();
    const [step, setStep] = useState<FirstStep | null>(null);
    const [say, setSay] = useState<{ text: string; done: boolean } | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const speak = (text: string, done: boolean) => {
        if (timer.current) clearTimeout(timer.current);
        setSay({ text, done });
        timer.current = setTimeout(() => setSay(null), SAY_MS);
    };

    useEffect(() => {
        let alive = true;
        AsyncStorage.getItem(FIRST_STEP_KEY).then(raw => {
            const saved = (() => { try { return JSON.parse(raw ?? 'null') as FirstStep | null; } catch { return null; } })();
            if (!alive) return;
            if (!saved?.stepId) return;
            setStep(saved);
            if (saved.arrived) return;
            AsyncStorage.setItem(FIRST_STEP_KEY, JSON.stringify({ ...saved, arrived: true })).catch(() => undefined);
            setTimeout(() => speak('Your first step is waiting.', false), reduced ? 0 : SETTLE_MS);
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

    if (!say) return null;
    return (
        <Overlay>
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                {say ? <EchoSays key={say.text} text={say.text} done={say.done} bottom={insets.bottom + Spacing.xxl * 3} /> : null}
            </View>
        </Overlay>
    );
}

/** Echo, small, saying one thing; it celebrates when it is good news. */
function EchoSays({ text, done, bottom }: { text: string; done: boolean; bottom: number }) {
    return (
        <Animated.View entering={FadeInDown.duration(DURATION.reward).easing(EASE.enter)} exiting={FadeOut.duration(DURATION.exit)}
            style={[styles.wrap, { bottom }]} accessible accessibilityLiveRegion="polite" accessibilityLabel={`Echo: ${text}`}>
            <MatteSurface radius={Radius.pill} level="control" style={styles.chip}>
                <View style={styles.light}><Echo size="small" mood={done ? 'celebrate' : 'speak'} /></View>
                <Text variant="heading">{text}</Text>
            </MatteSurface>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    wrap: { position: 'absolute', alignSelf: 'center', left: Spacing.xl, right: Spacing.xl, alignItems: 'center' },
    chip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingLeft: Spacing.md, paddingRight: Spacing.lg, minHeight: Control.hitTarget },
    // Echo's small field is wider than the chip is tall; it is centred here and spills, as light does.
    light: { width: Spacing.xl, height: Spacing.xl, alignItems: 'center', justifyContent: 'center' },
});
