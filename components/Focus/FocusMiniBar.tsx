import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, ReduceMotion } from 'react-native-reanimated';
import { router } from 'expo-router';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { useTasks } from '@/hooks/useTasks';
import { useNowStep } from '@/hooks/useNowStep';
import { useFocusSession, useFocusTimeLeft } from '@/context/FocusTimeContext';
import { formatClock } from '@/lib/habitMeasurement';
import { useBedtime } from '@/hooks/useBedtime';
import { clockLabel } from '@/lib/dayFlow';
import { openFocusOn } from '@/lib/openFocus';
import { bringBack } from '@/lib/dayMemory';
import { FontFamily } from '@/theme/designSystem';

/**
 * Over the tab bar on every tab, always: what to be doing right now, like a
 * music app's mini player. Focusing: the session (its ring, its clock).
 * Not focusing: what the timeline has now, or next, with its time, and one tap
 * into Focus on it. No pause: time does not pause. Gone only when the day has
 * nothing left.
 */
export function FocusMiniBar({ docked = false, onShown }: {
    /** Inside the dock's row (Roadmap): fills the row's height, with a smaller clock for the narrower room. */
    docked?: boolean;
    /** Says whether there is a bar at all, so the dock only makes room for one that is there. */
    onShown?: (shown: boolean) => void;
} = {}) {
    const focus = useFocusSession();
    const step = useNowStep();
    const session = !!focus.activeHabitId && (focus.isRunning || focus.isPaused);
    const shown = session || !!step;
    useEffect(() => { onShown?.(shown); }, [shown, onShown]);
    if (session) return <SessionBar docked={docked} />;
    if (!step) return null;
    return <StepBar step={step} docked={docked} />;
}

/**
 * The ring moves only when the change shows: half a percent at a time. Moved every second,
 * each move started a fresh glide of the ring, so it was redrawing about a third of every
 * second on every screen, all day, and kept the phone warm.
 */
const ringStep = (progress: number) => Math.round(Math.max(0, Math.min(1, progress)) * 200) / 200;

/** Minutes as a clock: 1:05:00 over an hour, 24:30 under it. */
const clockOf = (minutes: number) => formatClock(Math.max(0, Math.round(minutes * 60)));

