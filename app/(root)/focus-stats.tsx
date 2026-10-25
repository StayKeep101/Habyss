import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { AnimatedFill, CountUp, ListItem, useProgress } from '@/components/ui/Motion';
import { AppIcon } from '@/components/ui/AppIcon';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { VoidCard } from '@/components/ui/VoidCard';
import { ValuePill } from '@/components/Goal/GoalRows';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useTasks } from '@/hooks/useTasks';
import { useFocusRecords } from '@/hooks/useFocusRecords';
import { focusDuration, focusSummary, hourLabel, shiftDay } from '@/lib/focusStats';
import { getHabits, type Habit } from '@/lib/habitsSQLite';
import { todayKey } from '@/lib/tasks';
import { styles } from '@/styles/screens/focus-stats.styles';

type Range = 7 | 30;
const dayLetter = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' });
const shortDay = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/**
 * Where your focus time goes.
 *
 * The big number is this week's focus, and beside it whether that is more or
 * less than last week. Underneath, a bar per day (7 or 30), then plain
 * numbers — days in a row, longest session, how often you finish, your best
 * hour — and which habits and tasks took the time.
 */
export default function FocusStatsScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const records = useFocusRecords();
    const tasks = useTasks();
    const [habits, setHabits] = useState<Habit[]>([]);
    useEffect(() => { void getHabits().then(setHabits).catch(() => undefined); }, []);

    const [range, setRange] = useState<Range>(7);
    const today = todayKey();
    const summary = useMemo(() => focusSummary(records, today, range), [records, today, range]);
    // The chart pages back through time: swipe right for the week (or month)
    // before, left to come back. A tapped bar shows that one day.
    const [page, setPage] = useState(0);
    const [picked, setPicked] = useState<string | null>(null);
    useEffect(() => { setPage(0); setPicked(null); }, [range]);
    const end = shiftDay(today, -page * range);
    const shown = useMemo(() => focusSummary(records, end, range), [records, end, range]);
    const turn = (by: number) => { setPage(current => Math.max(0, current + by)); setPicked(null); };
    const swipe = Gesture.Pan().runOnJS(true).activeOffsetX([-24, 24]).failOffsetY([-14, 14])
        .onEnd(event => { if (event.translationX > 50) turn(1); else if (event.translationX < -50) turn(-1); });
    const pickedDay = picked ? shown.days.find(day => day.date === picked) : undefined;
    const dayItems = useMemo(() => {
        if (!picked) return null;
        const totals = new Map<string, number>();
        for (const row of records) if (row.date === picked) totals.set(row.itemId, (totals.get(row.itemId) ?? 0) + row.seconds);
        return [...totals.entries()].map(([itemId, seconds]) => ({ itemId, seconds, sessions: 0 })).sort((a, b) => b.seconds - a.seconds);
    }, [records, picked]);
    const listed = dayItems ?? shown.items;
    const replay = `${range}-${page}-${picked ?? ''}`;
    const nameOf = (id: string) => habits.find(habit => habit.id === id)?.name ?? tasks.find(task => task.id === id)?.title ?? 'Removed';

    const up = summary.change > 0;
    const down = summary.change < 0;
    const trendColor = up ? colors.success : down ? colors.error : colors.textTertiary;
    const ceiling = Math.max(1, ...shown.days.map(day => day.seconds));
    const topItem = listed[0]?.seconds ?? 1;

    return (
        <SheetScreen title="Focus" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.hero}>
                    <CountUp style={[styles.heroValue, { color: colors.textPrimary }]} value={focusDuration(summary.week)} />
                    <View style={styles.trendRow}>
                        <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>this week</Text>
                        <View style={[styles.trend, { borderColor: trendColor }]}>
                            <AppIcon name={up ? 'arrow-up' : down ? 'arrow-down' : 'remove'} size={12} color={trendColor} />
                            <Text style={[styles.trendText, { color: trendColor }]}>
                                {summary.change === 0 ? 'Same as last week' : `${focusDuration(Math.abs(summary.change))} vs last week`}
                            </Text>
                        </View>
                    </View>
                </View>

                {summary.sessions === 0 ? (
                    <EmptyState icon="timer-outline" title="No focus yet" message="Start focus from a habit or a task. Every session shows up here." />
                ) : (
                    <>
                        <ChoiceRow accessibilityLabel="Days shown" value={range} onChange={setRange}
                            options={[{ id: 7 as Range, label: '7 days' }, { id: 30 as Range, label: '30 days' }]} />
                        <Text style={[styles.windowLabel, { color: colors.textSecondary }]}>
                            {pickedDay ? `${shortDay(pickedDay.date)} · ${focusDuration(pickedDay.seconds)}`
                                : page === 0 ? (range === 7 ? 'Last 7 days' : 'Last 30 days')
                                : `${shortDay(shown.days[0].date)} – ${shortDay(shown.days[shown.days.length - 1].date)}`}
                        </Text>
                        <GestureDetector gesture={swipe}>
                            <View style={styles.chart} accessible accessibilityRole="adjustable"
                                accessibilityLabel={`Focus per day: ${shown.days.map(day => focusDuration(day.seconds)).join(', ')}`}
                                accessibilityHint="Swipe right for earlier days"
                                accessibilityActions={[{ name: 'increment', label: 'Later' }, { name: 'decrement', label: 'Earlier' }]}
                                onAccessibilityAction={event => turn(event.nativeEvent.actionName === 'decrement' ? 1 : -1)}>
                                {shown.days.map((day, index) => (
                                    <DayBar key={`${replay}-${day.date}`} share={day.seconds / ceiling} index={index} replay={replay}
                                        tint={day.seconds ? primary : colors.border} lit={picked ? day.date === picked : day.date === today}
                                        onPress={() => setPicked(current => (current === day.date ? null : day.date))} />
                                ))}
                            </View>
                        </GestureDetector>
                        <View style={styles.axis}>
                            {range === 7 ? shown.days.map(day => (
                                <Text key={day.date} style={[styles.axisText, styles.axisDay, { color: day.date === (picked ?? today) ? colors.textPrimary : colors.textTertiary }]}>{dayLetter(day.date)}</Text>
                            )) : (
                                <>
                                    <Text style={[styles.axisText, { color: colors.textTertiary }]}>{shortDay(shown.days[0].date)}</Text>
                                    <Text style={[styles.axisText, { color: colors.textTertiary }]}>{page === 0 ? 'Today' : shortDay(shown.days[shown.days.length - 1].date)}</Text>
                                </>
                            )}
                        </View>

                        <View>
                            <SectionTitle first>Numbers</SectionTitle>
                            <VoidCard style={styles.list}>
                                <NumberRow label="Today" value={focusDuration(summary.today)} />
                                <NumberRow label="Days in a row" value={`${summary.streak}`} />
                                <NumberRow label="Longest session" value={focusDuration(summary.longest)} />
                                <NumberRow label="Average session" value={focusDuration(summary.average)} />
                                <NumberRow label="Finished" value={summary.finishedRate === null ? '—' : `${summary.finishedRate}%`} />
                                <NumberRow label="Best hour" value={summary.bestHour === null ? '—' : hourLabel(summary.bestHour)} />
                                <NumberRow label="All time" value={focusDuration(summary.total)} />
                            </VoidCard>
                        </View>

                        {listed.length ? (
                            <View>
                                <SectionTitle>{pickedDay ? `${shortDay(pickedDay.date)} went to` : page > 0 ? 'Those days went to' : range === 7 ? 'This week went to' : 'The last 30 days went to'}</SectionTitle>
                                <VoidCard style={styles.list}>
                                    {listed.slice(0, 8).map((item, index) => (
                                        <ListItem key={item.itemId} index={index}>
                                            <View style={styles.item}>
                                                <View style={styles.itemTop}>
                                                    <Text numberOfLines={1} style={[styles.itemName, { color: colors.textPrimary }]}>{nameOf(item.itemId)}</Text>
                                                    <CountUp style={[styles.itemValue, { color: colors.textSecondary }]} value={focusDuration(item.seconds)} replay={replay} />
                                                </View>
                                                <View style={[styles.track, { backgroundColor: colors.border }]}>
                                                    <AnimatedFill progress={item.seconds / topItem} delay={index * 60} replay={replay}
                                                        style={[styles.fill, { backgroundColor: primary }]} />
                                                </View>
                                            </View>
                                        </ListItem>
                                    ))}
                                </VoidCard>
                            </View>
                        ) : null}
                    </>
                )}
            </ScrollView>
        </SheetScreen>
    );
}

const NumberRow = ({ label, value }: { label: string; value: string }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    return (
        <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
            <ValuePill value={value} />
        </View>
    );
};

const DayBar = ({ share, index, replay, tint, lit, onPress }: { share: number; index: number; replay: unknown; tint: string; lit: boolean; onPress: () => void }) => {
    const grown = useProgress(Math.max(share, 0.03), index * 25, replay);
    const height = useAnimatedStyle(() => ({ height: `${grown.get() * 100}%` }));
    return (
        <Pressable style={styles.barTrack} onPress={onPress} hitSlop={4}>
            <Animated.View style={[styles.bar, height, { backgroundColor: tint, opacity: lit ? 1 : 0.6 }]} />
        </Pressable>
    );
};
