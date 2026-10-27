import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { IconButton } from '@/components/ui/IconButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { MorphMenu, type MorphMenuHandle } from '@/components/ui/MorphMenu';
import { FocusClock } from '@/components/Focus/FocusClock';
import { useFocusTime } from '@/context/FocusTimeContext';
import { useFocusPlan } from '@/hooks/useFocusPlan';
import { useFocusDay } from '@/hooks/useFocusDay';
import { on } from '@/lib/appEvents';
import { FocusBlock, FocusDayDone } from '@/components/Focus/FocusBlock';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useClockStyle } from '@/hooks/useClockStyle';
import { useTasks } from '@/hooks/useTasks';
import { getHabits, type Habit } from '@/lib/habitsSQLite';
import { styles } from '@/styles/screens/focus.styles';

/**
 * Focus mode, for any habit or task. It starts the moment it opens, nothing
 * to choose: a timer for as long as the thing lasts, counted from when it
 * begins on today's timeline (a 5:00–5:30 task opened at 5:10 has 20 minutes
 * left). When the time is up it carries on as a stopwatch, counting the whole
 * time since it began (at 6:00 that task shows 1:00:00), until it is done.
 * Full screen and pure black, awake while it runs, with app blocking on
 * (where Screen Time is set up).
 *
 * While it runs there is nothing on screen but the clock and a faint ×. Tap
 * anywhere to pause or carry on, like a video. A long press (or the ×) grows
 * the × into a small window: Finished saves the time and counts the habit or
 * task as done and closes; Exit leaves without saving anything. Nothing
 * moves on by itself: focus is chosen.
 *
 * Done · Next is the routine: it counts this one done and the next thing in
 * the day takes its place straight away, its clock already running, no
 * closing, no "done" screen in between.
 */
export default function FocusRoute() {
    const { id, kind, day, end, title, from, until, nextKind } = useLocalSearchParams<{
        id?: string; kind?: string; day?: string; end?: string; title?: string; from?: string; until?: string; nextKind?: string;
    }>();
    // Focusing all day: the first step is whatever the timeline has now.
    if (day === '1' && end === '1') return <FocusDayDone />;
    if (day === '1' && !id) return <FocusDayStart />;
    // A meal, an event, or the free time before something at an exact time.
    if (id && (kind === 'meal' || kind === 'event' || kind === 'wait')) {
        return <FocusBlock key={`${kind}:${id}`} kind={kind} id={id} title={title ?? ''} from={Number(from) || 0} until={Number(until) || 0} nextKind={nextKind} />;
    }
    // A fresh screen for each thing focused on, so chaining starts clean.
    return <FocusScreen key={id ?? 'focus'} />;
}

/** Opens the day's first step. */
function FocusDayStart() {
    const proceed = useFocusDay();
    useEffect(() => { void proceed(); }, [proceed]);
    return <View style={styles.screen} />;
}

