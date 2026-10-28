import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
    FadeInDown, interpolate, runOnJS, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue,
    withDelay, withSequence, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { Overlay } from '@/components/ui/Overlay';
import { AppButton } from '@/components/ui/AppButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { Confetti } from '@/components/ui/Confetti';
import { AnimatedCircle } from '@/components/ui/Motion';
import { TrophyCount } from '@/components/Celebrations/TrophyCount';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { useSounds } from '@/hooks/useSounds';
import { textOn } from '@/theme/tokens';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { CEREMONY, DURATION, EASE, OVERLAY, STAGGER, timingFor } from '@/theme/motion';

export interface GoalReached { name: string; color: string; icon?: string; count?: number }

const SIZE = 132;
const STROKE = 6;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const RAYS = 12;

/**
 * A goal reached: the app's biggest moment, told as a short sequence
 * (docs/motion-system.md §4.1) rather than a card that just appears.
 *
 *   settle  the app dims and stops                     light tap
 *   gather  a ring in the goal's colour draws closed   soft ticks at a quarter, half, three quarters
 *   beat    it closes, flashes, the icon becomes the
 *           trophy and lands, light breaks outward     success, and the level-up sound
 *   reveal  "Goal reached", its name, the line
 *   count   the trophy count rolls up by one
 *   rest    confetti once, and the button
 *   return  it shrinks a little and fades; the app comes back
 *
 * A tap anywhere jumps straight to rest. With Reduce Motion it opens at rest,
 * with the same tap and sound. Every beat's time is in theme/motion.ts.
 */
export function GoalCompleteSequence({ goal, onDone }: { goal: GoalReached; onDone: () => void }) {
    const t = useTokens();
    const reduced = useReducedMotion();
    const { lightFeedback, selectionFeedback, successFeedback } = useHaptics();
    const { playLevelUp } = useSounds();
    const accent = goal.color || t.color.accent;

    // 'run' while the story plays, 'rest' once it has (or was skipped), 'leave' on the way out.
    const [phase, setPhase] = useState<'run' | 'rest' | 'leave'>(reduced ? 'rest' : 'run');
    const [beaten, setBeaten] = useState(reduced);
    const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

    const scrim = useSharedValue(reduced ? 1 : 0);
    const ring = useSharedValue(reduced ? 1 : 0);
    const flash = useSharedValue(0);
    const land = useSharedValue(reduced ? 1 : 0.9);
    const rays = useSharedValue(0);
    const card = useSharedValue(1);

    const beat = useCallback(() => {
        setBeaten(true);
        successFeedback();
        playLevelUp();
    }, [successFeedback, playLevelUp]);

    // The story, once. Every timer is cleared if it is skipped or leaves.
    useEffect(() => {
        if (reduced) {
            successFeedback();
            playLevelUp();
            AccessibilityInfo.announceForAccessibility(`Goal reached: ${goal.name}`);
            return;
        }
        lightFeedback();
        scrim.value = withTiming(1, timingFor(CEREMONY.settle, EASE.enter));
        ring.value = withDelay(CEREMONY.settle, withTiming(1, timingFor(CEREMONY.gather, EASE.move)));
        flash.value = withDelay(CEREMONY.beat, withSequence(withTiming(1, timingFor(DURATION.tap, EASE.enter)), withTiming(0, timingFor(DURATION.emphasis, EASE.exit))));
        land.value = withDelay(CEREMONY.beat, withTiming(1, timingFor(DURATION.reward, EASE.land)));
        rays.value = withDelay(CEREMONY.beat, withTiming(1, timingFor(DURATION.reward, EASE.enter)));
        const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
        const span = CEREMONY.gather;
        at(CEREMONY.settle + span * 0.25, selectionFeedback);
        at(CEREMONY.settle + span * 0.5, selectionFeedback);
        at(CEREMONY.settle + span * 0.75, selectionFeedback);
        at(CEREMONY.beat, beat);
        at(CEREMONY.count + DURATION.reward, () => {
            setPhase(current => (current === 'run' ? 'rest' : current));
            AccessibilityInfo.announceForAccessibility(`Goal reached: ${goal.name}`);
        });
        const own = timers.current;
        return () => own.forEach(clearTimeout);
        // Once, when it opens.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /** A tap anywhere while it plays: straight to the end. */
    const skip = () => {
        if (phase !== 'run') return;
        timers.current.forEach(clearTimeout);
        timers.current = [];
        scrim.value = 1; ring.value = 1; land.value = 1; flash.value = 0; rays.value = 1;
        if (!beaten) beat();
        setPhase('rest');
    };

    /** Back to the app: it shrinks a little and fades, the scrim lifts. */
    const leave = () => {
        if (phase === 'leave') return;
        lightFeedback();
        setPhase('leave');
        card.value = withTiming(0, OVERLAY.out);
        scrim.value = withTiming(0, OVERLAY.out, finished => { if (finished) runOnJS(onDone)(); });
    };

    const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value * 0.86 }));
    const ringProps = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - ring.value) }));
    const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value * 0.5, transform: [{ scale: 1 + flash.value * 0.12 }] }));
    const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: land.value }] }));
    const cardStyle = useAnimatedStyle(() => ({ opacity: card.value, transform: [{ scale: interpolate(card.value, [0, 1], [0.96, 1]) }] }));
    const atRest = phase !== 'run';
    const rise = (order: number) => (atRest && !beaten ? undefined
        : FadeInDown.delay(atRest ? 0 : CEREMONY.reveal - CEREMONY.beat + order * STAGGER.stage).duration(DURATION.base).easing(EASE.enter));

    return (
        <Overlay onRequestClose={leave}>
            <Pressable style={StyleSheet.absoluteFill} onPress={atRest ? undefined : skip} accessible={false}>
                <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.color.background }, scrimStyle]} />
                {beaten && !reduced ? <Confetti colors={[accent, t.color.success, t.color.warning, t.color.textPrimary]} count={36} /> : null}
                <Animated.View style={[styles.centre, cardStyle]} pointerEvents="box-none">
                    <View style={styles.stage}>
                        {/* Light breaking outward on the beat. */}
                        {!reduced ? (
                            <View style={styles.rays} pointerEvents="none">
                                {Array.from({ length: RAYS }, (_, index) => <Ray key={index} index={index} burst={rays} tint={accent} />)}
                            </View>
                        ) : null}
                        <Animated.View pointerEvents="none" style={[styles.flash, { backgroundColor: accent }, flashStyle]} />
                        <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
                            <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={t.color.border} strokeWidth={STROKE} fill="none" />
                            <AnimatedCircle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={accent} strokeWidth={STROKE} fill="none" strokeLinecap="round"
                                strokeDasharray={`${C} ${C}`} animatedProps={ringProps} rotation={-90} origin={`${SIZE / 2}, ${SIZE / 2}`} />
                        </Svg>
                        <Animated.View style={[styles.disc, { backgroundColor: beaten ? accent : t.color.surfaceRaised }, iconStyle]}>
                            <AppIcon name={beaten ? 'trophy' : goal.icon || 'flag'} filled size={46} color={beaten ? textOn(accent) : accent} />
                        </Animated.View>
                    </View>

                    {beaten ? (
                        <View style={styles.copy} accessible accessibilityLabel={`Goal reached: ${goal.name}`}>
                            <Animated.Text entering={rise(0)} style={[styles.kicker, { color: accent }]}>Goal reached</Animated.Text>
                            <Animated.Text entering={rise(1)} numberOfLines={3} style={[styles.title, { color: t.color.textPrimary }]}>{goal.name}</Animated.Text>
                            <Animated.Text entering={rise(2)} style={[styles.line, { color: t.color.textMuted }]}>You set out to do this, and you did it.</Animated.Text>
                            {goal.count ? (
                                <Animated.View entering={rise(3)}>
                                    <TrophyCount count={goal.count} color={accent} delay={atRest ? 0 : CEREMONY.count - CEREMONY.beat} />
                                </Animated.View>
                            ) : null}
                        </View>
                    ) : <Text style={styles.hidden}>{' '}</Text>}

                    {atRest ? (
                        <Animated.View entering={FadeInDown.duration(DURATION.base).easing(EASE.enter)} style={styles.action}>
                            <AppButton label="Take it in" onPress={leave} />
                        </Animated.View>
                    ) : null}
                </Animated.View>
            </Pressable>
        </Overlay>
    );
}

