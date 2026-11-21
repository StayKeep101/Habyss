import { GOALS_ENABLED } from '@/constants/features';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { textOn } from '@/theme/tokens';
import { ListItem } from '@/components/ui/Motion';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { ChipPicker } from '@/components/ui/ChipPicker';
import { router, useLocalSearchParams } from 'expo-router';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useTokens } from '@/hooks/useTokens';
import { useTasks } from '@/hooks/useTasks';
import { VoidCard } from '@/components/ui/VoidCard';
import { getHabits, getGoals, type Habit } from '@/lib/habitsSQLite';
import { describeSchedule } from '@/lib/goalInsights';
import { emit, on } from '@/lib/appEvents';
import { todayKey, type Task } from '@/lib/tasks';
import { useGoalsInsights } from '@/hooks/useGoalInsights';
import { styles } from '@/styles/screens/all-habits.styles';

type Kind = 'habits' | 'tasks' | 'goals';

/** One row, whatever it is: what it is, a line about it, and where it stands. */
interface Row {
    id: string;
    name: string;
    meta: string;
    icon: string;
    color?: string;
    /** Not in use any more: why, said in words and with an icon (never by colour alone). */
    stopped?: { label: string; icon: string };
    open: () => void;
}
interface Section { title: string; rows: Row[]; stopped?: boolean; empty?: string; hint?: string }

/** How it repeats, in the one set of words every screen uses (from its rule, else its days). */
const scheduleOf = (habit: Habit): string => describeSchedule(habit).split(' · ')[0];
const targetOf = (habit: Habit): string =>
    habit.trackingMethod === 'numeric' ? `${habit.goalValue ?? 1} ${habit.unit ?? ''}`.trim() : 'Done or not done';
const dayLabel = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const TITLES: Record<Kind, string> = { habits: 'All habits', tasks: 'All tasks', goals: 'All goals' };
const ARCHIVED = { label: 'Archived', icon: 'archive-outline' };
const ENDED = { label: 'Ended', icon: 'flag-outline' };
const DONE = { label: 'Done', icon: 'checkmark-circle-outline' };
const DROPPED = { label: 'Stopped', icon: 'close-circle-outline' };

/**
 * Every habit, task or goal in one place (`?kind=`; habits when none).
 *
 * The roadmap shows what is on for a day; this shows everything there is, in
 * clear parts, chosen with the chips at the top: what is in use now, and apart
 * from it what has stopped (archived, ended, done or dropped), each saying which.
 */