function useMinute() {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
    const date = new Date(now);
    return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

function StepBar({ step, docked }: { step: NonNullable<ReturnType<typeof useNowStep>>; docked: boolean }) {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const minute = useMinute();
    const { item } = step;
    const on = item.start <= minute && minute < item.end;
    const ahead = item.start > minute;
    // Missed ones (their time went by unticked) while nothing is on: one tap fits them in from now.
    const missed = !on ? step.missed ?? [] : [];
    // A gap before the next thing: free time, counted down to it, the ring filling across the gap.
    // Nothing left ahead but missed ones: free time too, never an old one shown as next.
    const free = !on && ((ahead && step.freeFrom !== undefined) || (!ahead && missed.length > 0));
    // Past bedtime, free time is sleep time: counted down to waking up, the ring filling across the night.
    const bed = useBedtime();
    const asleep = free && !!bed && bed.asleep(minute);
    const night = bed ? (bed.wake - bed.sleep + 1440) % 1440 || 1440 : 1;
    const toWake = bed ? (bed.wake - minute + 1440) % 1440 : 0;
    const span = Math.max(1, item.end - item.start);
    const gap = free && ahead ? Math.max(1, item.start - step.freeFrom!) : 1;
    const progress = asleep ? Math.min(1, Math.max(0, 1 - toWake / night))
        : on ? (minute - item.start) / span : free && ahead ? Math.min(1, Math.max(0, (minute - step.freeFrom!) / gap)) : 0;
    const title = asleep ? 'Sleep time' : free ? 'Free time' : item.title;
    const fit = missed.length ? `fit in ${missed.length} missed` : null;
    // Docked beside the Roadmap disc the room is narrow: "Until 1:33 PM" says it.
    const when = asleep ? `Until wake up · ${clockLabel(bed!.wake)}` : on ? (docked ? `Until ${clockLabel(item.end)}` : `Now · until ${clockLabel(item.end)}`)
        : free && fit ? (ahead ? `Until ${clockLabel(item.start)} · ${fit}` : `Tap to ${fit}`)
        : free ? `Until ${item.title} · ${clockLabel(item.start)}` : `Next · ${clockLabel(item.start)}`;
    const left = on ? Math.max(1, Math.round(item.end - minute)) : Math.max(0, Math.round(item.start - minute));
    const spoken = asleep ? `Sleep time, until you wake up at ${clockLabel(bed!.wake)}` : on ? `Now: ${item.title}, ${left} minutes left. Focus on it`
        : free && fit ? `Free time${ahead ? `, ${left} minutes until ${item.title} at ${clockLabel(item.start)}` : ''}. ${missed.length} missed: fit them in now`
        : free ? `Free time, ${left} minutes until ${item.title} at ${clockLabel(item.start)}`
        : `Next: ${item.title}, at ${clockLabel(item.start)}. Focus on it`;
    // Free time is free: a tap does nothing, unless missed ones are waiting to be fitted in.
    const acts = !free || missed.length > 0;
    const open = () => {
        if (!acts) return;
        selectionFeedback();
        if (free) { bringBack(missed); return; }
        openFocusOn(item);
    };
    return (
        <Animated.View entering={FadeInDown.duration(240).reduceMotion(ReduceMotion.System)} exiting={FadeOutDown.duration(180).reduceMotion(ReduceMotion.System)} style={docked ? styles.fill : null}>
            <MatteSurface radius={t.radius.full} elevation="floating" style={[styles.bar, docked ? styles.fill : null]}>
                <Pressable onPress={open} disabled={!acts} style={styles.main} accessibilityRole={acts ? 'button' : 'text'}
                    accessibilityLabel={spoken}>
                    <ProgressRing progress={ringStep(progress)} size="sm" />
                    <View style={styles.words}>
                        <Text numberOfLines={1} style={[styles.title, { color: t.color.textPrimary }]}>{title}</Text>
                        <Text numberOfLines={1} style={[styles.meta, { color: t.color.textMuted }]}>{when}</Text>
                    </View>
                    {/* Time left while it is on; time until it starts while it is next. */}
                    {on || ahead || asleep ? <Text style={[styles.clock, docked ? styles.clockDocked : null, { color: t.color.textPrimary }]}>{clockOf(asleep ? toWake : on ? item.end - minute : item.start - minute)}</Text> : null}
                </Pressable>
            </MatteSurface>
        </Animated.View>
    );
}

function SessionBar({ docked }: { docked: boolean }) {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const focus = useFocusSession();
    const left = useFocusTimeLeft();
    const tasks = useTasks();
    const id = focus.activeHabitId!;
    const name = (focus.activeHabitName ?? 'Focus').replace(/ \(Paused\)$/, '');
    // Flow counts up with no end, so its ring stays whole.
    const stopwatch = focus.activeMode === 'flow' || !focus.totalDuration;
    const progress = stopwatch ? 1 : (focus.totalDuration - left) / focus.totalDuration;
    const clock = formatClock(left);
    const open = () => {
        selectionFeedback();
        const kind = tasks.some(task => task.id === id) ? 'task' : 'habit';
        router.push({ pathname: '/(root)/focus', params: { day: '1', kind, id, title: name } } as never);
    };
    return (
        <Animated.View entering={FadeInDown.duration(240).reduceMotion(ReduceMotion.System)} exiting={FadeOutDown.duration(180).reduceMotion(ReduceMotion.System)} style={docked ? styles.fill : null}>
            <MatteSurface radius={t.radius.full} elevation="floating" style={[styles.bar, docked ? styles.fill : null]}>
                <Pressable onPress={open} style={styles.main} accessibilityRole="button"
                    accessibilityLabel={`Focusing on ${name}, ${clock} ${stopwatch ? 'so far' : 'left'}. Open focus`}>
                    <ProgressRing progress={ringStep(progress)} size="sm" />
                    <View style={styles.words}>
                        <Text numberOfLines={1} style={[styles.title, { color: t.color.textPrimary }]}>{name}</Text>
                        <Text numberOfLines={1} style={[styles.meta, { color: t.color.textMuted }]}>Focusing</Text>
                    </View>
                    <Text style={[styles.clock, docked ? styles.clockDocked : null, { color: t.color.textPrimary }]}>{clock}</Text>
                </Pressable>
            </MatteSurface>
        </Animated.View>
    );
}

/** How much room the bar takes over the tab bar, for pages to clear it (hooks/useResponsiveLayout). */
export const NOW_BAR_ROOM = 64;

/** The bar's row (a full touch target) and the room above and below it. */
const ROW = 44;
const PAD = 6;
/** The bar's height, and so the height of the dock's row when the dock gathers around it (GlassDock). */
export const FOCUS_BAR_HEIGHT = ROW + PAD * 2;

const styles = StyleSheet.create({
    bar: { flexDirection: 'row', alignItems: 'center', paddingLeft: 10, paddingRight: 8, paddingVertical: PAD },
    main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: ROW },
    words: { flex: 1 },
    title: { fontSize: 15, fontFamily: FontFamily.semibold },
    meta: { fontSize: 12, fontFamily: FontFamily.medium },
    clock: { fontSize: 20, fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'], paddingRight: 6 },
    clockDocked: { fontSize: 16 },
    fill: { flex: 1 },
});
