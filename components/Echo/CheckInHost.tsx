import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton, Echo, Text, VoidSheet } from '@/components/ui';
import { useHaptics } from '@/hooks/useHaptics';
import { emit, on } from '@/lib/appEvents';
import { answer, loadCheckIns, type CheckInKind } from '@/lib/checkIns';
import { respondToCheckIn, type CheckInAction, type CheckInResponse } from '@/lib/checkInResponse';
import { Spacing } from '@/theme/designSystem';
import { CheckInPopup } from './CheckInPopup';

/** What the answer means for today: read from what the app already holds. */
async function responseTo(kind: CheckInKind, value: 1 | 2 | 3 | 4 | 5): Promise<CheckInResponse> {
    const { getData } = require('@/lib/dataStore') as typeof import('@/lib/dataStore');
    const { getHabits } = require('@/lib/habitsSQLite') as typeof import('@/lib/habitsSQLite');
    const { isHabitScheduledForDate } = require('@/lib/habitSchedule') as typeof import('@/lib/habitSchedule');
    const data = getData();
    const today = data.today;
    const habits = (await getHabits().catch(() => [])).filter(habit => !habit.isGoal && !habit.isArchived);
    const doneToday = new Set([...(data.history[today] ?? []), ...(data.skips[today] ?? [])]);
    const habitsLeft = habits
        .filter(habit => isHabitScheduledForDate(habit, new Date(`${today}T12:00:00`)) && !doneToday.has(habit.id))
        .sort((a, b) => (a.durationMinutes ?? 30) - (b.durationMinutes ?? 30))
        .map(habit => ({ id: habit.id, name: habit.name }));
    // The habit your mood is better on, if your record shows one (lib/echoPatterns.ts).
    let moodHabit: { id: string; name: string } | null = null;
    if (kind === 'mood') {
        try {
            const { findPatterns } = require('@/lib/echoPatterns') as typeof import('@/lib/echoPatterns');
            const { toHistoryDays } = require('@/hooks/useEchoCoach') as typeof import('@/hooks/useEchoCoach');
            const checkIns = (await loadCheckIns()).entries;
            const found = findPatterns({ habits, history: toHistoryDays(data.history, data.skips), tasks: data.tasks, sleep: {}, checkIns, focus: [], ticks: [], today })
                .find(pattern => pattern.kind === 'mood_habit');
            const id = found?.id.split(':')[1];
            const habit = habits.find(item => item.id === id);
            if (habit) moodHabit = { id: habit.id, name: habit.name };
        } catch { /* no pattern: the smallest win instead */ }
    }
    return respondToCheckIn({ kind, value, tasks: data.tasks, habitsLeft, moodHabit, today });
}

/**
 * Echo's one-tap question, asked when you ask for it: the + on Home (mood,
 * energy). Mounted once over the app, so it works from any tab.
 *
 * The answer does something (lib/checkInResponse.ts): Echo replies with what
 * it means for today and one tap to act on it. Low energy moves the hardest
 * task to tomorrow; high energy starts focus on it; a low mood offers the
 * habit that lifts yours; a good one, the task you keep putting off.
 */
export function CheckInHost() {
    const { successFeedback } = useHaptics();
    const [kind, setKind] = useState<CheckInKind | null>(null);
    const [reply, setReply] = useState<CheckInResponse | null>(null);
    useEffect(() => {
        const sub = on('show_check_in', ({ kind: asked }) => setKind(asked));
        return () => sub.remove();
    }, []);

    const act = async (action: CheckInAction) => {
        setReply(null);
        if (action.kind === 'move_tomorrow') {
            const { updateTask } = require('@/lib/tasks') as typeof import('@/lib/tasks');
            const { getData } = require('@/lib/dataStore') as typeof import('@/lib/dataStore');
            const tomorrow = new Date(`${getData().today}T12:00:00`);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const { localDateKey } = require('@/lib/habitSchedule') as typeof import('@/lib/habitSchedule');
            await updateTask(action.taskId, { dueDate: localDateKey(tomorrow) }).catch(() => undefined);
            emit('tasks_changed');
            successFeedback();
        } else if (action.kind === 'focus') {
            router.navigate({ pathname: '/(root)/focus', params: { day: '1', kind: action.item, id: action.id, title: action.title, ...(action.minutes ? { minutes: String(action.minutes) } : {}) } });
        } else if (action.kind === 'open_habit') {
            router.navigate({ pathname: '/habit-detail', params: { habitId: action.id } });
        }
    };

    return (
        <>
            <CheckInPopup kind={kind} onClose={() => setKind(null)}
                onAnswer={(asked, value) => {
                    void answer(asked, value);
                    setKind(null);
                    successFeedback();
                    void responseTo(asked, value).then(setReply).catch(() => undefined);
                }} />
            <VoidSheet visible={!!reply} onClose={() => setReply(null)} title="Echo"
                footer={reply ? (
                    <View style={styles.footer}>
                        {reply.actions.map((action, index) => (
                            <AppButton key={action.label} label={action.label} variant={index === 0 && action.kind !== 'done' ? 'primary' : 'ghost'}
                                onPress={() => void act(action)} />
                        ))}
                    </View>
                ) : null}>
                <View style={styles.body}>
                    <View style={styles.echo}><Echo size="small" mood="idle" speaking /></View>
                    <Text variant="body" grow>{reply?.line ?? ''}</Text>
                </View>
            </VoidSheet>
        </>
    );
}

const styles = StyleSheet.create({
    body: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md },
    echo: { width: Spacing.section, height: Spacing.section, alignItems: 'center', justifyContent: 'center' },
    footer: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, gap: Spacing.sm },
});
