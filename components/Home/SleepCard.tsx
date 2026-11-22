import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppIcon, CountUp, IconTile, StatTile, Text, VoidCard, WeekBars } from '@/components/ui';
import { Spacing } from '@/theme/designSystem';
import { useTokens } from '@/hooks/useTokens';
import { useSleep } from '@/hooks/useSleep';
import { formatSleep } from '@/lib/sleepLog';
import { formatClockMinutes, sleepWeek } from '@/lib/healthStats';
import { MARKS } from '@/lib/marks';
import { localDateKey } from '@/lib/habitSchedule';
import { startOfWeek } from '@/lib/weekStart';
import { useWeekStart } from '@/hooks/useWeekStart';
import { EarnedChip } from './EarnedChip';
import { SleepStages } from './SleepStages';

/**
 * Last night's sleep, from Apple Health, drawn the way sleep apps do: how long
 * and from when to when; its stages (Awake, REM, Core, Deep) when the watch or
 * ring records them; this week as bars against the goal (drag across to read
 * any night: the figures and stages show that night); and the week in three
 * figures (average, nights at the goal, when you usually fall asleep). The week
 * starts on the day set in Settings; days still to come are left empty. A night that
 * reaches your goal earns 20 Marks; a recorded night short of it costs 20. The goal is set
 * in Settings, and so is whether this card shows at all. With no sleep data
 * yet, it says how to get some rather than vanishing.
 */
export function SleepCard() {
    const t = useTokens();
    const sleep = useSleep();
    const weekStart = useWeekStart();
    // A finger on the week: the night under it, until it lets go (then last night again).
    const [picked, setPicked] = useState<number | null>(null);

    if (sleep.showCard === false) return null;
    // No sleep data yet (Health not connected, or nothing that records sleep):
    // say how to get it, in the same card.
    if (!sleep.connected || Object.keys(sleep.nights).length === 0) {
        return (
            <VoidCard style={styles.card}>
                <View style={styles.head}>
                    <IconTile icon="moon" color={t.color.accent} size={Spacing.xxl + Spacing.sm} />
                    <Text variant="heading" grow>Sleep</Text>
                </View>
                <Text variant="bodySmall" tone="muted">
                    {sleep.connected ? 'No sleep recorded yet. Any watch or ring that writes sleep to Apple Health works.' : 'Connect Apple Health to see your nights here. Reaching your sleep goal earns 20 Shards.'}
                </Text>
                {!sleep.connected ? (
                    <Pressable accessibilityRole="button" onPress={() => router.push('/(root)/integrations' as never)} style={styles.connect} hitSlop={Spacing.md}>
                        <Text variant="bodySmall" tone="accent">Connect Apple Health</Text>
                        <AppIcon name="chevron-forward" size={Spacing.md} color={t.color.accent} />
                    </Pressable>
                ) : null}
            </VoidCard>
        );
    }

    // Each morning of this week; a night belongs to the morning it ends on.
    const todayKey = localDateKey(new Date());
    const first = startOfWeek(new Date(), weekStart);
    const mornings = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(first);
        date.setDate(first.getDate() + index);
        const key = localDateKey(date);
        return { key, label: date.toLocaleDateString(undefined, { weekday: 'narrow' }), isToday: key === todayKey, ahead: key > todayKey };
    });
    // The night shown: last night, or the one under the finger. A night is
    // named by the evening it began ("Tuesday night"), the morning before it.
    const shownDay = picked !== null && !mornings[picked].ahead ? mornings[picked] : mornings.find(day => day.isToday) ?? mornings[0];
    const last = sleep.nights[shownDay.key];
    const night = sleep.details?.[shownDay.key];
    const met = last !== undefined && last >= sleep.target;
    const evening = new Date(`${shownDay.key}T12:00:00`); evening.setDate(evening.getDate() - 1);
    const nightName = shownDay.isToday ? 'Last night' : `${evening.toLocaleDateString(undefined, { weekday: 'long' })} night`;
    const clock = (at: number) => new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const week = sleepWeek(mornings.filter(day => !day.ahead).map(day => day.key), sleep.nights, sleep.details, sleep.target);

    return (
        <VoidCard style={styles.card}>
            <View style={styles.head}>
                <IconTile icon="moon" color={t.color.accent} size={Spacing.xxl + Spacing.sm} />
                <Text variant="heading" grow>Sleep</Text>
                {/* What the night did to your Shards: +20 at your goal, −20 short of it. */}
                {last !== undefined ? <EarnedChip amount={met ? MARKS.complete.sleep : MARKS.miss.sleep} /> : null}
            </View>

            {/* The night: how long, and from when to when. */}
            <View accessibilityLiveRegion="polite">
                <CountUp style={[t.type.screenTitle, { color: t.color.textPrimary }]} value={last !== undefined ? formatSleep(last) : '—'} />
                <Text variant="bodySmall" tone="muted">
                    {last === undefined ? `No sleep recorded ${nightName.toLowerCase()}` : night ? `${nightName} · ${clock(night.bed)} – ${clock(night.wake)}` : nightName}
                </Text>
            </View>

            {/* Its stages, when the watch or ring records them. */}
            {night?.staged ? <SleepStages night={night} /> : null}

            <View style={styles.section}>
                <View style={styles.sectionHead}>
                    <Text variant="caption" tone="muted" grow>This week</Text>
                    <Text variant="caption" tone="muted">{`Goal ${formatSleep(sleep.target)}`}</Text>
                </View>
                <WeekBars replay={weekStart} goal={sleep.target} color={t.color.accent} metColor={t.color.success} picked={picked} onPick={setPicked}
                    days={mornings.map(day => ({ key: day.key, label: day.label, value: sleep.nights[day.key] ?? null, ahead: day.ahead, today: day.isToday }))}
                    accessibilityLabel={`This week: ${mornings.filter(day => !day.ahead).map(day => sleep.nights[day.key] ? formatSleep(sleep.nights[day.key]) : 'no data').join(', ')}`} />
            </View>

            {/* The week in three figures: how long on average, how often at the goal, when you usually fall asleep. */}
            <View style={styles.stats}>
                <StatTile value={week.average !== null ? formatSleep(week.average) : '—'} label="Average" />
                <StatTile value={`${week.met}/${week.recorded}`} label="At goal" />
                <StatTile value={week.bedtime !== null ? formatClockMinutes(week.bedtime) : '—'} label="Asleep at"
                    detail={week.spread !== null ? `±${week.spread} min` : undefined} />
            </View>
        </VoidCard>
    );
}

const styles = StyleSheet.create({
    connect: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, alignSelf: 'flex-start' },
    card: { padding: Spacing.lg, gap: Spacing.lg },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    section: { gap: Spacing.sm },
    sectionHead: { flexDirection: 'row', alignItems: 'center' },
    stats: { flexDirection: 'row' },
});
