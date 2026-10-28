import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { runOnJS, useAnimatedStyle } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useHaptics } from '@/hooks/useHaptics';
import { VoidCard } from '@/components/ui/VoidCard';
import { IconTile } from '@/components/ui/IconTile';
import { AppIcon } from '@/components/ui/AppIcon';
import { CountUp, useProgress } from '@/components/ui/Motion';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useSleep } from '@/hooks/useSleep';
import { formatSleep } from '@/lib/sleepLog';
import { MARKS } from '@/lib/marks';
import { localDateKey } from '@/lib/habitSchedule';
import { startOfWeek } from '@/lib/weekStart';
import { useWeekStart } from '@/hooks/useWeekStart';

const BAR_HEIGHT = 56;

/**
 * Last night's sleep, from Apple Health, and this week so far: one bar per
 * night, starting on the day the week starts (Settings), days still to come
 * left empty. A new week starts with a clean row. A night that
 * reaches your goal earns 20 Marks; a recorded night short of it costs 20. The goal is set
 * in Settings, and so is whether this card shows at all. With no sleep data
 * yet, it says how to get some rather than vanishing.
 */
export function SleepCard() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const sleep = useSleep();
    const weekStart = useWeekStart();
    const { selectionFeedback } = useHaptics();
    // A finger on the week: the night under it, until it lets go (then last night again).
    const [picked, setPicked] = useState<number | null>(null);
    const barsWidth = useRef(0);

    if (sleep.showCard === false) return null;
    // No sleep data yet (Health not connected, or nothing that records sleep):
    // say how to get it, in the same card.
    if (!sleep.connected || Object.keys(sleep.nights).length === 0) {
        return (
            <VoidCard style={styles.card}>
                <View style={styles.head}>
                    <IconTile icon="moon" color={primary} size={32} />
                    <Text style={[styles.title, styles.flex, { color: colors.textPrimary }]}>Sleep</Text>
                </View>
                <Text style={[styles.sub, { color: colors.textSecondary }]}>
                    {sleep.connected ? 'No sleep recorded yet. Any watch or ring that writes sleep to Apple Health works.' : 'Connect Apple Health to see your nights here. Reaching your sleep goal earns 20 Marks.'}
                </Text>
                {!sleep.connected ? (
                    <Pressable accessibilityRole="button" onPress={() => router.push('/(root)/integrations' as never)} style={styles.connect}>
                        <Text style={[styles.earnedText, { color: primary }]}>Connect Apple Health</Text>
                        <AppIcon name="chevron-forward" size={12} color={primary} />
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
    const met = last !== undefined && last >= sleep.target;
    const evening = new Date(`${shownDay.key}T12:00:00`); evening.setDate(evening.getDate() - 1);
    const nightName = shownDay.isToday ? 'Last night' : `${evening.toLocaleDateString(undefined, { weekday: 'long' })} night`;
    const pick = (x: number) => {
        const index = Math.max(0, Math.min(6, Math.floor((x / Math.max(1, barsWidth.current)) * 7)));
        if (mornings[index].ahead) return;
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
    const ceiling = Math.max(sleep.target * 1.25, ...mornings.map(day => sleep.nights[day.key] ?? 0));

    return (
        <VoidCard style={styles.card}>
            <View style={styles.head}>
                <IconTile icon="moon" color={primary} size={32} />
                <Text style={[styles.title, styles.flex, { color: colors.textPrimary }]}>Sleep</Text>
                {last !== undefined ? (
                    // What last night did to your Marks: +20 at your goal, −20 short of it.
                    <View style={[styles.earned, { backgroundColor: (met ? colors.success : colors.error) + '22' }]}>{/* ui-allow: tint */}
                        <AppIcon name={met ? 'sparkles' : 'trending-down'} size={12} color={met ? colors.success : colors.error} />
                        <Text style={[styles.earnedText, { color: met ? colors.success : colors.error }]}>
                            {met ? `+${MARKS.complete.sleep}` : `${MARKS.miss.sleep}`} Marks
                        </Text>
                    </View>
                ) : null}
            </View>

            <View style={styles.body}>
                <View style={styles.flex}>
                    <CountUp style={[styles.value, { color: colors.textPrimary }]} value={last !== undefined ? formatSleep(last) : '—'} />
                    <Text style={[styles.sub, { color: colors.textTertiary }]} accessibilityLiveRegion="polite">{last !== undefined ? nightName : `No sleep recorded ${nightName.toLowerCase()}`}</Text>
                    {/* The goal is set in Settings. */}
                    <Text style={[styles.goalText, { color: colors.textSecondary }]}>Goal {formatSleep(sleep.target)}</Text>
                </View>
                <GestureDetector gesture={scrub}>
                <View style={styles.bars} accessible onLayout={event => { barsWidth.current = event.nativeEvent.layout.width; }}
                    accessibilityLabel={`This week: ${mornings.filter(day => !day.ahead).map(day => sleep.nights[day.key] ? formatSleep(sleep.nights[day.key]) : 'no data').join(', ')}`}>
                    {mornings.map((day, index) => {
                        const minutes = sleep.nights[day.key];
                        return (
                            <View key={day.key} style={[styles.barCol, picked !== null && picked !== index && styles.barDim]}>
                                {day.ahead ? <View style={styles.barTrack} /> : (
                                    <Bar share={minutes ? minutes / ceiling : 0} index={index} replay={weekStart}
                                        color={minutes === undefined ? colors.surfaceTertiary : minutes >= sleep.target ? colors.success : primary} />
                                )}
                                <Text style={[styles.barLabel, { color: day.isToday ? colors.textPrimary : colors.textTertiary }, day.isToday && styles.barLabelToday]}>{day.label}</Text>
                            </View>
                        );
                    })}
                </View>
                </GestureDetector>
            </View>
        </VoidCard>
    );
}

function Bar({ share, index, color, replay }: { share: number; index: number; color: string; replay?: unknown }) {
    const grown = useProgress(Math.max(0.06, Math.min(1, share)), index * 40, replay);
    const style = useAnimatedStyle(() => ({ height: grown.get() * BAR_HEIGHT }));
    return (
        <View style={styles.barTrack}>
            <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />
        </View>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    connect: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, alignSelf: 'flex-start' },
    card: { padding: Spacing.lg, gap: Spacing.md },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm + 2 },
    title: { fontFamily: FontFamily.semibold, fontSize: 16 },
    sub: { fontFamily: FontFamily.regular, fontSize: 12 },
    earned: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.xs, borderRadius: 999 },
    earnedText: { fontFamily: FontFamily.semibold, fontSize: 12 },
    body: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.lg },
    value: { fontFamily: FontFamily.bold, fontSize: 30, lineHeight: 36, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
    goalText: { fontFamily: FontFamily.medium, fontSize: 13, fontVariant: ['tabular-nums'], marginTop: Spacing.sm },
    /** The other nights, while a finger rests on one. */
    barDim: { opacity: 0.4 },
    bars: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.xs + 2 },
    barCol: { alignItems: 'center', gap: Spacing.xs },
    barTrack: { width: 10, height: BAR_HEIGHT, justifyContent: 'flex-end' },
    bar: { width: '100%', borderRadius: 5 },
    barLabel: { fontFamily: FontFamily.regular, fontSize: 11 },
    barLabelToday: { fontFamily: FontFamily.semibold },
});