function FocusScreen() {
    const { kind, id, title, banked: bankedParam, day: dayParam } = useLocalSearchParams<{ kind?: string; id?: string; title?: string; banked?: string; start?: string; day?: string }>();
    void dayParam;
    const proceed = useFocusDay();
    const insets = useSafeAreaInsets();
    const { primary } = useAccentGradient();
    const { selectionFeedback, successFeedback, mediumFeedback } = useHaptics();
    const clock = useClockStyle();
    const focus = useFocusTime();
    const tasks = useTasks();
    const [habit, setHabit] = useState<Habit | null>(null);
    const isTask = kind === 'task';
    const task = useMemo(() => (isTask ? tasks.find(item => item.id === id) : undefined), [isTask, tasks, id]);

    useEffect(() => {
        if (isTask || !id) return;
        void getHabits().then(list => setHabit(list.find(item => item.id === id) ?? null));
    }, [isTask, id]);

    // How long, from the one place that decides it (lib/focusLength.ts): a
    // timed habit or a task measured in time runs exactly its length (its cut
    // length if today's timeline cut it short), less what is already done.
    const plan = useFocusPlan(id, { habit, task }, Number(bankedParam) || 0);
    const timesRead = plan.ready && (isTask ? !!task : !!habit);

    const mine = focus.activeHabitId === id;
    const active = mine && (focus.isRunning || focus.isPaused);
    // Ended somewhere else (the Live Activity, the watch): nothing left to show here.
    const leaving = useRef(false);
    const wasActive = useRef(false);
    useEffect(() => {
        if (wasActive.current && !active && !focus.isRunning && !focus.isPaused && !leaving.current) router.back();
        wasActive.current = active;
    }, [active, focus.isRunning, focus.isPaused]);
    // Awake while it runs.
    useEffect(() => {
        const keep = require('expo-keep-awake') as typeof import('expo-keep-awake');
        if (focus.isRunning && mine) void keep.activateKeepAwakeAsync('habyss-focus').catch(() => undefined);
        else void keep.deactivateKeepAwake('habyss-focus').catch(() => undefined);
        return () => { void keep.deactivateKeepAwake('habyss-focus').catch(() => undefined); };
    }, [focus.isRunning, mine]);

    // The × steps back after a few seconds; a tap brings it back.
    const chrome = useSharedValue(1);
    const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
    const wake = () => {
        chrome.value = withTiming(1, { duration: 200 });
        if (idle.current) clearTimeout(idle.current);
        idle.current = setTimeout(() => { chrome.value = withTiming(0.15, { duration: 800 }); }, 4000);
    };
    useEffect(() => { if (focus.isRunning && mine) wake(); return () => { if (idle.current) clearTimeout(idle.current); }; }, [focus.isRunning, mine]); // eslint-disable-line react-hooks/exhaustive-deps
    const chromeStyle = useAnimatedStyle(() => ({ opacity: chrome.value }));

    /**
     * Starts straight away: a timer for its length, counted from when it began
     * on the timeline (if it has); already past that, the stopwatch. Nothing
     * to time it by at all: the stopwatch from now.
     */
    const start = () => {
        if (!id) return;
        if ((focus.isRunning || focus.isPaused) && !mine) {
            Alert.alert('Another focus is running', `Finish “${focus.activeHabitName ?? 'it'}” first.`);
            close();
            return;
        }
        mediumFeedback();
        const name = title ?? habit?.name ?? task?.title ?? 'Focus';
        if (plan.seconds === null) focus.startTimer(id, name, 3600 * 12, 'flow');
        else focus.startTimer(id, name, plan.seconds, 'deep_focus', plan.since ?? undefined);
    };
    const started = useRef(false);
    useEffect(() => {
        // Opened on a session already running (from the bar over the tab bar,
        // say): that is the one this page shows, so ending it must not start
        // a fresh one here as the page closes.
        if (active) started.current = true;
        if (started.current || leaving.current || !id) return;
        if (!timesRead) return; // wait for the item and today's timeline
        started.current = true;
        start();
    });
    const close = () => router.back();
    // Tap: pause or carry on.
    const toggle = () => {
        wake();
        if (!active) return;
        selectionFeedback();
        if (focus.isPaused) focus.resumeTimer();
        else focus.pauseTimer();
    };
    // Long press or ×: the × grows into the app's own small window — Finished
    // keeps the session and counts the habit or task done; Exit throws it away.
    const endMenu = useRef<MorphMenuHandle>(null);
    const askEnd = () => {
        if (!active) { close(); return; }
        mediumFeedback();
        endMenu.current?.open();
    };
    // Finished: saved, counted done, and the page closes. The timeline shows what is next.
    const finishNow = () => { leaving.current = true; successFeedback(); focus.finishTimer(); close(); };
    // Done · Next: counted done, and the next thing in the day takes over right here.
    const nextNow = () => {
        if (!active) return;
        leaving.current = true;
        successFeedback();
        focus.finishTimer();
        void proceed(id);
    };
    // Next from the wrist does the same.
    const nextRef = useRef(nextNow);
    nextRef.current = nextNow;
    useEffect(() => {
        const sub = on('focus_next', ({ id: from }) => { if (!from || from === id) nextRef.current(); });
        return () => sub.remove();
    }, [id]);
    const exitNow = () => { leaving.current = true; focus.discardTimer(); close(); };

    const name = title ?? habit?.name ?? task?.title ?? 'Focus';
    const stopwatch = focus.activeMode === 'flow';
    const progress = stopwatch || !focus.totalDuration ? null : 1 - focus.timeLeft / focus.totalDuration;

    const overTime = stopwatch && focus.totalDuration < 3600 * 12;
    const eyebrow = focus.isPaused ? 'Paused' : overTime ? 'Over time' : stopwatch ? 'Flow' : 'Focus';
    const endsAt = !stopwatch && !focus.isPaused && focus.timeLeft > 0
        ? new Date(Date.now() + focus.timeLeft * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : null;

    return (
        <Pressable style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}
            onPress={toggle} onLongPress={active ? askEnd : undefined} delayLongPress={600} accessible={false}>
            {/* A glow of your colour at the top, settling into black: the
                screen stays mostly black, which an OLED screen spends nothing on. */}
            <LinearGradient pointerEvents="none" colors={[`${primary}38`, `${primary}0F`, '#00000000']} locations={[0, 0.35, 0.7]} style={styles.glow} />
            <Animated.View style={[styles.top, chromeStyle]}>
                {active ? (
                    <MorphMenu menuRef={endMenu} icon="close" iconColor="#FFFFFF" label="End focus" title="End focus?" titleIcon="timer" items={[
                        { label: 'Finished', icon: 'checkmark-circle', onPress: finishNow },
                        { label: 'Exit without saving', icon: 'close-circle', destructive: true, onPress: exitNow },
                    ]} />
                ) : (
                    <IconButton icon="close" label="Close" onPress={close} size={18} color="#FFFFFF" />
                )}
                <View style={styles.topSpacer} />
            </Animated.View>

            {active ? (
                <View style={styles.center}>
                    <View style={styles.heading}>
                        <Text style={[styles.eyebrow, { color: primary }]}>{eyebrow}</Text>
                        <Text numberOfLines={2} style={styles.name} accessibilityRole="header">{name}</Text>
                    </View>
                    <FocusClock seconds={focus.timeLeft} progress={progress} style={clock} accent={primary} running={!focus.isPaused}
                        label={focus.isPaused ? 'Tap anywhere to carry on' : endsAt ? `Ends at ${endsAt}` : undefined} />
                    <View style={styles.controls}>
                        <Pressable onPress={toggle} style={styles.play} accessibilityRole="button"
                            accessibilityLabel={focus.isPaused ? 'Carry on' : 'Pause'}>
                            <AppIcon name={focus.isPaused ? 'play' : 'pause'} filled size={30} color="#000000" />
                        </Pressable>
                        {/* Done with it: count it and go to the next thing in the day. */}
                        <Pressable onPress={nextNow} style={styles.nextLink} accessibilityRole="button" accessibilityLabel="Done, go to the next thing">
                            <Text style={styles.nextText}>Done · Next</Text>
                            <AppIcon name="arrow-forward" size={16} color="rgba(255,255,255,0.75)" />
                        </Pressable>
                    </View>
                </View>
            ) : null}
        </Pressable>
    );
}
