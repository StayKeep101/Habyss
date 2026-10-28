import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
    FadeIn, FadeOut, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { AppIcon } from '@/components/ui/AppIcon';
import { useHaptics } from '@/hooks/useHaptics';
import { DURATION, EASE, timingFor } from '@/theme/motion';
import { Spacing } from '@/theme/designSystem';
import { IconTile, Text } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { GOALS, type Answers, type Cue } from '@/lib/ascent/story';

const fade = FadeIn.duration(DURATION.reward).easing(EASE.enter);
const out = FadeOut.duration(DURATION.exit);

/**
 * What each scene shows around Echo, driven by the story's cues: the
 * fragments falling past on the way down, the obstacle as a picture, a flame
 * against a path of stones, the dominoes, the goal as a landmark above, the
 * first stone, the others' lights, the path up. Everything is transform and
 * opacity; with Reduce Motion each one simply appears in its final state.
 */
export function SceneArt({ scene, cues, answers, color, stepTitle, onDominoesDone }: {
    scene: string; cues: Set<Cue>; answers: Answers; color: string; stepTitle?: string; onDominoesDone: () => void;
}) {
    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {scene === 'descent' ? <Fragments /> : null}
            {scene === 'mirror' && cues.has('OBSTACLE_REVEAL') && answers.obstacle ? <Obstacle kind={answers.obstacle} color={color} /> : null}
            {scene === 'spark' ? <Spark cues={cues} color={color} /> : null}
            {scene === 'domino' && cues.has('DOMINO_READY') ? <Dominoes color={color} armed={!cues.has('CHAIN_REACTION')} onDone={onDominoesDone} /> : null}
            {(scene === 'turning-point' && cues.has('GOAL_MATERIALIZE')) || ['foothold', 'allies', 'ascent'].includes(scene)
                ? <Landmark icon={GOALS[answers.goal ?? 'own'].icon} color={color} /> : null}
            {(scene === 'foothold' && cues.has('FIRST_STEP_CREATED')) || ['allies', 'ascent'].includes(scene)
                ? <Stone color={color} title={stepTitle} /> : null}
            {scene === 'allies' || scene === 'ascent' ? <Allies color={color} /> : null}
            {scene === 'ascent' ? <Path color={color} /> : null}
        </View>
    );
}

/** Calendars, unticked boxes and clocks, rising past as the camera sinks. */
function Fragments() {
    const { width, height } = useWindowDimensions();
    const pieces = useMemo(() => ['calendar', 'square-outline', 'alarm', 'document-text', 'time', 'checkbox', 'calendar-clear', 'hourglass']
        .map((icon, index) => ({ icon, x: ((index * 37) % 90) / 100 * width + 10, y: height * (0.15 + ((index * 23) % 70) / 100), tilt: (index % 2 ? 1 : -1) * (8 + index * 3) })), [width, height]);
    return <>{pieces.map((piece, index) => <Fragment key={index} {...piece} index={index} />)}</>;
}
function Fragment({ icon, x, y, tilt, index }: { icon: string; x: number; y: number; tilt: number; index: number }) {
    const reduced = useReducedMotion();
    const rise = useSharedValue(0);
    useEffect(() => { if (!reduced) rise.value = withDelay(index * 220, withTiming(1, timingFor(9000, EASE.move))); }, [rise, index, reduced]);
    const style = useAnimatedStyle(() => ({
        opacity: interpolate(rise.value, [0, 0.15, 0.85, 1], [0, 0.32, 0.32, 0]) + (reduced ? 0.3 : 0),
        transform: [{ translateX: x }, { translateY: y - rise.value * 220 }, { rotate: `${tilt + rise.value * 20}deg` }],
    }));
    const t = useTokens();
    return <Animated.View pointerEvents="none" style={[styles.fragment, style]}><AppIcon name={icon} size={28} color={t.color.textMuted} /></Animated.View>;
}

