import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ShardIcon } from '@/components/ui/ShardIcon';
import { StyleSheet, Text, useWindowDimensions } from 'react-native';
import Animated, {
    Easing, FadeIn, FadeOut, ReduceMotion, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { on } from '@/lib/appEvents';
import { counts } from '@/lib/sharedGate';
import { localDateKey } from '@/lib/habitSchedule';
import { speedLabel } from '@/lib/taskSpeed';
import { textOn } from '@/theme/tokens';
import { DURATION } from '@/theme/motion';
import {
    burstMarks, goalDone, milestoneDone, habitDone, marksRange, measureMarksTarget, onMarksBurst, onOrbLanded, orbLanded, taskEarned, type Burst, type OrbKind, type Point,
} from '@/lib/marksOrbs';
import { Overlay } from '@/components/ui/Overlay';
import { s, vs } from '@/theme/scale';

const ORB = s(10);
/** A flying Shard: big enough for its facets to read mid-flight. */
const SHARD = s(18);
/** How long one orb takes to fly, and the gap between orbs leaving. */
const FLIGHT = 750;
const STAGGER = 45;
const PILL_HEIGHT = vs(34);

// The early tag: how wide it may be (halved, to centre it on the tap), and how far it rises.
const TAG_HALF = s(60);
const TAG_LIFT = vs(40);

interface Flight extends Burst { to: Point; pill: boolean; range: { from: number; to: number } | null }

/**
 * Orbs of light flying to your Marks.
 *
 * Mounted once over the whole app. Finishing a habit sends five, a task ten,
 * a goal a swarm (one per Mark, capped): they burst out of where you tapped,
 * scatter, then curve into the Marks counter one after another, each landing
 * with a tick. Where no counter is on screen (Roadmap), a small Marks pill
 * drops in at the top showing your total, counts it up as they land, then
 * leaves. Where the counter is on the screen but scrolled out of sight
 * (Home, further down), they still fly to it, off the top edge.
 */
export function MarksOrbs() {
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const [flights, setFlights] = useState<Flight[]>([]);

    // What earns Marks, from the events the app already sends.
    useEffect(() => {
        const subs = [
            on('habit_completion_updated', event => {
                if (!event?.habitId || !event.date || event.skipped || event.completed === undefined) return;
                // A shared habit earns nothing until everybody on it is done:
                // orbs only for whoever finishes it last.
                const earned = habitDone(event.habitId, event.date, event.completed);
                if (earned && counts(event.habitId, event.date)) burstMarks(earned);
            }),
            on('task_completed', event => {
                const earned = taskEarned(event.taskId, localDateKey(new Date()), true, event.speed);
                if (earned && counts(event.taskId, localDateKey(new Date()))) burstMarks(earned, null, speedLabel(event.speed));
            }),
            on('task_reopened', event => { taskEarned(event.taskId, localDateKey(new Date()), false); }),
            on('goal_complete', () => { burstMarks(goalDone()); }),
            on('milestones_changed', event => { if (event?.reached) burstMarks(milestoneDone()); }),
        ];
        return () => subs.forEach(sub => sub.remove());
    }, []);

    useEffect(() => onMarksBurst(burst => {
        // Shards leave a beat after the Marks they came with, so the two swarms read apart.
        const delay = 0;
        setTimeout(() => measureMarksTarget(found => {
            // The counter is on this screen: always to it. Scrolled out of
            // sight, they fly up past the top edge where it is.
            const to = found ? { x: found.x, y: Math.min(height, Math.max(found.y, insets.top - ORB)) } : null;
            const pill = !to;
            setFlights(current => [...current, {
                ...burst, pill, to: to ?? { x: width / 2, y: insets.top + PILL_HEIGHT / 2 + vs(6) },
                range: pill && burst.kind === 'marks' ? marksRange(burst.marks) : null,
            }]);
        }, burst.kind), delay);
    }), [width, height, insets.top]);

    const finish = useCallback((id: number) => setFlights(current => current.filter(flight => flight.id !== id)), []);
    const pill = flights.find(flight => flight.pill && flight.kind === 'marks');
    const shardPill = flights.find(flight => flight.pill && flight.kind === 'shards');

    if (!flights.length) return null;
    // Over every page, a sheet or a modal one included (a goal's page, Missed):
    // drawn under them, the orbs were felt but never seen.
    return (
        <Overlay>
            {flights.map(flight => <Swarm key={flight.id} flight={flight} onDone={finish} />)}
            {flights.filter(flight => flight.label).map(flight => <BonusTag key={`tag-${flight.id}`} label={flight.label!} from={flight.from} />)}
            {pill ? <CatchPill key={pill.id} marks={pill.marks} count={pill.count} range={pill.range} top={insets.top + vs(6)} /> : null}
            {shardPill ? <CatchPill key={shardPill.id} kind="shards" marks={shardPill.marks} count={shardPill.count} range={null} top={insets.top + vs(6) + (pill ? PILL_HEIGHT + vs(6) : 0)} /> : null}
        </Overlay>
    );
}

function Swarm({ flight, onDone }: { flight: Flight; onDone: (id: number) => void }) {
    const done = useRef(onDone);
    useEffect(() => { done.current = onDone; }, [onDone]);
    useEffect(() => {
        const timer = setTimeout(() => done.current(flight.id), FLIGHT + flight.count * STAGGER + 400);
        return () => clearTimeout(timer);
    }, [flight.id, flight.count]);
    return (
        <>
            {Array.from({ length: flight.count }, (_, index) => (
                <Orb key={index} kind={flight.kind} index={index} count={flight.count} from={flight.from} to={flight.to} />
            ))}
        </>
    );
}

/** Done early: "Early ×1.5" rises from the tap as the Shards fly, then fades. */
function BonusTag({ label, from }: { label: string; from: Point }) {
    const t = useTokens();
    const rise = useSharedValue(0);
    useEffect(() => {
        rise.value = withSequence(
            withTiming(1, { duration: DURATION.base, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }),
            withDelay(DURATION.emphasis * 2, withTiming(2, { duration: DURATION.exit, reduceMotion: ReduceMotion.System })),
        );
    }, [rise]);
    const style = useAnimatedStyle(() => {
        const v = rise.value;
        return {
            opacity: v <= 1 ? v : 2 - v,
            transform: [{ translateX: from.x - TAG_HALF }, { translateY: from.y - TAG_LIFT * Math.min(v, 1) - TAG_LIFT / 2 }],
        };
    });
    return (
        <Animated.View pointerEvents="none" style={[styles.tagWrap, style]}>
            <MatteSurface radius={t.radius.full} level="control" elevation="floating" tint={t.color.cobalt} style={styles.tag}>
                <Text style={[t.type.caption, { color: textOn(t.color.cobalt) }]}>{label}</Text>
            </MatteSurface>
        </Animated.View>
    );
}

/**
 * One orb: out of the tap in its own direction, a beat, then a curve into
 * the counter, shrinking a little as it arrives.
 */
function Orb({ kind, index, count, from, to }: { kind: OrbKind; index: number; count: number; from: Point; to: Point }) {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const flight = useSharedValue(0);
    const pop = useSharedValue(0);
    // A Shard flies as the Shard itself (ShardIcon), a Mark as a round light.
    const gem = kind === 'shards';
    // Worked out here, never inside the worklet below (a helper call there crashes natively).
    const half = (gem ? SHARD : ORB) / 2;
    // Each orb leaves at its own angle and distance, the same every time for the same index.
    const angle = (index / count) * Math.PI * 2 + (index % 3) * 0.4;
    const reach = s(26) + (index % 4) * s(9);
    const scatter = { x: from.x + Math.cos(angle) * reach, y: from.y + Math.sin(angle) * reach };
    // The curve bends out to one side, so the swarm sweeps rather than marches.
    const bend = { x: (scatter.x + to.x) / 2 + (index % 2 ? 1 : -1) * s(60), y: Math.min(scatter.y, to.y) - vs(30) };

    useEffect(() => {
        const ease = { easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };
        pop.value = withTiming(1, { duration: 220, ...ease });
        flight.value = withDelay(180 + index * STAGGER, withTiming(1, { duration: FLIGHT, easing: Easing.inOut(Easing.cubic), reduceMotion: ReduceMotion.System }, finished => {
            if (finished) runOnJS(landed)();
        }));
        function landed() { orbLanded(kind); if (index % 2 === 0) selectionFeedback(); }
    }, [flight, pop, index, selectionFeedback, kind]);

    const style = useAnimatedStyle(() => {
        const p = flight.value;
        const out = pop.value;
        // Out to the scatter point first, then along a curve to the target.
        const sx = from.x + (scatter.x - from.x) * out;
        const sy = from.y + (scatter.y - from.y) * out;
        const q = 1 - p;
        const x = q * q * sx + 2 * q * p * bend.x + p * p * to.x;
        const y = q * q * sy + 2 * q * p * bend.y + p * p * to.y;
        return {
            opacity: p >= 1 ? 0 : 1,
            transform: [{ translateX: x - half }, { translateY: y - half }, { scale: (0.4 + out * 0.8) * (1 - p * 0.45) }],
        };
    });
    if (gem) {
        return (
            <Animated.View pointerEvents="none" style={[styles.shard, style]}>
                <ShardIcon size={SHARD} />
            </Animated.View>
        );
    }
    return (
        <Animated.View pointerEvents="none" style={[styles.orb, { backgroundColor: t.color.accent, shadowColor: t.color.accent }, style]}>
            <Animated.View style={[styles.core, { backgroundColor: t.color.onAccent }]} />
        </Animated.View>
    );
}

/**
 * Where no Marks counter is on screen: a pill drops in with your total,
 * counts it up by what was just earned as the orbs land, and leaves.
 */
function CatchPill({ marks, count, range, top, kind = 'marks' }: { marks: number; count: number; range: { from: number; to: number } | null; top: number; kind?: OrbKind }) {
    const t = useTokens();
    const [caught, setCaught] = useState(0);
    const bump = useSharedValue(1);
    useEffect(() => {
        return onOrbLanded(() => {
            setCaught(current => Math.min(count, current + 1));
            bump.value = withSequence(withTiming(1.12, { duration: 70 }), withTiming(1, { duration: 140 }));
        }, kind);
    }, [count, bump, kind]);
    const style = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));
    // The orbs are capped; the number reached is the Marks actually earned.
    const added = caught >= count ? marks : Math.round((caught / count) * marks);
    return (
        <Animated.View pointerEvents="none" entering={FadeIn.duration(200)} exiting={FadeOut.duration(300)} style={[styles.pillWrap, { top }]}>
            <Animated.View style={style}>
                <MatteSurface radius={t.radius.full} level="control" elevation="floating" style={styles.pill}>
                    {range ? (
                        <>
                            <Text style={[t.type.heading, styles.figure, { color: t.color.textPrimary }]}>{(range.from + added).toLocaleString()}</Text>
                            <Text style={[t.type.caption, { color: t.color.textMuted }]}>Marks</Text>
                        </>
                    ) : kind === 'shards' ? (
                        <>
                            <ShardIcon size={s(14)} />
                            <Text style={[t.type.heading, styles.figure, { color: t.color.textPrimary }]}>+{added} Shards</Text>
                        </>
                    ) : (
                        <Text style={[t.type.heading, styles.figure, { color: t.color.textPrimary }]}>+{added} Marks</Text>
                    )}
                </MatteSurface>
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    orb: {
        position: 'absolute', left: 0, top: 0, width: ORB, height: ORB, borderRadius: ORB / 2,
        alignItems: 'center', justifyContent: 'center',
        shadowOpacity: 0.9, shadowRadius: ORB, shadowOffset: { width: 0, height: 0 },
    },
    core: { width: ORB / 3, height: ORB / 3, borderRadius: ORB / 6, opacity: 0.8 },
    shard: { position: 'absolute', top: 0, left: 0, width: SHARD, height: SHARD },
    pillWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
    pill: { flexDirection: 'row', alignItems: 'center', gap: s(6), height: PILL_HEIGHT, paddingHorizontal: s(14) },
    figure: { fontVariant: ['tabular-nums'] },
    tagWrap: { position: 'absolute', top: 0, left: 0, width: TAG_HALF * 2, alignItems: 'center' },
    tag: { paddingHorizontal: s(10), paddingVertical: s(4) },
});
