import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/ui/IconButton';
import { MorphMenu, type MorphMenuHandle } from '@/components/ui/MorphMenu';
import { AppButton } from '@/components/ui/AppButton';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { DurationWheels } from '@/components/Create/DurationWheels';
import { FocusClock } from '@/components/Focus/FocusClock';
import { useFocusTime } from '@/context/FocusTimeContext';
import { allowAnyOrientation, applyDefaultOrientation } from '@/lib/orientation';
import { useFocusPlan } from '@/hooks/useFocusPlan';
import { useFocusDay } from '@/hooks/useFocusDay';
import { on } from '@/lib/appEvents';
import { FocusBlock, FocusDayDone } from '@/components/Focus/FocusBlock';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useClockStyle } from '@/hooks/useClockStyle';
import { useTasks } from '@/hooks/useTasks';
import { useGoalsInsights } from '@/hooks/useGoalInsights';
import { getHabits, type Habit } from '@/lib/habitsSQLite';
import { isHabitScheduledForDate } from '@/lib/habitSchedule';
import { tasksForDay } from '@/lib/tasks';
import { flowDay, flowInputs, lengthLabel, upNext, type FlowInput } from '@/lib/dayFlow';
import { styles } from '@/styles/screens/focus.styles';

type Mode = 'timer' | 'stopwatch';
const DEFAULT_SECONDS = 25 * 60;

