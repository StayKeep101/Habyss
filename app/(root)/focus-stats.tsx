import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
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
import { focusDuration, focusSummary, hourLabel } from '@/lib/focusStats';
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
    const nameOf = (id: string) => habits.find(habit => habit.id === id)?.name ?? tasks.find(task => task.id === id)?.title ?? 'Removed';

    const up = summary.change > 0;
    const down = summary.change < 0;
    const trendColor = up ? colors.success : down ? colors.error : colors.textTertiary;
    const ceiling = Math.max(1, ...summary.days.map(day => day.seconds));
    const topItem = summary.items[0]?.seconds ?? 1;

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
                        <View style={styles.chart} accessible accessibilityRole="image"
                            accessibilityLabel={`Focus per day: ${summary.days.map(day => focusDuration(day.seconds)).join(', ')}`}>
                            {summary.days.map((day, index) => (
                                <DayBar key={`${range}-${day.date}`} share={day.seconds / ceiling} index={index} replay={range}
                                    tint={day.seconds ? primary : colors.border} lit={day.date === today} />
                            ))}
                        </View>
                        <View style={styles.axis}>
                            {range === 7 ? summary.days.map(day => (
                                <Text key={day.date} style={[styles.axisText, styles.axisDay, { color: day.date === today ? colors.textPrimary : colors.textTertiary }]}>{dayLetter(day.date)}</Text>
                            )) : (
                                <>
                                    <Text style={[styles.axisText, { color: colors.textTertiary }]}>{shortDay(summary.days[0].date)}</Text>
                                    <Text style={[styles.axisText, { color: colors.textTertiary }]}>Today</Text>
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

                        {summary.items.length ? (
                            <View>
                                <SectionTitle>{range === 7 ? 'This week went to' : 'The last 30 days went to'}</SectionTitle>
                                <VoidCard style={styles.list}>
                                    {summary.items.slice(0, 8).map((item, index) => (
                                        <ListItem key={item.itemId} index={index}>
                                            <View style={styles.item}>
                                                <View style={styles.itemTop}>
                                                    <Text numberOfLines={1} style={[styles.itemName, { color: colors.textPrimary }]}>{nameOf(item.itemId)}</Text>
                                                    <CountUp style={[styles.itemValue, { color: colors.textSecondary }]} value={focusDuration(item.seconds)} replay={range} />
                                                </View>
                                                <View style={[styles.track, { backgroundColor: colors.border }]}>
                                                    <AnimatedFill progress={item.seconds / topItem} delay={index * 60} replay={range}
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

const DayBar = ({ share, index, replay, tint, lit }: { share: number; index: number; replay: unknown; tint: string; lit: boolean }) => {
    const grown = useProgress(Math.max(share, 0.03), index * 25, replay);
    const height = useAnimatedStyle(() => ({ height: `${grown.get() * 100}%` }));
    return (
        <View style={styles.barTrack}>
            <Animated.View style={[styles.bar, height, { backgroundColor: tint, opacity: lit ? 1 : 0.6 }]} />
        </View>
    );
};
