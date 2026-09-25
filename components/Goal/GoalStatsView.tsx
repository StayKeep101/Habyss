import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { VoidCard } from '@/components/Layout/VoidCard';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { GoalProgressChart } from '@/components/Goal/GoalProgressChart';
import { SectionLabel, WeekDots } from '@/components/Goal/GoalRows';
import { TASK_COLOR } from '@/components/Roadmap/TaskItem';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/DesignSystem';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useGoalInsights } from '@/hooks/useGoalInsights';
import { dateAt, type GoalPoint, type GoalStatus } from '@/lib/goalInsights';

const STATUS_LABEL: Record<GoalStatus, string> = {
    ahead: 'Ahead of pace',
    on_pace: 'On pace',
    behind: 'Behind pace',
    not_started: 'Not started yet',
    empty: 'No habits or tasks yet',
};

/**
 * A goal's numbers, read like a portfolio: one headline figure, how it moved
 * this week, whether it is on pace, then the chart and the few numbers that
 * explain it. Everything below the chart is detail you can ignore.
 */
export const GoalStatsView: React.FC<{ goalId?: string; embedded?: boolean }> = ({ goalId, embedded = false }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary: accent } = useAccentGradient();
    const { goal, insights, loaded } = useGoalInsights(goalId);
    const [scrub, setScrub] = useState<GoalPoint | null>(null);
    const Outer: any = embedded ? View : ScrollView;

    const color = goal?.color || accent;
    const statusColor = (status: GoalStatus) =>
        status === 'ahead' || status === 'on_pace' ? colors.success : status === 'behind' ? colors.error : colors.textTertiary;

    if (!goal || !insights) {
        return (
            <>
                {loaded ? (
                    <Text style={[styles.empty, { color: colors.textSecondary }]}>This goal is no longer here.</Text>
                ) : <ActivityIndicator color={accent} style={{ marginTop: 40 }} />}
            </>
        );
    }

    const shown = scrub?.actual ?? insights.progress;
    const tile = isLight ? '#FFFFFF' : 'rgba(255,255,255,0.05)';
    const { tasks } = insights;
    const openCount = tasks.upcoming.length + tasks.undated.length;

    return (
        <>
            {/* Inside the goal page this is part of that page, so it must not
                be a second scroll view inside the first one. */}
            <Outer {...(embedded
                ? { style: styles.content }
                : { contentContainerStyle: styles.content, showsVerticalScrollIndicator: false, scrollEnabled: !scrub })}>
                <Text numberOfLines={1} style={[styles.goalName, { color: colors.textSecondary }]}>{goal.name}</Text>

                {/* Headline: the number, how it moved, and whether that is enough. */}
                <View style={styles.headline}>
                    <Text style={[styles.bigNumber, { color: colors.textPrimary }]}>{Math.round(shown)}%</Text>
                    {!scrub && insights.status !== 'empty' ? (
                        <View style={[styles.change, { backgroundColor: (insights.change7 > 0 ? colors.success : colors.textTertiary) + '22' }]}>
                            <Ionicons name={insights.change7 > 0 ? 'caret-up' : 'remove'} size={12} color={insights.change7 > 0 ? colors.success : colors.textTertiary} />
                            <Text style={[styles.changeText, { color: insights.change7 > 0 ? colors.success : colors.textTertiary }]}>
                                {insights.change7 === 1 ? '1 pt' : `${insights.change7} pts`} · 7d
                            </Text>
                        </View>
                    ) : null}
                </View>
                {scrub ? (
                    <Text style={[styles.subline, { color: colors.textSecondary }]}>
                        {dateAt(scrub.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · pace {Math.round(scrub.pace)}%
                    </Text>
                ) : (
                    <View style={styles.statusRow}>
                        <View style={[styles.statusDot, { backgroundColor: statusColor(insights.status) }]} />
                        <Text style={[styles.subline, { color: colors.textSecondary }]}>
                            {STATUS_LABEL[insights.status]}
                            {insights.status === 'ahead' || insights.status === 'behind' || insights.status === 'on_pace'
                                ? ` · ${insights.pace}% expected by now` : ''}
                        </Text>
                    </View>
                )}

                <View style={{ height: 18 }} />
                {insights.series.length > 1 ? (
                    <>
                        <GoalProgressChart series={insights.series} color={color} onScrub={setScrub} />
                        <View style={styles.legend}>
                            <View style={[styles.legendLine, { backgroundColor: color }]} />
                            <Text style={[styles.legendText, { color: colors.textTertiary }]}>Done</Text>
                            <View style={[styles.legendLine, styles.legendDashed, { borderColor: colors.textTertiary }]} />
                            <Text style={[styles.legendText, { color: colors.textTertiary }]}>Pace to finish on time</Text>
                        </View>
                    </>
                ) : (
                    <VoidCard style={styles.chartEmpty}>
                        <Text style={[styles.legendText, { color: colors.textTertiary }]}>The chart fills in from the second day of the goal.</Text>
                    </VoidCard>
                )}

                {/* Four numbers that explain the headline. */}
                <View style={styles.tiles}>
                    <Tile label="Habits, 30 days" value={insights.habitRate30 === null ? '—' : `${insights.habitRate30}%`} background={tile} colors={colors} />
                    <Tile label="Tasks done" value={tasks.total ? `${tasks.done}/${tasks.total}` : '—'} background={tile} colors={colors} />
                    <Tile label="Tasks on time" value={tasks.onTime === null ? '—' : `${tasks.onTime}%`} background={tile} colors={colors} />
                    <Tile
                        label={insights.daysLeft === null ? 'End date' : 'Days left'}
                        value={insights.daysLeft === null ? 'Ongoing' : String(insights.daysLeft)}
                        background={tile}
                        colors={colors}
                    />
                </View>

                {insights.habits.length > 0 ? (
                    <>
                        <SectionLabel>Habits</SectionLabel>
                        <VoidCard style={styles.list}>
                            {insights.habits.map((summary, index) => (
                                <View key={summary.habit.id} style={[styles.habitRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                                    <View style={{ flex: 1 }}>
                                        <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.textPrimary }]}>{summary.habit.name}</Text>
                                        <Text style={[styles.rowMeta, { color: colors.textTertiary }]}>
                                            {summary.streak > 0 ? `${summary.streak} in a row` : 'No streak yet'}
                                        </Text>
                                    </View>
                                    <WeekDots marks={summary.last7} color={color} />
                                    <Text style={[styles.rate, { color: colors.textPrimary }]}>{summary.rate30 === null ? '—' : `${summary.rate30}%`}</Text>
                                </View>
                            ))}
                        </VoidCard>
                    </>
                ) : null}

                {tasks.total > 0 ? (
                    <>
                        <SectionLabel>Tasks</SectionLabel>
                        <VoidCard style={styles.list}>
                            {/* One bar, three parts: done, still open, overdue. */}
                            <View style={[styles.bar, { backgroundColor: colors.border }]}>
                                <View style={{ flex: tasks.done, backgroundColor: TASK_COLOR }} />
                                <View style={{ flex: openCount, backgroundColor: TASK_COLOR + '55' }} />
                                <View style={{ flex: tasks.overdue.length, backgroundColor: colors.error }} />
                            </View>
                            <View style={styles.barLegend}>
                                <Legend color={TASK_COLOR} label={`${tasks.done} done`} textColor={colors.textSecondary} />
                                <Legend color={TASK_COLOR + '55'} label={`${openCount} open`} textColor={colors.textSecondary} />
                                <Legend color={colors.error} label={`${tasks.overdue.length} overdue`} textColor={colors.textSecondary} />
                            </View>
                        </VoidCard>
                    </>
                ) : null}
            </Outer>
        </>
    );
}

