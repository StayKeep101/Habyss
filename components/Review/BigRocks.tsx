import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton, SettingsGroup, SettingsRow, Text } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { useTasks } from '@/hooks/useTasks';
import { useGoalsInsights } from '@/hooks/useGoalInsights';
import { useGoalModes } from '@/hooks/useGoalModes';
import { MAX_ROCKS, rockCandidates, spreadOverWeek } from '@/lib/bigRocks';
import { updateTask } from '@/lib/tasks';
import { emit } from '@/lib/appEvents';
import { oopsTitle } from '@/lib/voice';
import { Spacing } from '@/theme/designSystem';

/**
 * The weekly review's planning half: pick up to five of the tasks that move
 * your goals in focus, and they are placed on next week's days, one a day
 * from Monday, before anything else fills them. Then empty the inbox.
 */
export function BigRocks({ nextWeekStart }: { nextWeekStart: string }) {
    const t = useTokens();
    const { selectionFeedback, successFeedback } = useHaptics();
    const tasks = useTasks();
    const { goals } = useGoalsInsights();
    const modes = useGoalModes(useMemo(() => [...goals].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '')).map(goal => goal.id), [goals]));
    const focusGoals = useMemo(() => new Set(Object.keys(modes).filter(id => modes[id] === 'focus')), [modes]);
    const candidates = useMemo(() => rockCandidates(tasks, focusGoals), [tasks, focusGoals]);
    const [picked, setPicked] = useState<string[]>([]);
    const [planned, setPlanned] = useState(0);

    const toggle = (id: string, on: boolean) => {
        selectionFeedback();
        setPicked(current => (on ? [...current, id].slice(0, MAX_ROCKS) : current.filter(item => item !== id)));
    };
    const plan = async () => {
        const days = spreadOverWeek(picked, nextWeekStart);
        try {
            for (const [id, dueDate] of Object.entries(days)) await updateTask(id, { dueDate });
            successFeedback();
            setPlanned(picked.length);
            setPicked([]);
            emit('habit_completion_updated', {});
        } catch {
            Alert.alert(oopsTitle(), 'They were not all planned. Try again.');
        }
    };

    return (
        <View style={styles.section}>
            {candidates.length ? (
                <SettingsGroup title="Next week's big rocks">
                    {candidates.map(task => (
                        <SettingsRow key={task.id} icon="cube" color={task.goalId && focusGoals.has(task.goalId) ? t.color.accent : t.color.textMuted}
                            label={task.title} toggle={picked.includes(task.id)} disabled={!picked.includes(task.id) && picked.length >= MAX_ROCKS}
                            onToggle={on => toggle(task.id, on)} />
                    ))}
                </SettingsGroup>
            ) : null}
            {picked.length ? (
                <AppButton variant="primary" label={`Plan ${picked.length} for next week`} icon="calendar" onPress={() => void plan()} />
            ) : planned ? (
                <Text variant="caption" tone="muted" align="center">{`${planned} planned, one a day from Monday.`}</Text>
            ) : null}
            <SettingsGroup>
                <SettingsRow icon="file-tray" color={t.color.warning} label="Empty the brain dump" onPress={() => router.push('/(root)/brain-dump' as never)} />
            </SettingsGroup>
        </View>
    );
}

const styles = StyleSheet.create({
    section: { gap: Spacing.md },
});
