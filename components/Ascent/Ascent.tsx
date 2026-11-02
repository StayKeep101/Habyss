import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { AppButton, Text, VoidShell } from '@/components/ui';
import { AnimatedFill } from '@/components/ui/Motion';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { useKeyboardShown } from '@/hooks/useKeyboardShown';
import { useAccentGradient } from '@/context/AccentContext';
import { useAppSettings } from '@/context/AppSettingsContext';
import { APP_SLOGAN } from '@/constants/brand';
import { Control, Radius, Spacing } from '@/theme/designSystem';
import { DURATION } from '@/theme/motion';
import { track } from '@/lib/analytics';
import { saveDayWindow, saveName, updateEchoConfig } from '@/lib/echo';
import { NotificationService } from '@/lib/notificationService';
import { dayWindowFor } from '@/lib/onboardingProfile';
import { SCENES, suggestions, type Answers, type ChoiceField } from '@/lib/ascent/story';
import {
    ascentReducer, clearAscent, currentBeat, initialAscent, lineOf, loadAscent, progressOf, saveAscent, stageOf,
    type AscentAction, type AscentState,
} from '@/lib/ascent/machine';
import { commitPlan, stepOf } from '@/lib/ascent/plan';
import { buildEcho } from '@/lib/ascent/echoBuild';
import { Dialogue, type DialogueHandle } from './Dialogue';
import { Stage } from './Stage';
import { ActionPicker, BeginButton, BUILD_STEP_MS, BuildList, ChoiceList, DayAnswer, MultiList, TextAnswer } from './Answers';

/** The save holds at least this long, so the moment reads as something made. */
const SAVE_BEAT_MS = 900;

export interface AscentEnd { state: AscentState; how: 'finished' | 'skipped' }

/**
 * The Ascent, played: Echo in its mood, its line typed out, and whatever the
 * beat asks for under it, on the app's own background. The story is
 * lib/ascent/story.ts, walked by the reducer in lib/ascent/machine.ts and
 * saved after every step (except in preview). The goal and first step are
 * saved by lib/ascent/plan.ts at the commit beat, and their Echo (voice, day,
 * nudges) by lib/ascent/echoBuild.ts at the build beat, independent of
 * anything on screen. A tap anywhere finishes a line, the next moves on;
 * VoiceOver gets a Continue button for the same.
 */
