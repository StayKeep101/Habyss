import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { runOnJS, useAnimatedStyle } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useHaptics } from '@/hooks/useHaptics';
import { AppIcon, CountUp, IconTile, ProgressRing, Text, VoidCard } from '@/components/ui';
import { useProgress } from '@/components/ui/Motion';
import { useTokens } from '@/hooks/useTokens';
import { useActivity } from '@/hooks/useActivity';
import { useWeekStart } from '@/hooks/useWeekStart';
import { localDateKey } from '@/lib/habitSchedule';
import { startOfWeek } from '@/lib/weekStart';
import { MARKS } from '@/lib/marks';
import { Spacing } from '@/theme/designSystem';

const BAR = Spacing.xxl * 2;

/**
 * Today's movement, from Apple Health: exercise minutes as a ring filling to
 * your goal (Settings), steps beside it, and this week as bars, a full one
 * where the goal was reached. Drag a finger across the bars, as on Sleep, to
 * read any day this week: the ring and the figures show that day. Reaching it earns 20 Marks; missing it costs
 * nothing. Without Health, it says how to connect rather than vanishing.
 */
export function ActivityCard() {
    const t = useTokens();
    const activity = useActivity();
    const weekStart = useWeekStart();
    const { selectionFeedback } = useHaptics();
    // The day under the finger while it is on the bars; today otherwise.
    const [picked, setPicked] = useState<number | null>(null);
    const [barsWidth, setBarsWidth] = useState(0);
    if (activity.showCard === false) return null;

    if (!activity.connected) {
        return (
            <VoidCard style={styles.card}>
                <View style={styles.head}>
                    <IconTile icon="walk" color={t.color.success} size={Spacing.xxl + Spacing.sm} />
                    <Text variant="heading" grow>Activity</Text>
                </View>
                <Text variant="bodySmall" tone="muted">Connect Apple Health to see your exercise and steps here. Reaching your exercise goal earns 20 Marks.</Text>
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
    const dayName = shownDay.isToday ? 'today' : shownDay.date.toLocaleDateString(undefined, { weekday: 'long' });
    const pick = (x: number) => {
        const index = Math.max(0, Math.min(6, Math.floor((x / Math.max(1, barsWidth)) * 7)));
        if (week[index].ahead) return;
        setPicked(previous => {
            if (previous !== index) selectionFeedback();
            return index;
        });
    };
    const scrub = Gesture.Pan()
        .activeOffsetX([-4, 4])
        .failOffsetY([-12, 12])
        .onBegin(event => { runOnJS(pick)(event.x); })
        .onUpdate(event => { runOnJS(pick)(event.x); })
        .onFinalize(() => { runOnJS(setPicked)(null); });

    return (
        <VoidCard style={styles.card}>
            <View style={styles.head}>
                <IconTile icon="walk" color={t.color.success} size={Spacing.xxl + Spacing.sm} />
                <Text variant="heading" grow>Activity</Text>
                {met ? <Text variant="caption" tone="success">{`+${MARKS.complete.exercise} Marks`}</Text> : null}
            </View>
            <View style={styles.body}>
                <ProgressRing progress={activity.target ? today.minutes / activity.target : 0} tone="success" label={`${today.minutes}`}
                    accessibilityLabel={`${today.minutes} of ${activity.target} exercise minutes ${dayName}`} />
                <View style={styles.figures} accessibilityLiveRegion="polite">
                    <Text variant="caption" tone={shownDay.isToday ? 'muted' : 'primary'}>{shownDay.isToday ? 'Today' : dayName}</Text>
                    <Text variant="caption" tone="muted">{`of ${activity.target} min exercise`}</Text>
                    <View style={styles.steps}>
                        <CountUp value={today.steps.toLocaleString()} style={[t.type.title, { color: t.color.textPrimary }]} />
                        <Text variant="caption" tone="muted">steps</Text>
                    </View>
                </View>
                <GestureDetector gesture={scrub}>
                <View style={styles.bars} accessible onLayout={event => setBarsWidth(event.nativeEvent.layout.width)}
                    accessibilityLabel={`This week: ${week.filter(day => !day.ahead).map(day => `${activity.days[day.key]?.minutes ?? 0} minutes`).join(', ')}`}>
                    {week.map((day, index) => (
                        <View key={day.key} style={[styles.barCol, picked !== null && picked !== index && styles.barDim]}>
                            {day.ahead ? <View style={styles.track} /> : (
                                <Bar share={(activity.days[day.key]?.minutes ?? 0) / Math.max(1, activity.target)} index={index}
                                    color={(activity.days[day.key]?.minutes ?? 0) >= activity.target ? t.color.success : t.color.surfaceRaised} />
                            )}
                            <Text variant="caption" tone={day.isToday ? 'primary' : 'muted'}>{day.label}</Text>
                        </View>
                    ))}
                </View>
                </GestureDetector>
            </View>
        </VoidCard>
    );
}

function Bar({ share, index, color }: { share: number; index: number; color: string }) {
    const grown = useProgress(Math.max(0.06, Math.min(1, share)), index * Spacing.xl);
    const style = useAnimatedStyle(() => ({ height: grown.get() * BAR }));
    return (
        <View style={styles.track}>
            <Animated.View style={[styles.fill, { backgroundColor: color }, style]} />
        </View>
    );
}

const styles = StyleSheet.create({
    card: { padding: Spacing.lg, gap: Spacing.md },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    connect: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, alignSelf: 'flex-start' },
    body: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.lg },
    figures: { flex: 1, gap: Spacing.sm },
    steps: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs },
    bars: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.xs },
    barCol: { alignItems: 'center', gap: Spacing.xs },
    /** The other days, while a finger rests on one. */
    barDim: { opacity: 0.4 },
    track: { width: Spacing.sm + 2, height: BAR, justifyContent: 'flex-end' },
    fill: { width: '100%', borderRadius: Spacing.xs },
});