/** One spoke of light, thrown out on the beat and fading as it goes. */
function Ray({ index, burst, tint }: { index: number; burst: SharedValue<number>; tint: string }) {
    const angle = (index / RAYS) * 360;
    const near = -SIZE * 0.42;
    const far = -SIZE * 0.82;
    const style = useAnimatedStyle(() => ({
        opacity: interpolate(burst.value, [0, 0.2, 0.7, 1], [0, 0.9, 0.4, 0], 'clamp'),
        transform: [{ rotate: `${angle}deg` }, { translateY: interpolate(burst.value, [0, 1], [near, far]) }, { scaleY: interpolate(burst.value, [0, 0.5, 1], [0.4, 1, 0.6]) }],
    }));
    return <Animated.View style={[styles.ray, { backgroundColor: tint }, style]} />;
}

const styles = StyleSheet.create({
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxl },
    stage: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xxl },
    rays: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
    ray: { position: 'absolute', width: 3, height: 22, borderRadius: 2 },
    flash: { position: 'absolute', width: SIZE, height: SIZE, borderRadius: SIZE / 2 },
    disc: { width: SIZE - STROKE * 4, height: SIZE - STROKE * 4, borderRadius: (SIZE - STROKE * 4) / 2, alignItems: 'center', justifyContent: 'center' },
    copy: { alignItems: 'center', gap: Spacing.sm },
    kicker: { fontSize: 15, fontFamily: FontFamily.semibold },
    title: { fontSize: 30, lineHeight: 36, fontFamily: FontFamily.bold, textAlign: 'center' },
    line: { fontSize: 15, lineHeight: 21, fontFamily: FontFamily.regular, textAlign: 'center' },
    hidden: { opacity: 0 },
    action: { marginTop: Spacing.xxl, alignSelf: 'stretch' },
});
