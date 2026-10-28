import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
    FadeIn, FadeInDown, FadeOut, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { AppIcon } from '@/components/ui/AppIcon';
import { useHaptics } from '@/hooks/useHaptics';
import { useAccentGradient } from '@/context/AccentContext';
import { APP_SLOGAN } from '@/constants/brand';
import { FontFamily, Radius, Spacing } from '@/theme/designSystem';
import { DURATION, EASE, timingFor } from '@/theme/motion';
import { textOn } from '@/theme/tokens';
import { track } from '@/lib/analytics';
import { saveName } from '@/lib/echo';
import { DISCOVERIES, SCENES, suggestions, type Answers } from '@/lib/ascent/story';
import {
    ascentReducer, beatsOf, clearAscent, cuesOf, currentBeat, initialAscent, lineOf, loadAscent, progressOf, saveAscent,
    type AscentAction, type AscentState,
} from '@/lib/ascent/machine';
import { commitPlan, stepOf } from '@/lib/ascent/plan';
import { ABYSS, AbyssWorld } from './AbyssWorld';
import { EchoLight } from './EchoLight';
import { Dialogue, type DialogueHandle } from './Dialogue';
import { ActionPicker, BeginButton, ChoiceList, TextAnswer } from './Answers';
import { SceneArt } from './SceneArt';

const MUTED = 'rgba(244,241,232,0.62)';

/** Where the camera is in each scene: how deep, and how far it looks up. */
const CAMERA: Record<string, { depth: number; lift: number; ms: number }> = {
    'first-light': { depth: 0.1, lift: 0, ms: 1600 },
    descent: { depth: 0.55, lift: 0, ms: 5000 },
    mirror: { depth: 0.75, lift: 0, ms: 2400 },
    spark: { depth: 0.85, lift: 0, ms: 2400 },
    domino: { depth: 1, lift: 0, ms: 2400 },
    'turning-point': { depth: 1, lift: 1, ms: 2800 },
    foothold: { depth: 0.9, lift: 0.85, ms: 2000 },
    allies: { depth: 0.85, lift: 0.85, ms: 2000 },
    ascent: { depth: 0.7, lift: 1, ms: 2400 },
};
/** How long rising through the opening takes, before Home. */
const RISE_MS = 1800;
/** The save holds at least this long, so the moment reads as something made. */
const SAVE_BEAT_MS = 900;
/** The progress line gliding to its new length (made here: worklets only read it). */
const GLIDE = timingFor(DURATION.emphasis, EASE.move);

export interface AscentEnd { state: AscentState; how: 'finished' | 'skipped' }

/**
 * The Ascent, played: the world (AbyssWorld + SceneArt) moved by where the
 * story is, Echo's light in its mood, its line typed out, and whatever the
 * beat asks for under it. The story is lib/ascent/story.ts, walked by the
 * reducer in lib/ascent/machine.ts and saved after every step (except in
 * preview); the goal and first step are saved by lib/ascent/plan.ts at the
 * commit beat, independent of anything on screen. A tap anywhere finishes a
 * line, the next moves on; VoiceOver gets a Continue button for the same.
 */