/** The obstacle, as a picture: each of the four has its own. */
function Obstacle({ kind, color }: { kind: NonNullable<Answers['obstacle']>; color: string }) {
    const count = kind === 'distraction' ? 18 : kind === 'overwhelm' ? 14 : kind === 'consistency' ? 6 : 3;
    return (
        <Animated.View entering={fade} exiting={out} style={styles.stage} pointerEvents="none">
            {Array.from({ length: count }, (_, index) => <ObstaclePiece key={index} kind={kind} index={index} count={count} color={color} />)}
        </Animated.View>
    );
}
function ObstaclePiece({ kind, index, count, color }: { kind: NonNullable<Answers['obstacle']>; index: number; count: number; color: string }) {
    const reduced = useReducedMotion();
    const tokens = useTokens();
    const t = useSharedValue(reduced ? 1 : 0);
    useEffect(() => { if (!reduced) t.value = withDelay(index * (kind === 'distraction' ? 30 : 90), withTiming(1, timingFor(1800, EASE.enter))); }, [t, index, kind, reduced]);
    const angle = (index / count) * Math.PI * 2;
    const style = useAnimatedStyle(() => {
        if (kind === 'starting') {
            // The tasks slide away as you come near.
            const dx = (index - 1) * 70;
            return { opacity: 0.8 - t.value * 0.5, transform: [{ translateX: dx + Math.sign(dx || 1) * t.value * 60 }, { translateY: -t.value * 50 }] };
        }
        if (kind === 'consistency') {
            // A staircase rising; two of its steps give way.
            const breaks = index === 2 || index === 4;
            return { opacity: breaks ? 1 - t.value * 0.85 : 0.9, transform: [{ translateX: -100 + index * 40 }, { translateY: 60 - index * 26 + (breaks ? t.value * 90 : 0) }, { rotate: breaks ? `${t.value * 25}deg` : '0deg' }] };
        }
        if (kind === 'distraction') {
            // Lights pulled every which way.
            const reach = 40 + t.value * (90 + (index % 4) * 30);
            return { opacity: 0.9 - t.value * 0.4, transform: [{ translateX: Math.cos(angle) * reach }, { translateY: Math.sin(angle) * reach }] };
        }
        // Overwhelm: a crowd closing in.
        const reach = 220 - t.value * 120;
        return { opacity: 0.25 + t.value * 0.5, transform: [{ translateX: Math.cos(angle) * reach }, { translateY: Math.sin(angle) * reach * 0.8 }, { scale: 0.7 + t.value * 0.5 }] };
    });
    const shape = kind === 'consistency' ? styles.step : kind === 'distraction' ? styles.spark : kind === 'starting' ? styles.card : styles.block;
    return <Animated.View style={[shape, { backgroundColor: kind === 'distraction' ? color : tokens.color.surfaceRaised, borderColor: color }, style]} />;
}

/** A flame that flares and fades, and beside it stones that keep lighting, one by one. */
function Spark({ cues, color }: { cues: Set<Cue>; color: string }) {
    const reduced = useReducedMotion();
    const t = useTokens();
    const flame = useSharedValue(0);
    const flicker = useSharedValue(0);
    const lit = cues.has('FLAME_IGNITE');
    const faded = cues.has('FLAME_FADE');
    useEffect(() => {
        if (faded) flame.value = withTiming(0.12, timingFor(1400, EASE.exit));
        else if (lit) flame.value = withTiming(1, timingFor(700, EASE.land));
    }, [lit, faded, flame]);
    useEffect(() => {
        if (reduced || !lit) return;
        flicker.value = withRepeat(withSequence(withTiming(1, { duration: 140 }), withTiming(0, { duration: 180 })), -1, true);
    }, [lit, flicker, reduced]);
    const outer = useAnimatedStyle(() => ({ opacity: flame.value, transform: [{ scaleY: 0.6 + flame.value * 0.5 + flicker.value * 0.06 }, { scaleX: 0.7 + flame.value * 0.3 }] }));
    const inner = useAnimatedStyle(() => ({ opacity: flame.value, transform: [{ scaleY: 0.5 + flame.value * 0.5 - flicker.value * 0.05 }] }));
    return (
        <View style={styles.stage} pointerEvents="none">
            <View style={styles.flameWrap}>
                {/* The flame is the streak flame's colour, as everywhere in the app. */}
                <Animated.View style={[styles.flame, { backgroundColor: t.color.warning }, outer]} />
                <Animated.View style={[styles.flame, styles.flameInner, { backgroundColor: t.color.textPrimary }, inner]} />
            </View>
            {cues.has('SYSTEM_REVEAL') ? <Stones color={color} /> : null}
        </View>
    );
}
function Stones({ color }: { color: string }) {
    return (
        <Animated.View entering={fade} style={styles.stones}>
            {Array.from({ length: 6 }, (_, index) => <SteadyStone key={index} index={index} color={color} />)}
        </Animated.View>
    );
}
function SteadyStone({ index, color }: { index: number; color: string }) {
    const reduced = useReducedMotion();
    const glow = useSharedValue(reduced ? 1 : 0.2);
    useEffect(() => {
        if (reduced) return;
        // Steady, not flashy: each lights in turn, again and again, at an even pace.
        glow.value = withDelay(index * 380, withRepeat(withSequence(withTiming(1, { duration: 380 }), withTiming(0.35, { duration: 1900 })), -1, false));
    }, [glow, index, reduced]);
    const style = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ translateY: -index * 18 }] }));
    return <Animated.View style={[styles.stone, { backgroundColor: color }, style]} />;
}

