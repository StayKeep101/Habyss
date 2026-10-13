import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SheetScreen } from '@/components/Layout/SheetScreen';
import { VoidCard } from '@/components/Layout/VoidCard';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { GoalProgressChart } from '@/components/Goal/GoalProgressChart';
import { paceLine } from '@/components/Goal/GoalPace';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/DesignSystem';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
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
 * The first line answers the only question that matters — are you on track —
 * in plain words. The chart keeps the portfolio line people like, with its two
 * lines named for what they are. Each goal is then one row: its name, on track
 * or behind, how far along, and what it needs next. No percentage points, no
 * seven-day deltas, nothing to decode.
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
    const onTrack = list.filter(item => item.insights.progress >= 100 || item.insights.status === 'ahead' || item.insights.status === 'on_pace').length;
    const weekAgo = overallSeries.length > 7 ? overallSeries[overallSeries.length - 8].actual : 0;
    const week = Math.round(overall - weekAgo);
    const track = light ? 'rgba(15,23,42,0.07)' : 'rgba(255,255,255,0.08)';

    return (
        <SheetScreen title="Goals" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {!loaded ? <ActivityIndicator color={accent} style={{ marginTop: 40 }} /> : goals.length === 0 ? (
                    <VoidCard style={styles.emptyCard}>
                        <Ionicons name="flag-outline" size={32} color={colors.textTertiary} />
                        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No goals yet</Text>
                        <Text style={[styles.emptyBody, { color: colors.textTertiary }]}>Create a goal and it shows up here.</Text>
                    </VoidCard>
                ) : (
                    <>
                        {/* The answer, in words. */}
                        <Text style={[styles.answer, { color: colors.textPrimary }]}>
                            {onTrack === list.length
                                ? (list.length === 1 ? 'Your goal is on track' : `All ${list.length} goals on track`)
                                : `${onTrack} of ${list.length} goals on track`}
                        </Text>
                        <View style={styles.numberRow}>
                            <Text style={[styles.big, { color: colors.textPrimary }]}>{Math.round(scrub?.actual ?? overall)}%</Text>
                            <Text style={[styles.bigLabel, { color: colors.textSecondary }]}>
                                {scrub
                                    ? dateAt(scrub.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
                                    : week > 0 ? `done overall · +${week}% this week` : 'done overall'}
                            </Text>
                        </View>

                        {overallSeries.length > 1 ? (
                            <View style={styles.chart}>
                                <GoalProgressChart series={overallSeries} color={accent} onScrub={setScrub} />
                                <View style={styles.legend}>
                                    <View style={[styles.legendLine, { backgroundColor: accent }]} />
                                    <Text style={[styles.legendText, { color: colors.textSecondary }]}>You</Text>
                                    <View style={[styles.legendLine, styles.legendDashed, { borderColor: colors.textTertiary }]} />
                                    <Text style={[styles.legendText, { color: colors.textSecondary }]}>Where you should be</Text>
                                </View>
                            </View>
                        ) : null}

                        {/* One row per goal. */}
                        <View style={styles.list}>
                            {list.map(({ goal, insights }) => {
                                const color = goal.color || accent;
                                const state = verdict(insights, colors);
                                const next = paceLine(insights.measure)
                                    ?? (insights.daysLeft !== null ? `${insights.daysLeft} days left` : null);
                                return (
                                    <Pressable
                                        key={goal.id}
                                        accessibilityRole="button"
                                        accessibilityLabel={`${goal.name}: ${state.label}, ${insights.progress}% done. ${next ?? ''}`}
                                        onPress={() => { lightFeedback(); router.push({ pathname: '/goal-detail', params: { goalId: goal.id } }); }}
                                        style={[styles.row, { backgroundColor: light ? '#FFFFFF' : 'rgba(255,255,255,0.04)', borderColor: colors.border }]}
                                    >
                                        <View style={styles.rowTop}>
                                            <Text numberOfLines={1} style={[styles.name, { color: colors.textPrimary }]}>{goal.name}</Text>
                                            <Text style={[styles.percent, { color: colors.textPrimary }]}>{insights.progress}%</Text>
                                        </View>
                                        <View style={[styles.bar, { backgroundColor: track }]}>
                                            <View style={[styles.fill, { width: `${Math.min(100, insights.progress)}%`, backgroundColor: color }]} />
                                        </View>
                                        <View style={styles.rowBottom}>
                                            <View style={[styles.pill, { backgroundColor: state.color + '1F' }]}>
                                                <View style={[styles.dot, { backgroundColor: state.color }]} />
                                                <Text style={[styles.pillText, { color: state.color }]}>{state.label}</Text>
                                            </View>
                                            {next ? <Text numberOfLines={1} style={[styles.next, { color: colors.textSecondary }]}>{next}</Text> : null}
                                        </View>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </>
                )}
            </ScrollView>
        </SheetScreen>
    );
}