export function Ascent({ preview, onEnd, onAccount }: { preview: boolean; onEnd: (end: AscentEnd) => void; onAccount?: () => void }) {
    const reduced = useReducedMotion();
    const { primary: color } = useAccentGradient();
    const { selectionFeedback, successFeedback, lightFeedback } = useHaptics();
    const [state, setState] = useState<AscentState | null>(() => (preview ? initialAscent() : null));
    const dispatch = useCallback((action: AscentAction) => setState(current => (current ? ascentReducer(current, action) : current)), []);
    const dialogue = useRef<DialogueHandle>(null);
    const [typed, setTyped] = useState<string | null>(null);
    const [saveFailed, setSaveFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [discovery, setDiscovery] = useState<string | null>(null);
    const [leaving, setLeaving] = useState(false);
    const depth = useSharedValue(0);
    const lift = useSharedValue(0);

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
    const cues = useMemo(() => (state ? cuesOf(state) : new Set()), [state]) as ReturnType<typeof cuesOf>;
    const ready = line === null || typed === line;

    // The camera, per scene.
    useEffect(() => {
        if (!scene || leaving) return;
        const at = CAMERA[scene.id];
        depth.value = withTiming(at.depth, timingFor(reduced ? 0 : at.ms, EASE.move));
        lift.value = withTiming(at.lift, timingFor(reduced ? 0 : at.ms, EASE.move));
    }, [scene, depth, lift, reduced, leaving]);

    // What was learned, as each scene is left (never what was written).
    const lastScene = useRef<number | null>(null);
    useEffect(() => {
        if (!state) return;
        const was = lastScene.current;
        lastScene.current = state.scene;
        if (was === null || was === state.scene) return;
        const left = SCENES[was]?.id;
        if (left === 'first-light') track('eco_introduction_completed');
        if (left === 'spark' || left === 'domino') track('lesson_completed', { lesson: left });
    }, [state]);

    // The commit beat: save the goal and its first step, once, then go on.
    const beatKey = state ? `${state.scene}:${state.beat}` : '';
    useEffect(() => {
        if (!state || beat?.kind !== 'commit') return;
        let alive = true;
        const saving = preview
            ? Promise.resolve({ goalId: 'preview', stepId: 'preview', stepKind: 'task' as const })
            : commitPlan(state.answers, state.created);
        Promise.all([saving, new Promise(done => setTimeout(done, reduced ? 0 : SAVE_BEAT_MS))])
            .then(([created]) => {
                if (!alive) return;
                successFeedback();
                track('first_action_created', { kind: stepOf(state.answers).kind, when: state.answers.when });
                dispatch({ type: 'created', created });
            })
            .catch(() => { if (alive) setSaveFailed(true); });
        return () => { alive = false; };
        // Runs when the commit beat is reached, or Try again is tapped; not on every state change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [beatKey, attempt]);

    const tapScreen = () => {
        if (!state || leaving) return;
        if (discovery) { setDiscovery(null); return; }
        if (dialogue.current?.finish()) return;
        if (beat?.kind === 'line') { selectionFeedback(); dispatch({ type: 'next' }); }
    };

    const answer = (field: keyof Answers, value: string, also?: Partial<Answers>) => dispatch({ type: 'answer', field, value, also });

    const choose = (field: keyof Answers, id: string) => {
        answer(field, id);
        if (field === 'obstacle') track('obstacle_selected', { obstacle: id });
        if (field === 'goal') track('goal_selected', { goal: id });
        if (field === 'invite') {
            track('friend_invite_selected', { choice: id });
            // The system sheet is the whole invite: nothing about who is chosen is read or kept.
            if (id === 'yes') Share.share({ message: `I'm starting my climb in Habyss — ${APP_SLOGAN.toLowerCase()}. Come up with me.` }).catch(() => undefined);
        }
    };

    const begin = () => {
        if (!state || leaving) return;
        setLeaving(true);
        successFeedback();
        track('onboarding_completed', { preview });
        lift.set(withTiming(1.7, timingFor(reduced ? 0 : RISE_MS, EASE.exit)));
        setTimeout(() => onEnd({ state, how: 'finished' }), reduced ? DURATION.base : RISE_MS);
    };

    const skip = () => {
        if (!state || leaving) return;
        lightFeedback();
        setLeaving(true);
        track('onboarding_skipped', { scene: scene?.id });
        onEnd({ state, how: 'skipped' });
    };

    // Rising through: the opening floods the whole screen with light, and Home comes out of it.
    const flood = useAnimatedStyle(() => ({ opacity: interpolate(lift.value, [1.2, 1.65], [0, 1], 'clamp') }));
    // Worked out here, not in the worklet: a plain function called there crashes natively.
    const fraction = state ? progressOf(state) : 0;
    const progress = useAnimatedStyle(() => ({ transform: [{ scaleX: withTiming(fraction, GLIDE) }] }), [fraction]);

    if (!state || !scene) return <View style={[StyleSheet.absoluteFill, { backgroundColor: ABYSS.deep }]} />;

    const beats = beatsOf(state);
    const commitAt = beats.findIndex(item => item.kind === 'commit');
    const science = (scene.id === 'domino' && cues.has('CHAIN_REACTION')) || (scene.id === 'foothold' && commitAt >= 0 && state.beat > commitAt)
        ? DISCOVERIES[scene.id] : null;
    const mood = leaving ? 'celebrate' : beat?.kind === 'commit' ? 'think' : beat?.kind === 'begin' ? 'celebrate' : beat?.mood ?? 'idle';

    return (
        <View style={styles.root}>
            <AbyssWorld depth={depth} lift={lift} />
            <Pressable style={StyleSheet.absoluteFill} onPress={tapScreen} accessible={false}>
                <SceneArt scene={scene.id} cues={cues} answers={state.answers} color={color}
                    stepTitle={state.created ? stepOf(state.answers).title : undefined}
                    onDominoesDone={() => dispatch({ type: 'touched' })} />
                <SafeAreaView style={styles.layer} pointerEvents="box-none">
                    <View style={styles.top}>
                        <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}>
                            <Animated.View style={[styles.fill, { backgroundColor: color }, progress]} />
                        </View>
                        <Pressable onPress={skip} hitSlop={8} style={styles.skip} accessibilityRole="button" accessibilityLabel={preview ? 'Close preview' : 'Skip'}>
                            <Text style={styles.quiet}>{preview ? 'Close' : 'Skip'}</Text>
                        </Pressable>
                    </View>

                    <View style={styles.echo} pointerEvents="none" accessible accessibilityRole="image" accessibilityLabel={scene.label}>
                        <EchoLight mood={mood} color={color} speaking={line !== null && !ready} />
                    </View>

                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.bottom} pointerEvents="box-none">
                        {line !== null ? (
                            <Dialogue key={line} text={line} color={ABYSS.light} handle={dialogue} onTyped={() => setTyped(line)} />
                        ) : (
                            <Animated.View entering={FadeIn.duration(DURATION.base)} accessibilityLiveRegion="polite">
                                <Text style={styles.saving}>{saveFailed ? 'That didn’t save.' : 'Setting it in stone…'}</Text>
                            </Animated.View>
                        )}

                        {!leaving && ready ? (
                            <View style={styles.controls} pointerEvents="box-none">
                                {beat?.kind === 'line' ? (
                                    <Animated.View entering={FadeIn.delay(DURATION.base).duration(DURATION.base)} exiting={FadeOut.duration(DURATION.tap)}>
                                        <Pressable onPress={tapScreen} style={styles.next} accessibilityRole="button" accessibilityLabel="Continue">
                                            <AppIcon name="chevron-down" size={18} color={MUTED} />
                                        </Pressable>
                                    </Animated.View>
                                ) : null}
                                {beat?.kind === 'choice' ? (
                                    <ChoiceList key={beatKey} options={beat.options} color={color} onChoose={id => choose(beat.field, id)} />
                                ) : null}
                                {beat?.kind === 'input' ? (
                                    <TextAnswer key={beatKey} placeholder={beat.placeholder} optional={beat.optional} color={color}
                                        autoCapitalize={beat.field === 'name' ? 'words' : 'sentences'}
                                        onAnswer={value => {
                                            if (beat.field === 'name' && value && !preview) saveName(value).catch(() => undefined);
                                            answer(beat.field, value);
                                        }} />
                                ) : null}
                                {beat?.kind === 'action' ? (
                                    <ActionPicker key={beatKey} suggestions={suggestions(state.answers)} color={color}
                                        onPick={(label, own) => answer('action', label, { actionKind: own ? undefined : suggestions(state.answers).find(item => item.label === label)?.kind })} />
                                ) : null}
                                {beat?.kind === 'touch' ? (
                                    <Text style={styles.hint} accessibilityLiveRegion="polite">{beat.label}</Text>
                                ) : null}
                                {beat?.kind === 'commit' && saveFailed ? (
                                    <Pressable onPress={() => { setSaveFailed(false); setAttempt(count => count + 1); }} accessibilityRole="button">
                                        <MatteSurface radius={Radius.pill} level="control" tint={color} style={styles.retry}>
                                            <Text style={[styles.retryText, { color: textOn(color) }]}>Try again</Text>
                                        </MatteSurface>
                                    </Pressable>
                                ) : null}
                                {beat?.kind === 'begin' ? <BeginButton color={color} onPress={begin} /> : null}
                                {science && beat?.kind === 'line' ? (
                                    <Pressable onPress={() => setDiscovery(scene.id)} style={styles.next} accessibilityRole="button">
                                        <Text style={styles.quiet}>Why this works</Text>
                                    </Pressable>
                                ) : null}
                                {state.scene === 0 && onAccount && !preview ? (
                                    <Pressable onPress={onAccount} style={styles.next} accessibilityRole="button">
                                        <Text style={styles.quiet}>I already have an account</Text>
                                    </Pressable>
                                ) : null}
                            </View>
                        ) : null}
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </Pressable>

            {discovery && DISCOVERIES[discovery] ? (
                <Animated.View entering={FadeInDown.duration(DURATION.base).easing(EASE.enter)} exiting={FadeOut.duration(DURATION.exit)} style={styles.discovery}>
                    <MatteSurface radius={Radius.card} level="card" style={styles.card}>
                        <Text style={styles.cardTitle}>{DISCOVERIES[discovery].title}</Text>
                        <Text style={styles.cardBody}>{DISCOVERIES[discovery].body}</Text>
                        <Text style={styles.cardSource}>{DISCOVERIES[discovery].source}</Text>
                        <Pressable onPress={() => setDiscovery(null)} style={styles.next} accessibilityRole="button">
                            <Text style={[styles.quiet, { color }]}>Got it</Text>
                        </Pressable>
                    </MatteSurface>
                </Animated.View>
            ) : null}

            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: ABYSS.light }, flood]} />
        </View>
    );
}