/** One small domino; touched, it tips the next, each a little bigger, the last the largest. */
function Dominoes({ color, armed, onDone }: { color: string; armed: boolean; onDone: () => void }) {
    const reduced = useReducedMotion();
    const { selectionFeedback, lightFeedback, mediumFeedback, successFeedback } = useHaptics();
    const [falling, setFalling] = useState(false);
    const SIZES = [14, 20, 28, 40, 56, 80];
    const tip = () => {
        if (falling || !armed) return;
        setFalling(true);
        // The touch is felt, then each fall a little heavier than the last.
        selectionFeedback();
        SIZES.forEach((_, index) => setTimeout(index < 2 ? lightFeedback : index < 5 ? mediumFeedback : successFeedback, (reduced ? 0 : 160 + index * 210)));
        setTimeout(onDone, reduced ? 200 : 160 + SIZES.length * 210 + 500);
    };
    return (
        <Animated.View entering={fade} style={styles.dominoes} pointerEvents="box-none">
            {SIZES.map((size, index) => <Domino key={index} index={index} size={size} color={color} falling={falling} reduced={reduced} />)}
            {armed ? (
                <Pressable onPress={tip} style={styles.dominoTouch} hitSlop={30} accessibilityRole="button" accessibilityLabel="Touch the first domino" />
            ) : null}
        </Animated.View>
    );
}
function Domino({ index, size, color, falling, reduced }: { index: number; size: number; color: string; falling: boolean; reduced: boolean }) {
    const t = useTokens();
    const tilt = useSharedValue(0);
    useEffect(() => {
        if (falling) tilt.value = withDelay(reduced ? 0 : 160 + index * 210, withTiming(1, timingFor(reduced ? 0 : 320, EASE.exit)));
    }, [falling, index, tilt, reduced]);
    const style = useAnimatedStyle(() => ({
        opacity: index === 0 ? 1 : 0.45 + tilt.value * 0.55,
        // Tips forward about its foot.
        transform: [{ translateY: size / 2 }, { rotate: `${tilt.value * 72}deg` }, { translateY: -size / 2 }],
    }));
    return <Animated.View style={[styles.domino, { width: size * 0.42, height: size, borderColor: color, backgroundColor: index === 0 ? color : t.color.surfaceRaised }, style]} />;
}

/** The goal, far above: a light with its mark, appearing where the opening is. */
function Landmark({ icon, color }: { icon: string; color: string }) {
    return (
        <Animated.View entering={FadeIn.duration(1200).easing(EASE.enter)} style={styles.landmark} pointerEvents="none">
            <View style={[styles.landmarkGlow, { backgroundColor: color }]} />
            {/* The goal's own tile, as it looks on every goal card. */}
            <IconTile icon={icon} color={color} size={52} />
        </Animated.View>
    );
}

/** The first step, as a stone of light under Echo, its name on it. */
function Stone({ color, title }: { color: string; title?: string }) {
    const glow = useSharedValue(0);
    useEffect(() => { glow.value = withTiming(1, timingFor(900, EASE.land)); }, [glow]);
    const style = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scaleX: 0.6 + glow.value * 0.4 }] }));
    return (
        <Animated.View style={[styles.firstStone, style]} pointerEvents="none">
            <View style={[styles.firstStoneFace, { backgroundColor: color }]} />
            {title ? <View style={styles.stoneTitle}><Text variant="caption" tone="muted" numberOfLines={1}>{title}</Text></View> : null}
        </Animated.View>
    );
}

