import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { AnimatedFill, CountUp, ListItem } from '@/components/ui/Motion';
import { useRouter } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { VoidCard } from '@/components/ui/VoidCard';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { GoalProgressChart } from '@/components/Goal/GoalProgressChart';
import { paceLine } from '@/components/Goal/GoalPace';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useGoalsInsights } from '@/hooks/useGoalInsights';
import { dateAt, type GoalInsights, type GoalPoint } from '@/lib/goalInsights';
import { styles } from '@/styles/screens/goals-overview.styles';

/** Each goal's state in two words, and the colour that says it before the words do. */
function verdict(insights: GoalInsights, colors: typeof Colors.light): { label: string; color: string } {
    if (insights.progress >= 100) return { label: 'Done', color: colors.success };
    switch (insights.status) {
        case 'ahead': return { label: 'Ahead', color: colors.success };
        case 'on_pace': return { label: 'On track', color: colors.success };
        case 'behind': return { label: 'Behind', color: colors.error };
        case 'not_started': return { label: 'Not started', color: colors.textTertiary };
        default: return { label: 'No plan yet', color: colors.textTertiary };
    }
}

/**
 * All your goals, readable at a glance on a tired night.
 *
 * The figure and its line say how it is going, with nothing to read on top
 * of them. Each goal is then one row: its name, how far along, its own line,
 * and one quiet line of where it stands and what it needs next.
 */
export default function GoalsOverview() {
    const router = useRouter();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const light = theme === 'light';
    const { primary: accent } = useAccentGradient();
    const { lightFeedback } = useHaptics();
    const { goals, insightsById, overall, overallSeries, loaded } = useGoalsInsights();
    const [scrub, setScrub] = useState<GoalPoint | null>(null);

    const list = goals.map(goal => ({ goal, insights: insightsById[goal.id] })).filter(item => item.insights);
    const weekAgo = overallSeries.length > 7 ? overallSeries[overallSeries.length - 8].actual : 0;
    const week = Math.round(overall - weekAgo);
    const track = light ? 'rgba(15,23,42,0.07)' : 'rgba(255,255,255,0.08)';

    return (
        <SheetScreen title="Goals" align="leading">
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {!loaded ? <ActivityIndicator color={accent} style={{ marginTop: 40 }} /> : goals.length === 0 ? (
                    <VoidCard style={styles.emptyCard}>
                        <Ionicons name="flag-outline" size={32} color={colors.textTertiary} />
                        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No goals yet</Text>
                    </VoidCard>
                ) : (
                    <>
                        <View style={styles.numberRow}>
                            {/* While the finger reads a day the figure follows it exactly; otherwise it counts. */}
                            {scrub
                                ? <Text style={[styles.big, { color: colors.textPrimary }]}>{Math.round(scrub.actual)}%</Text>
                                : <CountUp style={[styles.big, { color: colors.textPrimary }]} value={`${Math.round(overall)}%`} />}
                            <Text style={[styles.bigLabel, { color: colors.textSecondary }]}>
                                {scrub
                                    ? dateAt(scrub.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
                                    : week > 0 ? `done overall · +${week}% this week` : 'done overall'}
                            </Text>
                        </View>

                        {overallSeries.length > 1 ? (
                            <View style={styles.chart}>
                                {/* Just your line here; where you should be is on each goal's own page. */}
                                <GoalProgressChart series={overallSeries} color={accent} onScrub={setScrub} pace={false} height={140} />
                            </View>
                        ) : null}

                        {/* One row per goal. */}
                        <View style={styles.list}>
                            {list.map(({ goal, insights }) => {
                                const color = goal.color || accent;
                                const state = verdict(insights, colors);
                                // What it asks next, only for a goal with a number to reach;
                                // otherwise how long is left.
                                const next = (insights.measure.total > 0 ? paceLine(insights.measure) : null)
                                    ?? (insights.daysLeft !== null ? (insights.daysLeft === 1 ? '1 day left' : `${insights.daysLeft} days left`) : null);
                                return (
                                    <ListItem key={goal.id}><Pressable
                                        key={goal.id}
                                        accessibilityRole="button"
                                        accessibilityLabel={`${goal.name}: ${state.label}, ${insights.progress}% done. ${next ?? ''}`}
                                        onPress={() => { lightFeedback(); router.push({ pathname: '/goal-detail', params: { goalId: goal.id } }); }}
                                    ><VoidCard style={styles.row}>
                                        <View style={styles.rowTop}>
                                            <Text numberOfLines={1} style={[styles.name, { color: colors.textPrimary }]}>{goal.name}</Text>
                                            <CountUp style={[styles.percent, { color: colors.textPrimary }]} value={`${insights.progress}%`} />
                                        </View>
                                        {/* The goal's own line, in its own colour; a bar until it has two days. */}
                                        {insights.series.length > 1 ? (
                                            <View pointerEvents="none" style={styles.miniChart}>
                                                <GoalProgressChart series={insights.series} color={color} compact pace={false} height={48} label={`${goal.name} progress`} />
                                            </View>
                                        ) : (
                                            <View style={[styles.bar, { backgroundColor: track }]}>
                                                <AnimatedFill progress={Math.min(100, insights.progress) / 100} style={[styles.fill, { backgroundColor: color }]} />
                                            </View>
                                        )}
                                        {/* One quiet line: a dot of the state's colour, its word, then what is next. */}
                                        <View style={styles.rowBottom}>
                                            <View style={[styles.dot, { backgroundColor: state.color }]} />
                                            <Text numberOfLines={1} style={styles.status}>
                                                <Text style={{ color: colors.textPrimary }}>{state.label}</Text>
                                                {next ? <Text style={{ color: colors.textTertiary }}>{`  ·  ${next}`}</Text> : null}
                                            </Text>
                                        </View>
                                    </VoidCard></Pressable></ListItem>
                                );
                            })}
                        </View>
                    </>
                )}
            </ScrollView>
        </SheetScreen>
    );
}