export default function AllScreen() {
    const t = useTokens();
    const { primary: accent } = useAccentGradient();
    const { lightFeedback } = useHaptics();
    const params = useLocalSearchParams<{ kind?: string }>();
    const kind: Kind = params.kind === 'tasks' || (params.kind === 'goals' && GOALS_ENABLED) ? params.kind : 'habits';
    const tasks = useTasks();
    // Goals come from the one shared list, so "Current" is exactly what the Roadmap shows.
    const { goals: activeGoals, finished } = useGoalsInsights();

    const [habits, setHabits] = useState<Habit[]>([]);
    const [goals, setGoals] = useState<Habit[]>([]);
    const [loading, setLoading] = useState(kind !== 'tasks');
    // Which part is shown: what is in use (first) or what has stopped, chosen at the top.
    const [shown, setShown] = useState(0);

    const load = useCallback(async () => {
        try {
            const [all, goalList] = await Promise.all([getHabits(), getGoals()]);
            setHabits(all.filter(habit => !habit.isGoal));
            setGoals(goalList);
        } catch {
            setHabits([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
        const sub = on('habit_updated', load);
        return () => sub.remove();
    }, [load]);

    const sections = useMemo((): Section[] => {
        const goalNames = Object.fromEntries(goals.map(goal => [goal.id, goal.name]));
        const today = todayKey();
        if (kind === 'tasks') {
            const row = (task: Task, stopped?: Row['stopped']): Row => ({
                id: task.id, name: task.title, icon: 'checkbox-outline', color: undefined, stopped,
                meta: [task.dueDate ? dayLabel(task.dueDate) : 'No date', task.goalId ? goalNames[task.goalId] : null].filter(Boolean).join(' · '),
                open: () => emit('show_task_form', { task }),
            });
            const open = tasks.filter(task => task.status === 'open');
            return [
                { title: 'To do', rows: open.map(task => row(task)), empty: 'Nothing to do.' },
                { title: 'Done', stopped: true, empty: 'Nothing done yet.', rows: tasks.filter(task => task.status === 'done').map(task => row(task, DONE)) },
                { title: 'Stopped', stopped: true, empty: 'Nothing stopped.', hint: 'Dropped before they were done.', rows: tasks.filter(task => task.status === 'cancelled').map(task => row(task, DROPPED)) },
            ];
        }
        if (kind === 'goals') {
            const reached = new Set(finished.map(item => item.goal.id));
            const goalRow = (goal: Habit, stopped?: Row['stopped'], reachedOn?: string): Row => ({
                id: goal.id, name: goal.name, icon: goal.icon ?? 'flag-outline', color: goal.color, stopped,
                meta: [reachedOn ? `Reached ${dayLabel(reachedOn)}` : goal.targetDate ? `By ${dayLabel(goal.targetDate)}` : null,
                    ((count: number) => (count === 1 ? '1 habit' : `${count} habits`))(habits.filter(h => h.goalId === goal.id && !h.isArchived).length)].filter(Boolean).join(' · '),
                open: () => router.push({ pathname: '/goal-detail', params: { goalId: goal.id } }),
            });
            return [
                { title: 'Current', rows: activeGoals.map(goal => goalRow(goal)), empty: 'No goals in progress.' },
                { title: 'Completed', stopped: true, rows: finished.map(item => goalRow(item.goal, DONE, item.on)), empty: 'No goals reached yet.' },
                { title: 'Archived', stopped: true, rows: goals.filter(goal => goal.isArchived && !reached.has(goal.id)).map(goal => goalRow(goal, ARCHIVED)),
                    empty: 'Nothing archived.', hint: 'Not running any more. Open one to bring it back.' },
            ];
        }
        const stoppedOf = (habit: Habit) => habit.isArchived ? ARCHIVED : habit.endDate && habit.endDate < today ? ENDED : undefined;
        const rows = habits.map((habit): Row => ({
            id: habit.id, name: habit.name, icon: habit.icon ?? 'ellipse-outline', color: habit.color,
            stopped: stoppedOf(habit),
            meta: [targetOf(habit), scheduleOf(habit), habit.goalId ? goalNames[habit.goalId] : null].filter(Boolean).join(' · '),
            open: () => router.push({ pathname: '/habit-detail', params: { habitId: habit.id } }),
        }));
        return [
            { title: 'Current', rows: rows.filter(item => !item.stopped), empty: 'No habits running.' },
            { title: 'Archived or ended', stopped: true, rows: rows.filter(item => item.stopped),
                empty: 'Nothing archived.', hint: 'Not running any more. Open one to bring it back.' },
        ];
    }, [kind, habits, goals, tasks, activeGoals, finished]);

    return (
        <SheetScreen title={TITLES[kind]} onBack={() => router.back()}>
            {loading ? (
                <ActivityIndicator color={accent} style={styles.loading} />
            ) : (
                <ScrollView key={shown} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    <ChipPicker accent={accent} value={String(Math.min(shown, sections.length - 1))} onChange={value => setShown(Number(value))}
                        options={sections.map((section, index) => ({ id: String(index), label: `${section.title} · ${section.rows.length}` }))} />
                    {[sections[Math.min(shown, sections.length - 1)]].map(section => (
                        <View key={section.title} style={styles.section}>
                            {section.hint && section.rows.length > 0 ? (
                                <Text style={[styles.hint, { color: t.color.textMuted }]}>{section.hint}</Text>
                            ) : null}
                            {section.rows.length === 0 ? (
                                <Text style={[styles.empty, { color: t.color.textMuted }]}>{section.empty}</Text>
                            ) : section.rows.map(item => {
                                const tint = item.color ?? accent;
                                return (
                                    <ListItem key={item.id}><TouchableOpacity
                                        activeOpacity={0.85}
                                        accessibilityRole="button"
                                        accessibilityLabel={`${item.name}${item.stopped ? `, ${item.stopped.label}` : ''}. ${item.meta}`}
                                        onPress={() => { lightFeedback(); item.open(); }}
                                    >
                                        <VoidCard style={styles.row}>
                                            <View style={[styles.icon, item.stopped
                                                ? { backgroundColor: t.color.surfaceRaised }
                                                : { backgroundColor: tint }]}>
                                                <Ionicons filled={!item.stopped} name={item.icon as never} size={18}
                                                    color={item.stopped ? t.color.textMuted : textOn(tint)} />
                                            </View>
                                            <View style={styles.text}>
                                                <Text style={[styles.name, { color: item.stopped ? t.color.textMuted : t.color.textPrimary }]} numberOfLines={1}>
                                                    {item.name}
                                                </Text>
                                                <Text style={[styles.meta, { color: t.color.textMuted }]} numberOfLines={1}>{item.meta}</Text>
                                            </View>
                                            {item.stopped ? (
                                                <View style={[styles.badge, { backgroundColor: t.color.surfaceRaised }]}>
                                                    <Ionicons name={item.stopped.icon as never} size={12} color={t.color.textMuted} />
                                                    <Text style={[styles.badgeText, { color: t.color.textMuted }]}>{item.stopped.label}</Text>
                                                </View>
                                            ) : (
                                                <Ionicons name="chevron-forward" size={16} color={t.color.textMuted} />
                                            )}
                                        </VoidCard>
                                    </TouchableOpacity></ListItem>
                                );
                            })}
                        </View>
                    ))}
                </ScrollView>
            )}
        </SheetScreen>
    );
}
