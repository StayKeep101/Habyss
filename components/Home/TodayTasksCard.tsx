import React, { useCallback, useEffect, useState } from 'react';
import { DeviceEventEmitter, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { VoidCard } from '@/components/Layout/VoidCard';
import { getTasks, setTaskStatus, todayKey, topTasksForToday, type Task } from '@/lib/tasks';

interface Props {
    /** How many to show. Three is the default, because a longer list is a backlog. */
    limit?: number;
}

const PRIORITY_COLOR: Record<number, string> = { 1: '#EF4444', 2: '#F59E0B', 3: '#64748B' };

const dueLabel = (task: Task, today: string): string | null => {
    const parts: string[] = [];
    if (task.dueDate && task.dueDate < today) parts.push('Overdue');
    if (task.dueTime) parts.push(task.dueTime);
    if (task.estimatedMinutes) {
        parts.push(task.estimatedMinutes < 60 ? `${task.estimatedMinutes} min` : `${task.estimatedMinutes / 60} hr`);
    }
    return parts.length ? parts.join(' · ') : null;
};

/**
 * The few things that actually matter today.
 *
 * Shows only what is overdue, due today or undated, because padding the list
 * with next week's work is how a list like this stops being believed. Renders
 * nothing at all when there is nothing to do, rather than an empty shell.
 */
export const TodayTasksCard: React.FC<Props> = ({ limit = 3 }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary: accent } = useAccentGradient();
    const { lightFeedback, successFeedback } = useHaptics();

    const [tasks, setTasks] = useState<Task[]>([]);
    const [openCount, setOpenCount] = useState(0);
    const [busy, setBusy] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const all = await getTasks();
            const today = todayKey();
            setOpenCount(all.filter(task => task.status === 'open').length);
            setTasks(topTasksForToday(all, today, limit));
        } catch {
            setTasks([]);
        }
    }, [limit]);

    useEffect(() => {
        load();
        const subscription = DeviceEventEmitter.addListener('tasks_changed', load);
        return () => subscription.remove();
    }, [load]);

    const complete = async (task: Task) => {
        if (busy) return;
        setBusy(task.id);
        try {
            await setTaskStatus(task.id, 'done');
            successFeedback();
            await load();
            DeviceEventEmitter.emit('tasks_changed');
        } finally {
            setBusy(null);
        }
    };

    const today = todayKey();
    const remaining = Math.max(0, openCount - tasks.length);

    if (tasks.length === 0) return null;

    return (
        <View style={{ gap: 10 }}>
            <View style={styles.heading}>
                <Text style={[styles.headingText, { color: colors.textSecondary }]}>
                    {tasks.length === 1 ? 'THE ONE THING TODAY' : `TOP ${tasks.length} TODAY`}
                </Text>
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Add a task"
                    onPress={() => { lightFeedback(); DeviceEventEmitter.emit('show_task_form'); }}
                >
                    <Ionicons name="add" size={20} color={accent} />
                </TouchableOpacity>
            </View>

            <VoidCard style={styles.card}>
                {tasks.map((task, index) => {
                    const meta = dueLabel(task, today);
                    const overdue = !!task.dueDate && task.dueDate < today;
                    return (
                        <TouchableOpacity
                            key={task.id}
                            accessibilityRole="button"
                            accessibilityLabel={`${task.title}${meta ? `. ${meta}` : ''}. Tap to edit.`}
                            activeOpacity={0.85}
                            onPress={() => { lightFeedback(); DeviceEventEmitter.emit('show_task_form', { task }); }}
                            style={[styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
                        >
                            <TouchableOpacity
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: false }}
                                accessibilityLabel={`Mark ${task.title} done`}
                                disabled={busy === task.id}
                                onPress={() => complete(task)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                style={styles.check}
                            >
                                <Ionicons
                                    name={busy === task.id ? 'ellipse' : 'ellipse-outline'}
                                    size={24}
                                    color={PRIORITY_COLOR[task.priority] ?? colors.textTertiary}
                                />
                            </TouchableOpacity>

                            <View style={{ flex: 1 }}>
                                <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>{task.title}</Text>
                                {meta ? (
                                    <Text style={[styles.meta, { color: overdue ? '#EF4444' : colors.textTertiary }]}>{meta}</Text>
                                ) : null}
                            </View>

                            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                        </TouchableOpacity>
                    );
                })}
            </VoidCard>

            {remaining > 0 ? (
                <Text style={[styles.remaining, { color: colors.textTertiary }]}>
                    {remaining} more {remaining === 1 ? 'task' : 'tasks'} waiting
                </Text>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headingText: { fontSize: 11, letterSpacing: 1.5, fontFamily: 'Lexend', fontWeight: '700' },
    card: { paddingHorizontal: 4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 12 },
    check: { paddingVertical: 2 },
    title: { fontSize: 15, fontFamily: 'Lexend_500Medium' },
    meta: { fontSize: 12, fontFamily: 'Lexend_400Regular', marginTop: 3 },
    remaining: { fontSize: 12, fontFamily: 'Lexend_400Regular' },
});
