import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { IconTile } from '@/components/ui/IconTile';
import { CountUp } from '@/components/ui/Motion';
import { VoidCard } from '@/components/ui/VoidCard';
import { GoalProgressChart } from '@/components/Goal/GoalProgressChart';
import { SectionLabel, ValuePill } from '@/components/Goal/GoalRows';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
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
    const { tasks } = insights;
    const statusLine = scrub
        ? `${dateAt(scrub.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · pace ${Math.round(scrub.pace)}%`
        : STATUS_LABEL[insights.status];

    // The few numbers worth a row each, Phantom-style: a name and a pill.
    const rows: { label: string; value: string; tone?: string }[] = [
        { label: 'Habits kept, 30 days', value: insights.habitRate30 === null ? '—' : `${insights.habitRate30}%` },
        { label: 'Tasks done', value: tasks.total ? `${tasks.done}/${tasks.total}` : '—' },
        ...(tasks.overdue.length ? [{ label: 'Tasks overdue', value: String(tasks.overdue.length), tone: colors.error }] : []),
        { label: insights.daysLeft === null ? 'End date' : 'Days left', value: insights.daysLeft === null ? 'Ongoing' : String(insights.daysLeft) },
    ];

    return (
        <>
            {/* Inside the goal page this is part of that page, so it must not
                be a second scroll view inside the first one. */}
            <Outer {...(embedded
                ? { style: styles.content }
                : { contentContainerStyle: styles.content, showsVerticalScrollIndicator: false, scrollEnabled: !scrub })}>

                {/* The same heading every tab of the goal page starts with. */}
                <SectionLabel first>Progress</SectionLabel>
                {/* One number, and one line saying whether it is enough. */}
                <View style={styles.headline}>
                    <CountUp style={[styles.bigNumber, { color: colors.textPrimary }]} value={`${Math.round(shown)}%`} />
                    {!scrub && insights.status !== 'empty' && insights.change7 !== 0 ? (
                        <Text style={[styles.change, { color: insights.change7 > 0 ? colors.success : colors.error }]}>
                            {insights.change7 > 0 ? '▲' : '▼'} {Math.abs(insights.change7)} this week
                        </Text>
                    ) : null}
                </View>
                <View style={styles.statusRow}>
                    {!scrub ? <View style={[styles.statusDot, { backgroundColor: statusColor(insights.status) }]} /> : null}
                    <Text style={[styles.subline, { color: colors.textSecondary }]}>{statusLine}</Text>
                </View>

                <View style={{ height: 18 }} />
                {insights.series.length > 1 ? (
                    <GoalProgressChart series={insights.series} color={color} onScrub={setScrub} />
                ) : (
                    <VoidCard style={styles.chartEmpty}>
                        <Text style={[styles.subline, { color: colors.textTertiary }]}>From day two</Text>
                    </VoidCard>
                )}

                <SectionLabel>Numbers</SectionLabel>
                <VoidCard style={styles.list}>
                    {rows.map(row => (
                        <View key={row.label} style={styles.row}>
                            <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{row.label}</Text>
                            <ValuePill value={row.value} tone={row.tone} />
                        </View>
                    ))}
                </VoidCard>

                {insights.habits.length > 0 ? (
                    <>
                        <SectionLabel>Habits</SectionLabel>
                        <VoidCard style={styles.list}>
                            {insights.habits.map(summary => (
                                <View key={summary.habit.id} style={styles.row}>
                                    {/* The habit's own icon on a tile of its colour. */}
                                    <IconTile icon={summary.habit.icon || 'sparkles-outline'} color={summary.habit.color || color} size={38} shape="square" />
                                    <View style={{ flex: 1 }}>
                                        <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.textPrimary }]}>{summary.habit.name}</Text>
                                        <Text style={[styles.rowMeta, { color: colors.textTertiary }]}>
                                            {summary.streak > 0 ? `${summary.streak} in a row` : 'No streak yet'}
                                        </Text>
                                    </View>
                                    <ValuePill value={summary.rate30 === null ? '—' : `${summary.rate30}%`} />
                                </View>
                            ))}
                        </VoidCard>
                    </>
                ) : null}
            </Outer>
        </>
    );
}

const styles = StyleSheet.create({
    content: { paddingHorizontal: 20, paddingBottom: 40 },
    empty: { textAlign: 'center', marginTop: 40, fontFamily: FontFamily.regular },
    headline: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
    bigNumber: { fontSize: 48, fontFamily: FontFamily.bold, letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
    change: { fontSize: 14, fontFamily: FontFamily.semibold, fontVariant: ['tabular-nums'] },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    subline: { fontSize: 14, fontFamily: FontFamily.regular },
    chartEmpty: { padding: 24, alignItems: 'center' },
    list: { paddingHorizontal: 16, paddingVertical: 6 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    iconTile: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    rowTitle: { flex: 1, fontSize: 15, fontFamily: FontFamily.medium },
    rowMeta: { fontSize: 12, fontFamily: FontFamily.regular, marginTop: 2 },
});