const Tile: React.FC<{ label: string; value: string; background: string; colors: typeof Colors.light }> = ({ label, value, background, colors }) => (
    <View style={[styles.tile, { backgroundColor: background, borderColor: colors.border }]}>
        <Text style={[styles.tileValue, { color: colors.textPrimary }]}>{value}</Text>
        <Text style={[styles.tileLabel, { color: colors.textTertiary }]}>{label}</Text>
    </View>
);

const Legend: React.FC<{ color: string; label: string; textColor: string }> = ({ color, label, textColor }) => (
    <View style={styles.legendItem}>
        <View style={[styles.legendSwatch, { backgroundColor: color }]} />
        <Text style={[styles.legendText, { color: textColor }]}>{label}</Text>
    </View>
);

const styles = StyleSheet.create({
    content: { paddingHorizontal: 20, paddingBottom: 40 },
    empty: { textAlign: 'center', marginTop: 40, fontFamily: FontFamily.regular },
    goalName: { fontSize: 14, fontFamily: FontFamily.medium, marginTop: 4 },
    headline: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
    bigNumber: { fontSize: 52, fontFamily: FontFamily.bold, letterSpacing: -1.5 },
    change: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
    changeText: { fontSize: 12, fontFamily: FontFamily.semibold },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    subline: { fontSize: 14, fontFamily: FontFamily.regular },
    legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
    legendLine: { width: 16, height: 2.5, borderRadius: 2, marginLeft: 6 },
    legendDashed: { height: 0, borderTopWidth: 1.5, borderStyle: 'dashed', backgroundColor: 'transparent' },
    legendText: { fontSize: 12, fontFamily: FontFamily.regular },
    chartEmpty: { padding: 24, alignItems: 'center' },
    tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 22 },
    tile: { flexBasis: '47%', flexGrow: 1, padding: 14, borderRadius: 16, borderWidth: 1 },
    tileValue: { fontSize: 22, fontFamily: FontFamily.bold },
    tileLabel: { fontSize: 12, fontFamily: FontFamily.regular, marginTop: 4 },
    list: { paddingHorizontal: 16, paddingVertical: 6 },
    habitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    rowTitle: { fontSize: 15, fontFamily: FontFamily.medium },
    rowMeta: { fontSize: 12, fontFamily: FontFamily.regular, marginTop: 2 },
    rate: { width: 44, textAlign: 'right', fontSize: 14, fontFamily: FontFamily.semibold },
    bar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 12 },
    barLegend: { flexDirection: 'row', gap: 14, paddingVertical: 12 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendSwatch: { width: 10, height: 10, borderRadius: 3 },
});
