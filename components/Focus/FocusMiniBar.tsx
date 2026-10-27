import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, ReduceMotion } from 'react-native-reanimated';
import { router } from 'expo-router';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { IconButton } from '@/components/ui/IconButton';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { useTasks } from '@/hooks/useTasks';
import { useFocusSession, useFocusTimeLeft } from '@/context/FocusTimeContext';
import { formatClock, formatDuration } from '@/lib/habitMeasurement';
import { FontFamily } from '@/theme/designSystem';

/**
 * The session you left running, on top of the tab bar on every tab, like the
 * mini player of a music app: a ring of how far it has got, what you are
 * focusing on and for how long, the clock, and pause or resume right there.
 * Tapping it goes back to the focus page. Gone when no session is on.
 */
export function FocusMiniBar() {
    const focus = useFocusSession();
    if (!focus.activeHabitId || !(focus.isRunning || focus.isPaused)) return null;
    return <Bar />;
}

function Bar() {
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
    const length = stopwatch ? null : formatDuration(focus.totalDuration, true);
    const clock = formatClock(left);

    const open = () => {
        selectionFeedback();
        const kind = tasks.some(task => task.id === id) ? 'task' : 'habit';
        router.push({ pathname: '/(root)/focus', params: { kind, id, title: name } });
    };
    const pauseOrResume = () => {
        selectionFeedback();
        if (focus.isPaused) focus.resumeTimer(); else focus.pauseTimer();
    };

    return (
        <Animated.View entering={FadeInDown.duration(240).reduceMotion(ReduceMotion.System)} exiting={FadeOutDown.duration(180).reduceMotion(ReduceMotion.System)}>
            <MatteSurface radius={t.radius.full} elevation="floating" style={styles.bar}>
                <Pressable onPress={open} style={styles.main} accessibilityRole="button"
                    accessibilityLabel={`Focusing on ${name}${focus.isPaused ? ', paused' : ''}, ${clock} ${stopwatch ? 'so far' : 'left'}. Open focus`}>
                    <ProgressRing progress={progress} size="sm" />
                    <View style={styles.words}>
                        <Text numberOfLines={1} style={[styles.title, { color: t.color.textMuted }]}>
                            {length ? `${name} · ${length}` : name}
                        </Text>
                        <Text style={[styles.clock, { color: t.color.textPrimary }]}>
                            {focus.isPaused ? `${clock} · Paused` : clock}
                        </Text>
                    </View>
                </Pressable>
                <IconButton icon={focus.isPaused ? 'play' : 'pause'} label={focus.isPaused ? 'Resume focus' : 'Pause focus'} onPress={pauseOrResume} />
            </MatteSurface>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    bar: { flexDirection: 'row', alignItems: 'center', paddingLeft: 10, paddingRight: 6, paddingVertical: 6 },
    main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
    words: { flex: 1 },
    title: { fontSize: 13, fontFamily: FontFamily.medium },
    clock: { fontSize: 20, fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
});
