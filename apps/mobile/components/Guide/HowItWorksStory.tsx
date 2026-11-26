import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing, FadeIn, FadeInUp, ReduceMotion, ZoomIn, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { VoidCard } from '@/components/ui/VoidCard';
import { AppIcon } from '@/components/ui/AppIcon';
import { useTokens } from '@/hooks/useTokens';
import { MARKS } from '@/lib/marks';
import { s, vs } from '@/theme/scale';

/** How long each scene stays before the next; a tap moves on sooner. */
const SCENE_MS = 4200;
const STAGE = vs(170);
const EASE = { easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };

const SCENES = [
    { title: 'Habits and tasks are the steps', body: 'Habits repeat, tasks are done once. Every one you do takes you a step further.' },
    { title: 'Today’s 3', body: 'Tasks are also what you do each day: pick 3 (or 5) and finish them.' },
    { title: 'Marks are your points', body: `Every habit (+${MARKS.complete.habit}) and task (+${MARKS.complete.task}) you finish earns Marks.` },
];

/**
 * How Habyss works, in three short animated scenes: habits and tasks as
 * steps, Today's 3, and Marks flying in for everything finished. Plays on its own; tap to move on.
 */
export function HowItWorksStory({ onFinished }: { onFinished?: () => void }) {
    const t = useTokens();
    const [scene, setScene] = useState(0);
    const last = scene === SCENES.length - 1;
    useEffect(() => {
        if (last) { onFinished?.(); return; }
        const timer = setTimeout(() => setScene(current => current + 1), SCENE_MS);
        return () => clearTimeout(timer);
    }, [scene, last, onFinished]);
    const next = () => setScene(current => (current + 1) % SCENES.length);

    return (
        <Pressable onPress={next} accessibilityRole="button" accessibilityLabel={`${SCENES[scene].title}. ${SCENES[scene].body}`} accessibilityHint="Shows the next part">
            <VoidCard style={[styles.card, { padding: t.space.xl, gap: t.space.md }]}>
                <View key={scene} style={styles.stage}>
                    {scene === 0 ? <StepsScene /> : scene === 1 ? <TodayScene /> : <MarksScene />}
                </View>
                <Animated.View key={`text-${scene}`} entering={FadeInUp.duration(400)} style={{ gap: t.space.xs }}>
                    <Text style={[t.type.title, styles.center, { color: t.color.textPrimary }]}>{SCENES[scene].title}</Text>
                    <Text style={[t.type.bodySmall, styles.center, { color: t.color.textMuted }]}>{SCENES[scene].body}</Text>
                </Animated.View>
                <View style={[styles.dots, { gap: t.space.xs }]}>
                    {SCENES.map((item, index) => (
                        <View key={item.title} style={[styles.dot, index === scene && styles.dotOn, { backgroundColor: index === scene ? t.color.accent : t.color.border }]} />
                    ))}
                </View>
            </VoidCard>
        </Pressable>
    );
}

const STEPS = [
    { icon: 'repeat', label: 'Habit' },
    { icon: 'checkbox', label: 'Task' },
    { icon: 'repeat', label: 'Habit' },
    { icon: 'checkbox', label: 'Task' },
];
const STEP_W = s(52);
const STEP_H = vs(26);

/** Steps rising to the flag, one after another, and a light climbing them. */
function StepsScene() {
    const t = useTokens();
    const climb = useSharedValue(0);
    useEffect(() => {
        climb.value = withDelay(900, withTiming(STEPS.length, { duration: 2200, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System }));
    }, [climb]);
    const light = useAnimatedStyle(() => ({
        transform: [{ translateX: climb.value * STEP_W - STEP_W / 2 }, { translateY: -climb.value * STEP_H }],
        opacity: climb.value > 0 ? 1 : 0,
    }));
    const width = STEP_W * STEPS.length;
    return (
        <View style={styles.centerAll}>
            <View style={{ width: width + STEP_W, height: STEP_H * (STEPS.length + 2) }}>
                {STEPS.map((step, index) => (
                    <Animated.View key={index} entering={FadeInUp.delay(150 + index * 160).duration(350)}
                        style={[styles.step, { left: index * STEP_W, bottom: 0, height: STEP_H * (index + 1), width: STEP_W - s(4), backgroundColor: t.tint('subtle') }]}>
                        <AppIcon name={step.icon} filled size={s(14)} color={t.color.accent} />
                        <Text style={[t.type.caption, { color: t.color.textMuted }]}>{step.label}</Text>
                    </Animated.View>
                ))}
                <Animated.View entering={ZoomIn.delay(800)} style={[styles.topFlag, { left: width, bottom: STEP_H * STEPS.length }]}>
                    <AppIcon name="flag" filled size={s(22)} color={t.color.accent} />
                </Animated.View>
                <Animated.View style={[styles.light, { backgroundColor: t.color.accent, bottom: 0 }, light]} />
            </View>
        </View>
    );
}

