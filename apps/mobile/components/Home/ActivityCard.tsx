import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppIcon, CountUp, IconTile, ProgressRing, StatTile, Text, VoidCard, WeekBars } from '@/components/ui';
import { activityWeek } from '@/lib/healthStats';
import { EarnedChip } from './EarnedChip';
import { useTokens } from '@/hooks/useTokens';
import { useActivity } from '@/hooks/useActivity';
import { useWeekStart } from '@/hooks/useWeekStart';
import { localDateKey } from '@/lib/habitSchedule';
import { startOfWeek } from '@/lib/weekStart';
import { MARKS } from '@/lib/marks';
import { Spacing } from '@/theme/designSystem';

/**
 * Today's movement, from Apple Health, drawn the way fitness apps do: exercise
 * minutes as a ring filling to your goal (Settings), steps and active energy
 * beside it; this week as bars against the goal, dashed across (drag a finger
 * across to read any day: the ring and figures show it); and the week in three
 * figures. Reaching the goal earns 20 Shards; missing it costs nothing.
 * Without Health, it says how to connect rather than vanishing.
 */
export function ActivityCard() {
    const t = useTokens();
    const activity = useActivity();
    const weekStart = useWeekStart();
    // The day under the finger while it is on the bars; today otherwise.
    const [picked, setPicked] = useState<number | null>(null);
    if (activity.showCard === false) return null;

    if (!activity.connected) {
        return (
            <VoidCard style={styles.card}>
                <View style={styles.head}>
                    <IconTile icon="walk" color={t.color.success} size={Spacing.xxl + Spacing.sm} />
                    <Text variant="heading" grow>Activity</Text>
                </View>
                <Text variant="bodySmall" tone="muted">Connect Apple Health to see your exercise and steps here. Reaching your exercise goal earns 20 Shards.</Text>
                <Pressable accessibilityRole="button" onPress={() => router.push('/(root)/integrations' as never)} style={styles.connect} hitSlop={Spacing.md}>
                    <Text variant="bodySmall" tone="accent">Connect Apple Health</Text>
                    <AppIcon name="chevron-forward" size={Spacing.md} color={t.color.accent} />
                </Pressable>
            </VoidCard>
        );
    }

    const todayKey = localDateKey(new Date());
    const first = startOfWeek(new Date(), weekStart);
    const week = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(first); date.setDate(first.getDate() + index);
        const key = localDateKey(date);
        return { key, date, label: date.toLocaleDateString(undefined, { weekday: 'narrow' }), ahead: key > todayKey, isToday: key === todayKey };
    });
    const shownDay = picked !== null && !week[picked].ahead ? week[picked] : week.find(day => day.isToday) ?? week[0];
    const today = activity.days[shownDay.key] ?? { minutes: 0, steps: 0 };
    const met = today.minutes >= activity.target;
    const dayName = shownDay.isToday ? 'Today' : shownDay.date.toLocaleDateString(undefined, { weekday: 'long' });
    const stats = activityWeek(week.filter(day => !day.ahead).map(day => day.key), activity.days, activity.target);

    return (
        <VoidCard style={styles.card}>
            <View style={styles.head}>
                <IconTile icon="walk" color={t.color.success} size={Spacing.xxl + Spacing.sm} />
                <Text variant="heading" grow>Activity</Text>
                {met ? <EarnedChip amount={MARKS.complete.exercise} /> : null}
            </View>

            {/* The day: exercise as the ring, steps and energy beside it. */}
            <View style={styles.body} accessibilityLiveRegion="polite">
                <ProgressRing progress={activity.target ? today.minutes / activity.target : 0} tone="success" label={`${today.minutes}`}
                    accessibilityLabel={`${today.minutes} of ${activity.target} exercise minutes ${dayName.toLowerCase()}`} />
                <View style={styles.figures}>
                    <Text variant="caption" tone="muted">{dayName}</Text>
                    <View style={styles.figure}>
                        <CountUp value={today.steps.toLocaleString()} style={[t.type.screenTitle, { color: t.color.textPrimary }]} />
                        <Text variant="bodySmall" tone="muted">steps</Text>
                    </View>
                    <Text variant="bodySmall" tone="muted">
                        {`${today.minutes} of ${activity.target} min exercise${today.energy ? ` · ${today.energy.toLocaleString()} kcal` : ''}`}
                    </Text>
                </View>
            </View>

            <View style={styles.section}>
                <View style={styles.sectionHead}>
                    <Text variant="caption" tone="muted" grow>This week</Text>
                    <Text variant="caption" tone="muted">{`Goal ${activity.target} min`}</Text>
                </View>
                <WeekBars replay={weekStart} goal={activity.target} color={t.tint('border', t.color.success)} metColor={t.color.success} picked={picked} onPick={setPicked}
                    days={week.map(day => ({ key: day.key, label: day.label, value: activity.days[day.key]?.minutes ?? null, ahead: day.ahead, today: day.isToday }))}
                    accessibilityLabel={`This week: ${week.filter(day => !day.ahead).map(day => `${activity.days[day.key]?.minutes ?? 0} minutes`).join(', ')}`} />
            </View>

            {/* The week in three figures. */}
            <View style={styles.stats}>
                <StatTile value={stats.averageMinutes !== null ? `${stats.averageMinutes} min` : '—'} label="Average" />
                <StatTile value={`${stats.met}/${stats.recorded}`} label="At goal" />
                <StatTile value={stats.averageSteps !== null ? stats.averageSteps.toLocaleString() : '—'} label="Steps a day" />
            </View>
        </VoidCard>
    );
}

const styles = StyleSheet.create({
    card: { padding: Spacing.lg, gap: Spacing.lg },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    connect: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, alignSelf: 'flex-start' },
    body: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
    figures: { flex: 1, gap: Spacing.xs / 2 },
    figure: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs },
    section: { gap: Spacing.sm },
    sectionHead: { flexDirection: 'row', alignItems: 'center' },
    stats: { flexDirection: 'row' },
});
