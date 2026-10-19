import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/ui/IconButton';
import { AppButton } from '@/components/ui/AppButton';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { DurationWheels } from '@/components/Create/DurationWheels';
import { FocusClock } from '@/components/Focus/FocusClock';
import { useFocusTime } from '@/context/FocusTimeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useClockStyle } from '@/hooks/useClockStyle';
import { useTasks } from '@/hooks/useTasks';
import { getHabits, type Habit } from '@/lib/habitsSQLite';
import { measurementFor } from '@/lib/habitMeasurement';
import { setTaskStatus } from '@/lib/tasks';
import { emit } from '@/lib/appEvents';
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
 * on (where Screen Time is set up). Leaving pauses it. At the end, a habit's
 * time is saved to it, and a task asks whether it is done.
 */
export default function FocusScreen() {
    const { kind, id, title, seconds: given } = useLocalSearchParams<{ kind?: string; id?: string; title?: string; seconds?: string }>();
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
    const [mode, setMode] = useState<Mode>('timer');
    const [seconds, setSeconds] = useState<number | null>(null);
    const passed = given ? Number(given) : null;
    const planned = seconds ?? (passed && passed > 0 ? passed : null) ?? habitSeconds ?? (task?.measure === 'time' && task.target ? task.target * 60 : DEFAULT_SECONDS);

    const mine = focus.activeHabitId === id;
    const active = mine && (focus.isRunning || focus.isPaused);
    const [finished, setFinished] = useState(false);
    const wasActive = useRef(false);
    useEffect(() => {
        if (wasActive.current && !active && !focus.isRunning && !focus.isPaused) { setFinished(true); successFeedback(); }
        wasActive.current = active;
    }, [active, focus.isRunning, focus.isPaused, successFeedback]);

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

    // The controls step back after a few seconds; a tap brings them back.
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
    // Leaving pauses whatever was running.
    const leave = () => {
        if (mine && focus.isRunning) focus.pauseTimer();
        router.back();
    };

    const name = title ?? habit?.name ?? task?.title ?? 'Focus';
    const stopwatch = focus.activeMode === 'flow';
    const progress = stopwatch || !focus.totalDuration ? null : 1 - focus.timeLeft / focus.totalDuration;

    return (
        <Pressable style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]} onPress={wake} accessible={false}>
            <Animated.View style={[styles.top, chromeStyle]}>
                <IconButton icon="close" label={active ? 'Pause and leave' : 'Close'} onPress={leave} diameter={40} size={18} color="#FFFFFF" />
                <Text numberOfLines={1} style={styles.title}>{name}</Text>
                <View style={{ width: 40 }} />
            </Animated.View>

            {finished ? (
                <View style={styles.center}>
                    <Text style={styles.doneTitle}>Session done</Text>
                    <Text style={styles.doneSub}>{isTask ? 'Is the task finished?' : 'Your time is saved to the habit.'}</Text>
                    <View style={styles.doneActions}>
                        {isTask && task && task.status !== 'done' ? (
                            <AppButton label="Mark it done" onPress={() => { void setTaskStatus(task.id, 'done').then(() => emit('tasks_changed')); successFeedback(); router.back(); }} />
                        ) : null}
                        <AppButton label={isTask ? 'Not yet' : 'Close'} variant="ghost" onPress={() => router.back()} />
                    </View>
                </View>
            ) : active ? (
                <>
                    <View style={styles.center}>
                        <FocusClock seconds={focus.timeLeft} progress={progress} style={clock} accent={primary}
                            label={focus.isPaused ? 'Paused' : stopwatch ? 'Stopwatch' : undefined} />
                    </View>
                    <Animated.View style={[styles.controls, chromeStyle]}>
                        <AppButton label={focus.isPaused ? 'Resume' : 'Pause'} style={styles.flex}
                            onPress={() => { selectionFeedback(); wake(); if (focus.isPaused) focus.resumeTimer(); else focus.pauseTimer(); }} />
                        <AppButton label={stopwatch ? 'Finish' : 'End'} variant="ghost" style={styles.flex}
                            onPress={() => { mediumFeedback(); focus.stopTimer(); }} />
                    </Animated.View>
                </>
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
                    <Text style={styles.hint}>Leaving pauses it. Turn your phone on its side for a bigger clock.</Text>
                </View>
            )}
        </Pressable>
    );
}
