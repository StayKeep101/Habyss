import React, { useState } from 'react';
import Animated, { Easing, FadeIn, LinearTransition } from 'react-native-reanimated';

/** Timed, never sprung: a card growing a chart should not bounce. */
const MORPH = LinearTransition.duration(240).easing(Easing.out(Easing.cubic));
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SheetScreen } from '@/components/Layout/SheetScreen';
import { VoidCard } from '@/components/Layout/VoidCard';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { GoalProgressChart } from '@/components/Goal/GoalProgressChart';
import { SectionLabel } from '@/components/Goal/GoalRows';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/DesignSystem';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useGoalsInsights } from '@/hooks/useGoalInsights';
import { dateAt, type GoalPoint, type GoalStatus } from '@/lib/goalInsights';

const STATUS_LABEL: Record<GoalStatus, string> = {
    ahead: 'Ahead',
    on_pace: 'On pace',
    behind: 'Behind',
    not_started: 'Not started',
    empty: 'Nothing planned',
};

/**
 * Every goal's progress, read like a portfolio: the combined number and line
 * first, then each goal as a holding with its own figure, weekly move, pace
 * and sparkline. Tapping a goal opens its full stats.
 */
export default function GoalsOverview() {
    const router = useRouter();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary: accent } = useAccentGradient();
    const { lightFeedback } = useHaptics();
    const { goals, insightsById, overall, overallSeries, loaded } = useGoalsInsights();
    const [scrub, setScrub] = useState<GoalPoint | null>(null);
    // Tapping a goal opens its chart here rather than pushing a screen: the
    // question "how is this one going" is answered by the line, and a screen
    // that has to be navigated back out of is a poor way to ask it repeatedly.
    const [openGoal, setOpenGoal] = useState<string | null>(null);
    const [goalScrub, setGoalScrub] = useState<GoalPoint | null>(null);

    const statusColor = (status: GoalStatus) =>
        status === 'ahead' || status === 'on_pace' ? colors.success : status === 'behind' ? colors.error : colors.textTertiary;

    const list = goals.map(goal => ({ goal, insights: insightsById[goal.id] })).filter(item => item.insights);
    const change7 = list.length
        ? Math.round(list.reduce((sum, item) => sum + item.insights.change7, 0) / list.length)
        : 0;
    const onTrack = list.filter(item => item.insights.status === 'ahead' || item.insights.status === 'on_pace').length;
    const behind = list.filter(item => item.insights.status === 'behind').length;
    const shown = scrub?.actual ?? overall;

    const summary = [
        onTrack ? `${onTrack} on pace` : null,
        behind ? `${behind} behind` : null,
    ].filter(Boolean).join(' · ') || `${goals.length} goal${goals.length === 1 ? '' : 's'}`;

    return (
        <SheetScreen
            title="Goal progress"
            onBack={() => router.back()}
            shareSummary={{ title: 'Goal progress', value: `${overall}%`, subtitle: `${goals.length} active goal${goals.length === 1 ? '' : 's'}` }}
        >
            {/* Scrolling stays on. It used to be switched off whenever a point
                was selected, which was only survivable because the selection
                cleared the instant the finger lifted — now that a reading
                stays, that rule would lock the page. The chart's own gesture
                already hands a vertical drag back with `failOffsetY`. */}
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {!loaded ? <ActivityIndicator color={accent} style={{ marginTop: 40 }} /> : goals.length === 0 ? (
                    <VoidCard style={styles.emptyCard}>
                        <Ionicons name="flag-outline" size={32} color={colors.textTertiary} />
                        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No goals yet</Text>
                        <Text style={[styles.emptyBody, { color: colors.textTertiary }]}>Create a goal and its progress shows up here.</Text>
                    </VoidCard>
                ) : (
                    <>
                        {/* All goals together. */}
                        <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>ALL GOALS</Text>
                        <View style={styles.headline}>
                            <Text style={[styles.bigNumber, { color: colors.textPrimary }]}>{Math.round(shown)}%</Text>
                            {!scrub ? (
                                <View style={[styles.change, { backgroundColor: (change7 > 0 ? colors.success : colors.textTertiary) + '22' }]}>
                                    <Ionicons name={change7 > 0 ? 'caret-up' : 'remove'} size={12} color={change7 > 0 ? colors.success : colors.textTertiary} />
                                    <Text style={[styles.changeText, { color: change7 > 0 ? colors.success : colors.textTertiary }]}>
                                        {change7 === 1 ? '1 pt' : `${change7} pts`} · 7d
                                    </Text>
                                </View>
                            ) : null}
                        </View>
                        <Text style={[styles.subline, { color: colors.textSecondary }]}>
                            {scrub
                                ? `${dateAt(scrub.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · pace ${Math.round(scrub.pace)}%`
                                : summary}
                        </Text>

                        {overallSeries.length > 1 ? (
                            <View style={{ marginTop: 16 }}>
                                <GoalProgressChart series={overallSeries} color={accent} onScrub={setScrub} />
                                <View style={styles.legend}>
                                    <View style={[styles.legendLine, { backgroundColor: accent }]} />
                                    <Text style={[styles.legendText, { color: colors.textTertiary }]}>Done</Text>
                                    <View style={[styles.legendLine, styles.legendDashed, { borderColor: colors.textTertiary }]} />
                                    <Text style={[styles.legendText, { color: colors.textTertiary }]}>Pace to finish on time</Text>
                                </View>
                            </View>
                        ) : null}

                        {/* Each goal on its own. */}
                        <SectionLabel>{`Goals · ${goals.length}`}</SectionLabel>
                        {list.map(({ goal, insights }) => {
                            const color = goal.color || accent;
                            const up = insights.change7 > 0;
                            return (
                                <TouchableOpacity
                                    key={goal.id}
                                    activeOpacity={0.85}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${goal.name}, ${insights.progress}% done, ${STATUS_LABEL[insights.status]}. Show its chart.`}
                                    accessibilityState={{ expanded: openGoal === goal.id }}
                                    onPress={() => {
                                        lightFeedback();
                                        setGoalScrub(null);
                                        setOpenGoal(current => (current === goal.id ? null : goal.id));
                                    }}
                                    onLongPress={() => { lightFeedback(); router.push({ pathname: '/goal-stats', params: { goalId: goal.id } }); }}
                                    style={[styles.goalCard, { backgroundColor: isLight ? '#FFFFFF' : 'rgba(255,255,255,0.05)', borderColor: colors.border }]}
                                >
                                    <View style={styles.goalTop}>
                                        <View style={{ flex: 1 }}>
                                            <Text numberOfLines={1} style={[styles.goalName, { color: colors.textPrimary }]}>{goal.name}</Text>
                                            <View style={styles.statusRow}>
                                                <View style={[styles.statusDot, { backgroundColor: statusColor(insights.status) }]} />
                                                <Text style={[styles.goalMeta, { color: colors.textTertiary }]}>
                                                    {openGoal === goal.id && goalScrub
                                                        ? `${dateAt(goalScrub.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · ${Math.round(goalScrub.actual)}% · pace ${Math.round(goalScrub.pace)}%`
                                                        : `${STATUS_LABEL[insights.status]}${insights.daysLeft !== null ? ` · ${insights.daysLeft} days left` : ''}`}
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={[styles.goalNumber, { color: colors.textPrimary }]}>{insights.progress}%</Text>
                                            <Text style={[styles.goalChange, { color: up ? colors.success : colors.textTertiary }]}>
                                                {up ? '▲ ' : ''}{insights.change7 === 1 ? '1 pt' : `${insights.change7} pts`} · 7d
                                            </Text>
                                        </View>
                                    </View>
                                    {insights.series.length > 1 ? (
                                        <Animated.View layout={MORPH} style={{ marginTop: 10 }}>
                                            {openGoal === goal.id ? (
                                                // The same chart as the one at
                                                // the top: ranges, and a line
                                                // you can drag across.
                                                <Animated.View entering={FadeIn.duration(180)}>
                                                    <GoalProgressChart
                                                        series={insights.series}
                                                        color={color}
                                                        onScrub={setGoalScrub}
                                                    />
                                                </Animated.View>
                                            ) : (
                                                <GoalProgressChart series={insights.series} color={color} height={64} compact />
                                            )}
                                        </Animated.View>
                                    ) : null}
                                </TouchableOpacity>
                            );
                        })}
                    </>
                )}
            </ScrollView>
        </SheetScreen>
    );
}

const styles = StyleSheet.create({
    content: { paddingHorizontal: 20, paddingBottom: 40 },
    eyebrow: { fontSize: 11, letterSpacing: 1.2, fontFamily: FontFamily.semibold, marginTop: 4 },
    headline: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
    bigNumber: { fontSize: 52, fontFamily: FontFamily.bold, letterSpacing: -1.5 },
    change: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
    changeText: { fontSize: 12, fontFamily: FontFamily.semibold },
    subline: { fontSize: 14, fontFamily: FontFamily.regular },
    legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
    legendLine: { width: 16, height: 2.5, borderRadius: 2, marginLeft: 6 },
    legendDashed: { height: 0, borderTopWidth: 1.5, borderStyle: 'dashed', backgroundColor: 'transparent' },
    legendText: { fontSize: 12, fontFamily: FontFamily.regular },
    goalCard: { padding: 16, borderRadius: 18, borderWidth: 1, marginBottom: 10 },
    goalTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    goalName: { fontSize: 16, fontFamily: FontFamily.semibold },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    goalMeta: { fontSize: 12, fontFamily: FontFamily.regular },
    goalNumber: { fontSize: 22, fontFamily: FontFamily.bold },
    goalChange: { fontSize: 12, fontFamily: FontFamily.semibold, marginTop: 2 },
    emptyCard: { alignItems: 'center', padding: 32, gap: 8, marginTop: 20 },
    emptyTitle: { fontSize: 16, fontFamily: FontFamily.semibold },
    emptyBody: { fontSize: 13, fontFamily: FontFamily.regular, textAlign: 'center' },
});