/**
 * Focus mode, for any habit or task.
 *
 * A habit with a time is done by focusing on it: the timer starts at what is
 * left. Anything else can be focused on too, with a timer you set or a
 * stopwatch that runs until you are finished. Full screen and pure black,
 * awake while it runs, on its side if you turn the phone, with app blocking
 * on (where Screen Time is set up).
 *
 * While it runs there is nothing on screen but the clock and a faint ×. Tap
 * anywhere to pause or carry on, like a video. A long press (or the ×) grows
 * the × into a small window: Finished saves the time and counts the habit or
 * task as done; Exit leaves without saving anything. A timer that runs out counts as Finished too.
 *
 * Something with no set length (a task you cannot size) starts on the
 * stopwatch. Once it is finished, the next thing in the day is offered right
 * there: one tap and you are focusing on it, no waiting for its slot.
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
    const { kind, id, title, banked: bankedParam, start: autoStart, day: dayParam } = useLocalSearchParams<{ kind?: string; id?: string; title?: string; banked?: string; start?: string; day?: string }>();
    // Every focus follows the day: when this one is done (its time up, or
    // Next pressed here or on the watch), the next thing starts by itself.
    void dayParam;
    const allDay = true;
    const proceed = useFocusDay();
    const stopped = useRef(false);
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
    // No length to go on (a task nobody sized): the stopwatch, until you say otherwise.
    const [mode, setMode] = useState<Mode>('timer');
    useEffect(() => { if (timesRead && plan.seconds === null) setMode('stopwatch'); }, [timesRead, plan.seconds]);
    const [seconds, setSeconds] = useState<number | null>(null);
    const planned = (plan.fixed ? null : seconds) ?? plan.seconds ?? DEFAULT_SECONDS;

    const mine = focus.activeHabitId === id;
    const active = mine && (focus.isRunning || focus.isPaused);
    // A countdown that runs out is Finished: saved, done, and a moment to see it.
    const [finished, setFinished] = useState(false);
    const leaving = useRef(false);
    const wasActive = useRef(false);
    useEffect(() => {
        if (wasActive.current && !active && !focus.isRunning && !focus.isPaused && !leaving.current) {
            setFinished(true);
            successFeedback();
        }
        wasActive.current = active;
    }, [active, focus.isRunning, focus.isPaused, successFeedback]);
    // What comes next in the day, worked out the moment this one is finished.
    const day = useGoalsInsights();
    const next = useMemo<FlowInput | null>(() => {
        if (!finished || !id) return null;
        const now = new Date();
        const habits = day.habits.filter(item => !item.isGoal && !item.isArchived && !day.skippedToday[item.id] && isHabitScheduledForDate(item, now));
        const flow = flowDay(flowInputs({ habits, tasks: tasksForDay(day.tasks, day.today, day.today), done: day.completions, today: day.today }), now.getHours() * 60 + now.getMinutes());
        return upNext(flow, id);
    }, [finished, id, day.habits, day.tasks, day.completions, day.skippedToday, day.today]);
    // All day: a moment to see it done, then on to the next thing (a meal or an event included).
    useEffect(() => {
        if (!finished || !allDay) return;
        const go = setTimeout(() => { if (!stopped.current) void proceed(id); }, 1200);
        return () => clearTimeout(go);
    }, [finished, allDay, proceed, id]);
    // With nothing after it, the Done screen closes itself.
    useEffect(() => {
        if (!finished || next || allDay) return;
        const close = setTimeout(() => router.back(), 1800);
        return () => clearTimeout(close);
    }, [finished, next]);
    const focusNext = () => {
        if (!next) return;
        mediumFeedback();
        router.replace({ pathname: '/(root)/focus', params: {
            kind: next.kind, id: next.id, title: next.title, start: '1',
        } });
    };

    // Awake while it runs; upright again when leaving.
    useEffect(() => {
        const keep = require('expo-keep-awake') as typeof import('expo-keep-awake');
        if (focus.isRunning && mine) void keep.activateKeepAwakeAsync('habyss-focus').catch(() => undefined);
        else void keep.deactivateKeepAwake('habyss-focus').catch(() => undefined);
        return () => { void keep.deactivateKeepAwake('habyss-focus').catch(() => undefined); };
    }, [focus.isRunning, mine]);
    useEffect(() => {
        // Sideways for the clock here; on leaving, back to the app's rule
        // (upright on a phone, free on an iPad).
        allowAnyOrientation();
        return () => applyDefaultOrientation();
    }, []);

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

    const start = () => {
        if (!id) return;
        if ((focus.isRunning || focus.isPaused) && !mine) {
            Alert.alert('Another focus is running', `Finish “${focus.activeHabitName ?? 'it'}” first.`);
            return;
        }
        mediumFeedback();
        // Fixed length: always the timer, never the stopwatch; nothing to go on: the stopwatch.
        const stopwatch = (mode === 'stopwatch' || plan.seconds === null) && !plan.fixed;
        focus.startTimer(id, title ?? habit?.name ?? task?.title ?? 'Focus', stopwatch ? 3600 * 12 : planned, stopwatch ? 'flow' : 'deep_focus');
    };
    // Chained from the last focus: straight in, no setup screen.
    const started = useRef(false);
    useEffect(() => {
        // Chained, or a fixed length (nothing to choose): straight in.
        if ((autoStart !== '1' && !plan.fixed) || started.current || active || !id) return;
        if (!timesRead) return; // wait for the item and today's timeline, in case it was cut short
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
    const finishNow = () => { leaving.current = true; successFeedback(); focus.finishTimer(); setFinished(true); };
    // Next: counts this one done and moves on to the next thing in the day.
    const nextNow = () => { if (!active) return; mediumFeedback(); finishNow(); };
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

    return (
        <Pressable style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}
            onPress={toggle} onLongPress={active ? askEnd : undefined} delayLongPress={600} accessible={false}>
            <Animated.View style={[styles.top, chromeStyle]}>
                {active ? (
                    <MorphMenu menuRef={endMenu} icon="close" iconColor="#FFFFFF" label="End focus" title="End focus?" titleIcon="timer" diameter={40} items={[
                        { label: 'Finished', icon: 'checkmark-circle', onPress: finishNow },
                        { label: 'Exit without saving', icon: 'close-circle', destructive: true, onPress: exitNow },
                    ]} />
                ) : (
                    <IconButton icon="close" label="Close" onPress={close} diameter={40} size={18} color="#FFFFFF" />
                )}
                <Text numberOfLines={1} style={styles.title}>{name}</Text>
                <View style={{ width: 40 }} />
            </Animated.View>

            {finished ? (
                <View style={styles.center}>
                    <Text style={styles.doneTitle}>Done</Text>
                    <Text style={styles.doneSub}>{allDay ? 'On to the next thing…' : 'Saved, and counted as done.'}</Text>
                    <View style={styles.next}>
                        <AppButton label="Stop here" variant="ghost" onPress={() => { stopped.current = true; close(); }} />
                    </View>
                    {next && !allDay ? (
                        <View style={styles.next}>
                            <Text style={styles.nextLabel}>Up next</Text>
                            <Text numberOfLines={2} style={styles.nextTitle}>{next.title}</Text>
                            <Text style={styles.hint}>{next.minutes > 0 ? lengthLabel(next.minutes) : 'Stopwatch: runs until you finish'}</Text>
                            <AppButton label="Focus on it" icon="timer" onPress={focusNext} />
                            <AppButton label="Not now" variant="ghost" onPress={close} />
                        </View>
                    ) : null}
                </View>
            ) : active ? (
                <View style={styles.center}>
                    <FocusClock seconds={focus.timeLeft} progress={progress} style={clock} accent={primary}
                        label={focus.isPaused ? 'Paused · tap to carry on' : undefined} />
                    {/* Done with it: count it and go to the next thing in the day. */}
                    <View style={styles.next}>
                        <AppButton label="Done · Next" icon="arrow-forward" onPress={nextNow} />
                    </View>
                </View>
            ) : (
                <View style={styles.setup}>
                    <Text style={styles.setupTitle}>{name}</Text>
                    {plan.fixed ? null : (
                        <ChoiceRow accessibilityLabel="Timer or stopwatch" options={[{ id: 'timer' as Mode, label: 'Timer' }, { id: 'stopwatch' as Mode, label: 'Stopwatch' }]}
                            value={mode} onChange={next => { selectionFeedback(); setMode(next); }} />
                    )}
                    {plan.fixed ? null : mode === 'timer' ? (
                        <DurationWheels parts={['hours', 'minutes']} seconds={planned} onChange={value => setSeconds(Math.max(60, value))} />
                    ) : (
                        <Text style={styles.hint}>Runs until you finish, and saves how long it took.</Text>
                    )}
                    <AppButton label="Start focus" onPress={start} />
                    <Text style={styles.hint}>Tap to pause. Hold to finish or exit.</Text>
                    <AppButton label="Your focus time" variant="ghost" onPress={() => router.push('/(root)/focus-stats')} />
                </View>
            )}
        </Pressable>
    );
}