/** After the story, whichever way it ended: forget the saved place. */
export const forgetAscent = clearAscent;

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: ABYSS.deep },
    layer: { flex: 1 },
    top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingTop: Spacing.xs },
    track: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(244,241,232,0.12)' },
    fill: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, transformOrigin: 'left' },
    skip: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
    quiet: { fontFamily: FontFamily.semibold, fontSize: 15, color: MUTED },
    echo: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    bottom: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg, gap: Spacing.lg, minHeight: '34%' },
    controls: { gap: Spacing.sm },
    next: { minHeight: 44, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.md },
    hint: { alignSelf: 'center', fontFamily: FontFamily.medium, fontSize: 15, color: MUTED },
    saving: { fontFamily: FontFamily.semibold, fontSize: 20, lineHeight: 28, color: MUTED },
    retry: { minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
    retryText: { fontFamily: FontFamily.bold, fontSize: 16 },
    discovery: { position: 'absolute', left: Spacing.lg, right: Spacing.lg, bottom: '12%' },
    card: { padding: Spacing.xl, gap: Spacing.sm },
    cardTitle: { fontFamily: FontFamily.bold, fontSize: 19, lineHeight: 25, color: ABYSS.light },
    cardBody: { fontFamily: FontFamily.regular, fontSize: 16, lineHeight: 23, color: 'rgba(244,241,232,0.86)' },
    cardSource: { fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18, color: MUTED },
});