export function Ascent({ preview, onEnd, onAccount }: { preview: boolean; onEnd: (end: AscentEnd) => void; onAccount?: () => void }) {
    const reduced = useReducedMotion();
    const t = useTokens();
    const { primary: color } = useAccentGradient();
    const { setAIPersonality, setNotificationsEnabled } = useAppSettings();
    const { selectionFeedback, successFeedback } = useHaptics();
    const [state, setState] = useState<AscentState | null>(() => (preview ? initialAscent() : null));
    const dispatch = useCallback((action: AscentAction) => setState(current => (current ? ascentReducer(current, action) : current)), []);
    const dialogue = useRef<DialogueHandle>(null);
    const [typed, setTyped] = useState<string | null>(null);
    const [saveFailed, setSaveFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [leaving, setLeaving] = useState(false);
    // Typing an answer, the stage steps aside so Echo's line, the field and Continue all fit above the keyboard.
    const typing = useKeyboardShown();

    // Where it was left, or the start. Preview never reads or writes it.
    useEffect(() => {
        if (preview) { track('onboarding_started', { preview: true }); return; }
        let alive = true;
        loadAscent().then(saved => {
            if (!alive) return;
            if (!saved) track('onboarding_started');
            setState(saved ?? initialAscent());
        });
        return () => { alive = false; };
    }, [preview]);

    // Every step saved, so closing the app mid-story loses nothing.
    useEffect(() => { if (state && !preview && !leaving) void saveAscent(state); }, [state, preview, leaving]);

    const scene = state ? SCENES[state.scene] : null;
    const beat = state ? currentBeat(state) : null;
    const line = state ? lineOf(state) : null;
    const ready = line === null || typed === line;

    // What was learned, as each scene is left (never what was written).
    const lastScene = useRef<number | null>(null);
    useEffect(() => {
        if (!state) return;
        const was = lastScene.current;
        lastScene.current = state.scene;
        if (was !== null && was !== state.scene && SCENES[was]?.id === 'echo') track('eco_introduction_completed');
    }, [state]);

    // The commit beat saves the goal and its first step, once; the build beat saves their Echo. Then the story goes on.
    const beatKey = state ? `${state.scene}:${state.beat}` : '';
    useEffect(() => {
        if (!state || (beat?.kind !== 'commit' && beat?.kind !== 'build')) return;
        let alive = true;
        const hold = (ms: number) => new Promise(done => setTimeout(done, reduced ? 0 : ms));
        if (beat.kind === 'commit') {
            const saving = preview
                ? Promise.resolve({ goalId: 'preview', stepId: 'preview', stepKind: 'task' as const })
                : commitPlan(state.answers, state.created);
            Promise.all([saving, hold(SAVE_BEAT_MS)])
                .then(([created]) => {
                    if (!alive) return;
                    successFeedback();
                    track('first_action_created', { kind: stepOf(state.answers).kind, when: state.answers.when });
                    dispatch({ type: 'created', created });
                })
                .catch(() => { if (alive) setSaveFailed(true); });
        } else {
            const echo = buildEcho(state.answers);
            const saving = preview ? Promise.resolve() : (async () => {
                await saveDayWindow(echo.day).catch(() => undefined);
                setAIPersonality(echo.voice);
                await updateEchoConfig(echo.config).catch(() => undefined);
                // Echo's nudges need notifications: asked here, where it has just said why. A no turns them off, nothing else.
                const allowed = await NotificationService.requestPermissions().catch(() => false);
                if (allowed) await setNotificationsEnabled(true).catch(() => undefined);
                else await updateEchoConfig({ morning: false, evening: false, alive: false }).catch(() => undefined);
                await NotificationService.refreshReminders().catch(() => undefined);
            })();
            // Building never blocks the story: anything that did not save can be set in Echo's settings.
            Promise.all([saving.catch(() => undefined), hold(echo.parts.length * BUILD_STEP_MS + SAVE_BEAT_MS)]).then(() => {
                if (!alive) return;
                successFeedback();
                track('echo_built', { voice: echo.voice });
                dispatch({ type: 'built' });
            });
        }
        return () => { alive = false; };
        // Runs when a saving beat is reached, or Try again is tapped; not on every state change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [beatKey, attempt]);

    const tapScreen = () => {
        if (!state || leaving) return;
        if (dialogue.current?.finish()) return;
        if (beat?.kind === 'line') { selectionFeedback(); dispatch({ type: 'next' }); }
    };

    const answer = (patch: Partial<Answers>) => dispatch({ type: 'answer', patch });

    const choose = (field: ChoiceField, id: string) => {
        answer({ [field]: id } as Partial<Answers>);
        if (field === 'obstacle') track('obstacle_selected', { obstacle: id });
        if (field === 'goal') track('goal_selected', { goal: id });
        if (field === 'source') track('source_selected', { source: id });
        if (field === 'phone') track('screen_time_selected', { phone: id });
        if (field === 'skill') track('skill_selected', { skill: id });
        if (field === 'invite') {
            track('friend_invite_selected', { choice: id });
            // The system sheet is the whole invite: nothing about who is chosen is read or kept.
            if (id === 'yes') Share.share({ message: `I'm starting my climb in Habyss — ${APP_SLOGAN.toLowerCase()}. Come up with me.` }).catch(() => undefined);
        }
    };

    const begin = () => {
        if (!state || leaving) return;
        setLeaving(true);
        track('onboarding_completed', { preview });
        onEnd({ state, how: 'finished' });
    };

    const skip = () => {
        if (!state || leaving) return;
        setLeaving(true);
        track('onboarding_skipped', { scene: scene?.id });
        onEnd({ state, how: 'skipped' });
    };

    if (!state || !scene) return <VoidShell>{null}</VoidShell>;

    const fraction = progressOf(state);
    const mood = beat?.kind === 'commit' || beat?.kind === 'build' ? 'think' : beat?.kind === 'begin' ? 'celebrate' : beat?.mood ?? 'idle';
    const day = dayWindowFor(state.answers.chronotype);

    return (
        <VoidShell>
            <Pressable style={styles.fill} onPress={tapScreen} accessible={false}>
                <SafeAreaView style={styles.fill} pointerEvents="box-none">
                    {/* The onboarding header: how far through, and a way out. */}
                    <View style={styles.header}>
                        <View style={[styles.track, { backgroundColor: t.color.surfaceRaised }]} accessibilityRole="progressbar"
                            accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}>
                            <AnimatedFill progress={fraction} style={[styles.bar, { backgroundColor: color }]} />
                        </View>
                        <AppButton label={preview ? 'Close' : 'Skip'} accessibilityLabel={preview ? 'Close preview' : 'Skip'}
                            variant="ghost" fullWidth={false} onPress={skip} />
                    </View>

                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill} pointerEvents="box-none">
                        {/* Echo, or what it has become; a fixed height, so its line sits at eye level just under it. */}
                        {typing ? null : (
                            <Stage stage={stageOf(state)} answers={state.answers} mood={mood} color={color} label={scene.label} speaking={line !== null && !ready} />
                        )}
    
                        <ScrollView style={styles.fill} contentContainerStyle={styles.lower} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                            {line !== null ? (
                                // No arrow: a tap anywhere moves on. VoiceOver gets the line itself as the button.
                                <Pressable onPress={tapScreen} accessibilityRole="button" accessibilityHint={beat?.kind === 'line' ? 'Double-tap to continue' : undefined}>
                                    <Dialogue key={line} text={line} handle={dialogue} onTyped={() => setTyped(line)} />
                                </Pressable>
                            ) : beat?.kind === 'build' ? (
                                <Animated.View entering={FadeIn.duration(DURATION.base)} style={styles.building}>
                                    <Text variant="title" tone="muted">Building your Echo…</Text>
                                    <BuildList parts={buildEcho(state.answers).parts} color={color} />
                                </Animated.View>
                            ) : (
                                <Animated.View entering={FadeIn.duration(DURATION.base)} accessibilityLiveRegion="polite">
                                    <Text variant="title" tone="muted">{saveFailed ? 'That didn’t save.' : 'Making it real…'}</Text>
                                </Animated.View>
                            )}
    
                            {!leaving && ready ? (
                                <View style={styles.controls} pointerEvents="box-none">
                                    {beat?.kind === 'choice' ? (
                                        <ChoiceList key={beatKey} options={beat.options} color={color} onChoose={id => choose(beat.field, id)}
                                            own={beat.own ? {
                                                label: beat.own.label, placeholder: beat.own.placeholder,
                                                onText: text => { track('goal_selected', { goal: 'own' }); answer({ [beat.field]: 'own', [beat.own!.field]: text } as Partial<Answers>); },
                                            } : undefined} />
                                    ) : null}
                                    {beat?.kind === 'multi' ? (
                                        <MultiList key={beatKey} options={beat.options} color={color} onDone={ids => answer({ juggling: ids as Answers['juggling'] })} />
                                    ) : null}
                                    {beat?.kind === 'day' ? (
                                        <DayAnswer key={beatKey} wake={state.answers.wake ?? day.wake} sleep={state.answers.sleep ?? day.sleep} color={color} onDone={answer} />
                                    ) : null}
                                    {beat?.kind === 'input' ? (
                                        <TextAnswer key={beatKey} label="Your name" placeholder={beat.placeholder} optional={beat.optional} autoCapitalize="words"
                                            onAnswer={value => {
                                                if (value && !preview) saveName(value).catch(() => undefined);
                                                answer({ name: value });
                                            }} />
                                    ) : null}
                                    {beat?.kind === 'action' ? (
                                        <ActionPicker key={beatKey} suggestions={suggestions(state.answers)} color={color}
                                            onPick={(label, own) => answer({ action: label, actionKind: own ? undefined : suggestions(state.answers).find(item => item.label === label)?.kind })} />
                                    ) : null}
                                    {beat?.kind === 'commit' && saveFailed ? (
                                        <AppButton label="Try again" icon="refresh" onPress={() => { setSaveFailed(false); setAttempt(count => count + 1); }} />
                                    ) : null}
                                    {beat?.kind === 'begin' ? <BeginButton onPress={begin} /> : null}
                                    {state.scene === 0 && onAccount && !preview ? (
                                        <AppButton label="I already have an account" variant="ghost" onPress={onAccount} />
                                    ) : null}
                                </View>
                            ) : null}
                        </ScrollView>
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </Pressable>
        </VoidShell>
    );
}

/** After the story, whichever way it ended: forget the saved place. */
export const forgetAscent = clearAscent;

const styles = StyleSheet.create({
    fill: { flex: 1 },
    // As the onboarding header always was: a thin progress line and Skip beside it.
    header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingLeft: Spacing.xl, paddingRight: Spacing.sm, minHeight: Control.hitTarget },
    track: { flex: 1, height: Spacing.xs, borderRadius: Radius.pill, overflow: 'hidden' },
    bar: { height: '100%', borderRadius: Radius.pill },
    // Echo's line first, at eye level under the stage, then whatever it asks for.
    lower: { flexGrow: 1, paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.lg, gap: Spacing.lg },
    controls: { gap: Spacing.sm },
    building: { gap: Spacing.lg },
});
