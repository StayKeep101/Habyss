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
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useClockStyle } from '@/hooks/useClockStyle';
import { useTasks } from '@/hooks/useTasks';
import { useGoalsInsights } from '@/hooks/useGoalInsights';
import { getHabits, type Habit } from '@/lib/habitsSQLite';
import { isHabitScheduledForDate } from '@/lib/habitSchedule';
import { tasksForDay } from '@/lib/tasks';
import { flowDay, flowInputs, lengthLabel, upNext, type FlowInput } from '@/lib/dayFlow';
import { measurementFor } from '@/lib/habitMeasurement';
import { styles } from '@/styles/screens/focus.styles';

type Mode = 'timer' | 'stopwatch';
const DEFAULT_SECONDS = 25 * 60;

/** Rotation is allowed here only; the rest of the app stays upright. Needs a build with the module. */
function orientation(): typeof import('expo-screen-orientation') | null {
    try {
        const { requireOptionalNativeModule } = require('expo-modules-core') as typeof import('expo-modules-core');
        if (!requireOptionalNativeModule('ExpoScreenOrientation')) return null;
        return require('expo-screen-orientation');
    } catch {
        return null;
    }
}

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
    const { id } = useLocalSearchParams<{ id?: string }>();
    // A fresh screen for each thing focused on, so chaining starts clean.
    return <FocusScreen key={id ?? 'focus'} />;
}

function FocusScreen() {
    const { kind, id, title, seconds: given, start: autoStart } = useLocalSearchParams<{ kind?: string; id?: string; title?: string; seconds?: string; start?: string }>();
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

    // A timed habit's default is its own length; anything else, 25 minutes.
    const measure = habit ? measurementFor(habit) : null;
    const habitSeconds = measure?.kind === 'timer' ? Math.round(measure.target * measure.secondsPerUnit) : null;
    // No length to go on (a task nobody sized): the stopwatch, until you say otherwise.
    const unsized = isTask && !given && !(task?.measure === 'time' && task.target) && !Number(task?.estimatedMinutes);
    const [mode, setMode] = useState<Mode>(unsized ? 'stopwatch' : 'timer');
    const [seconds, setSeconds] = useState<number | null>(null);
    const passed = given ? Number(given) : null;
    const planned = seconds ?? (passed && passed > 0 ? passed : null) ?? habitSeconds ?? (task?.measure === 'time' && task.target ? task.target * 60 : DEFAULT_SECONDS);

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
    // With nothing after it, the Done screen closes itself.
    useEffect(() => {
        if (!finished || next) return;
        const close = setTimeout(() => router.back(), 1800);
        return () => clearTimeout(close);
    }, [finished, next]);
    const focusNext = () => {
        if (!next) return;
        mediumFeedback();
        router.replace({ pathname: '/(root)/focus', params: {
            kind: next.kind, id: next.id, title: next.title, start: '1',
            ...(next.minutes > 0 ? { seconds: String(next.minutes * 60) } : {}),
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
        const rotate = orientation();
        void rotate?.unlockAsync().catch(() => undefined);
        return () => { void rotate?.lockAsync(rotate.OrientationLock.PORTRAIT_UP).catch(() => undefined); };
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
        focus.startTimer(id, title ?? habit?.name ?? task?.title ?? 'Focus', mode === 'stopwatch' ? 3600 * 12 : planned, mode === 'stopwatch' ? 'flow' : 'deep_focus');
    };
    // Chained from the last focus: straight in, no setup screen.
    const started = useRef(false);
    useEffect(() => {
        if (autoStart !== '1' || started.current || active || !id) return;
        if (isTask && !task) return; // wait for the task, so its title and length are known
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
                    <Text style={styles.doneSub}>Saved, and counted as done.</Text>
                    {next ? (
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
                </View>
            ) : (
                <View style={styles.setup}>
                    <Text style={styles.setupTitle}>{name}</Text>
                    <ChoiceRow accessibilityLabel="Timer or stopwatch" options={[{ id: 'timer' as Mode, label: 'Timer' }, { id: 'stopwatch' as Mode, label: 'Stopwatch' }]}
                        value={mode} onChange={next => { selectionFeedback(); setMode(next); }} />
                    {mode === 'timer' ? (
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