/** Other climbers' lights along nearby paths, and threads joining them to yours. */
function Allies({ color }: { color: string }) {
    const { width } = useWindowDimensions();
    const spots = [[-0.32, -40], [0.3, -90], [-0.18, -170], [0.36, -220], [-0.38, -260]];
    return (
        <View style={styles.stage} pointerEvents="none">
            {spots.map(([x, y], index) => <Ally key={index} x={x * width} y={y} index={index} color={color} />)}
        </View>
    );
}
function Ally({ x, y, index, color }: { x: number; y: number; index: number; color: string }) {
    const on = useSharedValue(0);
    useEffect(() => { on.value = withDelay(400 + index * 260, withTiming(1, timingFor(900, EASE.enter))); }, [on, index]);
    const style = useAnimatedStyle(() => ({ opacity: on.value * 0.85, transform: [{ translateX: x }, { translateY: y }, { scale: 0.6 + on.value * 0.4 }] }));
    const thread = useAnimatedStyle(() => ({
        opacity: on.value * 0.18,
        width: Math.hypot(x, y),
        transform: [{ translateX: x / 2 - Math.hypot(x, y) / 2 }, { translateY: y / 2 }, { rotate: `${Math.atan2(y, x)}rad` }],
    }));
    return (
        <>
            <Animated.View style={[styles.thread, { backgroundColor: color }, thread]} />
            <Animated.View style={[styles.ally, { backgroundColor: color }, style]} />
        </>
    );
}

/** The way up: a line of light toward the opening. */
function Path({ color }: { color: string }) {
    const grow = useSharedValue(0);
    useEffect(() => { grow.value = withTiming(1, timingFor(1600, EASE.enter)); }, [grow]);
    const style = useAnimatedStyle(() => ({ opacity: grow.value * 0.5, transform: [{ scaleY: grow.value }] }));
    return <Animated.View style={[styles.path, { backgroundColor: color }, style]} pointerEvents="none" />;
}

const styles = StyleSheet.create({
    stage: { position: 'absolute', top: '38%', left: '50%', width: 0, height: 0, alignItems: 'center', justifyContent: 'center' },
    fragment: { position: 'absolute', top: 0, left: 0 },
    card: { position: 'absolute', width: 64, height: 40, borderRadius: 10, borderWidth: 1 },
    step: { position: 'absolute', width: 44, height: 10, borderRadius: 4, borderWidth: 1 },
    spark: { position: 'absolute', width: 5, height: 5, borderRadius: 3 },
    block: { position: 'absolute', width: 26, height: 26, borderRadius: 7, borderWidth: 1 },
    flameWrap: { position: 'absolute', left: -110, alignItems: 'center', justifyContent: 'flex-end', height: 90 },
    flame: { position: 'absolute', bottom: 0, width: 40, height: 80, borderTopLeftRadius: 40, borderTopRightRadius: 40, borderBottomLeftRadius: 22, borderBottomRightRadius: 22 },
    flameInner: { width: 18, height: 42 },
    stones: { position: 'absolute', left: 50, top: 30, gap: 2 },
    stone: { width: 34, height: 10, borderRadius: 6, marginLeft: 0 },
    dominoes: { position: 'absolute', top: '44%', left: Spacing.xxl, right: Spacing.xxl, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 16, height: 90 },
    domino: { borderRadius: 4, borderWidth: 1 },
    dominoTouch: { position: 'absolute', left: 0, bottom: 0, width: 80, height: 90 },
    landmark: { position: 'absolute', top: '12%', alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
    landmarkGlow: { position: 'absolute', width: 120, height: 120, borderRadius: 60, opacity: 0.18 },
    firstStone: { position: 'absolute', top: '46%', alignSelf: 'center', alignItems: 'center', gap: Spacing.xs },
    firstStoneFace: { width: 120, height: 14, borderRadius: 8, opacity: 0.9 },
    stoneTitle: { maxWidth: 240 },
    ally: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
    thread: { position: 'absolute', height: 1 },
    path: { position: 'absolute', top: '14%', bottom: '58%', alignSelf: 'center', width: 2, borderRadius: 1 },
});