/** Three circles ticking full, two quieter ones for those who pick five. */
function TodayScene() {
    const t = useTokens();
    return (
        <View style={[styles.row, styles.centerAll, { gap: t.space.md }]}>
            {Array.from({ length: 5 }, (_, index) => (
                <View key={index} style={[styles.circle, { borderColor: index < 3 ? t.color.accent : t.color.border, opacity: index < 3 ? 1 : 0.5 }]}>
                    {index < 3 ? (
                        <Animated.View entering={ZoomIn.delay(500 + index * 550).duration(380)} style={[styles.fill, { backgroundColor: t.color.accent }]}>
                            <AppIcon name="checkmark" size={s(18)} color={t.color.onAccent} />
                        </Animated.View>
                    ) : null}
                </View>
            ))}
        </View>
    );
}

/** A check pops, orbs fly out of it into the Marks counter, which counts them in. */
function MarksScene() {
    const t = useTokens();
    const [count, setCount] = useState(0);
    useEffect(() => {
        const timers = Array.from({ length: MARKS.complete.habit }, (_, index) =>
            setTimeout(() => setCount(index + 1), 900 + index * 140 + 700));
        return () => timers.forEach(clearTimeout);
    }, []);
    return (
        <View style={[styles.row, styles.centerAll, styles.marks]}>
            <Animated.View entering={ZoomIn.duration(380)} style={[styles.circle, styles.fill, { backgroundColor: t.color.accent }]}>
                <AppIcon name="checkmark" size={s(18)} color={t.color.onAccent} />
            </Animated.View>
            {Array.from({ length: MARKS.complete.habit }, (_, index) => <StoryOrb key={index} index={index} />)}
            <Animated.View entering={FadeIn.delay(300)} style={[styles.counter, { gap: t.space.xs }]}>
                <AppIcon name="diamond" filled size={s(22)} color={t.color.accent} />
                <Text style={[t.type.title, { color: t.color.textPrimary }]}>+{count}</Text>
            </Animated.View>
        </View>
    );
}

const FLY = s(150);
function StoryOrb({ index }: { index: number }) {
    const t = useTokens();
    const p = useSharedValue(0);
    useEffect(() => {
        p.value = withDelay(900 + index * 140, withSequence(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.cubic), reduceMotion: ReduceMotion.System })));
    }, [p, index]);
    const arc = (index % 2 ? 1 : -1) * vs(24 + index * 6);
    const style = useAnimatedStyle(() => ({
        opacity: p.value > 0 && p.value < 1 ? 1 : 0,
        transform: [{ translateX: p.value * FLY }, { translateY: Math.sin(p.value * Math.PI) * arc }, { scale: 1 - p.value * 0.4 }],
    }));
    return <Animated.View style={[styles.orb, { backgroundColor: t.color.accent }, style]} />;
}

const CIRCLE = s(40);
const styles = StyleSheet.create({
    card: { alignItems: 'stretch' },
    stage: { height: STAGE, alignItems: 'center', justifyContent: 'center' },
    centerAll: { alignItems: 'center', justifyContent: 'center' },
    center: { textAlign: 'center' },
    row: { flexDirection: 'row' },
    dots: { flexDirection: 'row', justifyContent: 'center' },
    dot: { width: s(6), height: s(6), borderRadius: s(3) },
    dotOn: { width: s(18) },
    ring: { position: 'absolute', width: s(64), height: s(64), borderRadius: s(32), borderWidth: StyleSheet.hairlineWidth * 3 },
    flag: { width: s(64), height: s(64), borderRadius: s(32), alignItems: 'center', justifyContent: 'center' },
    step: { position: 'absolute', borderTopLeftRadius: s(8), borderTopRightRadius: s(8), alignItems: 'center', justifyContent: 'flex-start', paddingTop: vs(4), gap: vs(2) },
    topFlag: { position: 'absolute', width: STEP_W, alignItems: 'center' },
    light: { position: 'absolute', left: 0, width: s(12), height: s(12), borderRadius: s(6) },
    circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, borderWidth: StyleSheet.hairlineWidth * 3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    fill: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, alignItems: 'center', justifyContent: 'center' },
    marks: { width: FLY + CIRCLE * 2, justifyContent: 'space-between' },
    counter: { flexDirection: 'row', alignItems: 'center' },
    orb: { position: 'absolute', left: CIRCLE / 2 - s(4), width: s(8), height: s(8), borderRadius: s(4) },
});
