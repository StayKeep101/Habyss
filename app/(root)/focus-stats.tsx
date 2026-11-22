import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { AnimatedFill, CountUp, ListItem } from '@/components/ui/Motion';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { IconButton } from '@/components/ui/IconButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { VoidCard } from '@/components/ui/VoidCard';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useTasks } from '@/hooks/useTasks';
import { useFocusRecords } from '@/hooks/useFocusRecords';
import { useWeekStart } from '@/hooks/useWeekStart';
import { useHaptics } from '@/hooks/useHaptics';
import { focusDuration, focusSummary, shiftDay } from '@/lib/focusStats';
import { localDateKey } from '@/lib/habitSchedule';
import { startOfWeek } from '@/lib/weekStart';
import { getHabits, type Habit } from '@/lib/habitsSQLite';
import { todayKey } from '@/lib/tasks';
import { styles } from '@/styles/screens/focus-stats.styles';
import { DayBar } from '@/components/Focus/FocusWeekBars';
import { ScreenTimeReport } from '@/components/Focus/ScreenTimeReport';
import { IconToggle } from '@/components/ui/IconToggle';

type Range = 7 | 30;
type Side = 'focus' | 'screen';
const SIDES = [
    { id: 'focus' as Side, icon: 'timer-outline' as const, label: 'Focus time' },
    { id: 'screen' as Side, icon: 'phone-portrait-outline' as const, label: 'Screen time' },
] as const;
/** Room for the report: the number, the bars and eight apps. */
const dayLetter = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' });
const longDay = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const shortDay = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/**
 * Where your focus time goes.
 *
 * Which days at the top (7 or 30, and back in time), as on the Screen time
 * side. The big number is the average day across the days shown (this week, a
 * week gone by, or 30 days). Underneath, a bar per day: the
 * week, Monday (or Sunday) to its end, or the last 30 days. Press a bar and the
 * big number is that day (drag to read the others); let go and it is the
 * average again. The arrows go back in time. Under it,
 * only what the time went to, most first (for the picked day, when one is).
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
    // Focus time, or Screen time: the same days, the other side of the same question.
    const [side, setSide] = useState<Side>('focus');
    const today = todayKey();
    const summary = useMemo(() => focusSummary(records, today, range), [records, today, range]);
    const weekStart = useWeekStart();
    const weekFrom = useMemo(() => localDateKey(startOfWeek(new Date(`${today}T12:00:00`), weekStart)), [today, weekStart]);
    // The arrows page back through time, a week (or 30 days) at a time.
    const [page, setPage] = useState(0);
    const [picked, setPicked] = useState<string | null>(null);
    useEffect(() => { setPage(0); setPicked(null); }, [range]);
    // A week is the calendar week, its first day from Settings; 30 days end today.
    const end = range === 7 ? shiftDay(weekFrom, 6 - page * 7) : shiftDay(today, -page * range);
    const shown = useMemo(() => focusSummary(records, end, range), [records, end, range]);
    const turn = (by: number) => { selectionFeedback(); setPage(current => Math.max(0, current + by)); setPicked(null); };
    // Tap a bar: that day shows (drag to read the others) and stays until you tap
    // it again, which goes back to the average of the week (or 30 days).
    const { selectionFeedback } = useHaptics();
    const chartWidth = useRef(1);
    const dayAt = (x: number) => {
        const index = Math.max(0, Math.min(shown.days.length - 1, Math.floor((x / chartWidth.current) * shown.days.length)));
        const day = shown.days[index].date;
        return day > today ? null : day;
    };
    const follow = (x: number) => {
        const day = dayAt(x);
        if (!day) return;
        setPicked(current => { if (current !== day) selectionFeedback(); return day; });
    };
    // Picked the moment the finger lands (onBegin), followed sideways, let go on release;
    // a vertical drag fails it, so the page still scrolls.
    // A day stays picked after you let go, so it can be read; the same day again goes back to the average.
    const pickedNow = useRef<string | null>(null);
    pickedNow.current = picked;
    const press = useRef({ day: null as string | null, wasPicked: false, moved: false });
    const touch = Gesture.Pan().runOnJS(true).activeOffsetX([-6, 6]).failOffsetY([-12, 12])
        .onBegin(event => {
            const day = dayAt(event.x);
            press.current = { day, wasPicked: !!day && day === pickedNow.current, moved: false };
            if (!press.current.wasPicked) follow(event.x);
        })
        .onUpdate(event => {
            if (dayAt(event.x) !== press.current.day) press.current.moved = true;
            follow(event.x);
        })
        .onFinalize(() => { if (press.current.wasPicked && !press.current.moved) setPicked(null); });
    const pickedDay = picked ? shown.days.find(day => day.date === picked) : undefined;
    const dayItems = useMemo(() => {
        if (!picked) return null;
        const totals = new Map<string, number>();
        for (const row of records) if (row.date === picked) totals.set(row.itemId, (totals.get(row.itemId) ?? 0) + row.seconds);
        return [...totals.entries()].map(([itemId, seconds]) => ({ itemId, seconds, sessions: 0 })).sort((a, b) => b.seconds - a.seconds);
    }, [records, picked]);
    const listed = dayItems ?? shown.items;
    // Picking a day only lights its bar; the bars replay when the days change.
    const replay = `${range}-${page}`;
    const listReplay = `${replay}-${picked ?? ''}`;
    const nameOf = (id: string) => habits.find(habit => habit.id === id)?.name ?? tasks.find(task => task.id === id)?.title ?? 'Removed';

    // With no day picked: the average day across the days shown (up to today).
    const average = useMemo(() => {
        const elapsed = shown.days.filter(day => day.date <= today);
        return Math.round(elapsed.reduce((sum, day) => sum + day.seconds, 0) / Math.max(1, elapsed.length));
    }, [shown, today]);
    // Which days: 7 or 30, and the arrows back through time. At the top on both sides (the
    // Screen time report draws its figure, bars and list itself, under them).
    const controls = (
        <>
            <ChoiceRow accessibilityLabel="Days shown" value={range} onChange={setRange}
                options={[{ id: 7 as Range, label: '7 days' }, { id: 30 as Range, label: '30 days' }]} />
            <View style={styles.window}>
                <IconButton icon="chevron-back" label={range === 7 ? 'Previous week' : 'Previous 30 days'} diameter={32} size={16} onPress={() => turn(1)} />
                <Text style={[styles.windowLabel, { color: colors.textSecondary }]}>
                    {page === 0 ? (range === 7 ? 'This week' : 'Last 30 days') : `${shortDay(shown.days[0].date)} – ${shortDay(shown.days[shown.days.length - 1].date)}`}
                </Text>
                <IconButton icon="chevron-forward" label={range === 7 ? 'Next week' : 'Next 30 days'} diameter={32} size={16} disabled={page === 0} onPress={() => turn(-1)} />
            </View>
        </>
    );
    const ceiling = Math.max(1, ...shown.days.map(day => day.seconds));
    const topItem = listed[0]?.seconds ?? 1;

    return (
        <SheetScreen title={side === 'focus' ? 'Focus' : 'Screen time'} onBack={() => router.back()}
            rightSlot={<IconToggle options={SIDES} value={side} onChange={next => { selectionFeedback(); setSide(next); setPage(0); setPicked(null); }} />}>
            {side === 'screen' ? (
                // Screen time: the controls, then the report filling the rest. It scrolls by itself:
                // a page scroll around it never gets a finger that lands on it.
                <View style={[styles.content, styles.reportPage]}>
                        {controls}
                        <ScreenTimeReport days={range} offset={page} weekStart={weekStart} />
                </View>
            ) : (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <>
                {summary.sessions === 0 ? null : controls}
                <View style={styles.hero}>
                    {/* The week, or the day under your finger. */}
                    {pickedDay ? (
                        <Text style={[styles.heroValue, { color: colors.textPrimary }]}>{focusDuration(pickedDay.seconds)}</Text>
                    ) : (
                        <CountUp style={[styles.heroValue, { color: colors.textPrimary }]} value={focusDuration(average)} replay={replay} />
                    )}
                    {/* The average, or the day picked. */}
                    <Text numberOfLines={1} style={[styles.heroLabel, { color: colors.textSecondary }]}>{pickedDay ? longDay(pickedDay.date) : 'Daily average'}</Text>
                </View>

                {summary.sessions === 0 ? (
                    <EmptyState icon="timer-outline" title="Zero minutes of focus" message="Start focus on a habit or a task. Every session lands here." />
                ) : (
                    <>
                        <GestureDetector gesture={touch}>
                            <View style={styles.chart} onLayout={event => { chartWidth.current = Math.max(1, event.nativeEvent.layout.width); }}
                                accessible accessibilityRole="adjustable"
                                accessibilityLabel={`Focus per day: ${shown.days.map(day => `${longDay(day.date)} ${focusDuration(day.seconds)}`).join(', ')}`}
                                accessibilityHint="Tap a bar to read that day; tap it again for the average"
                                accessibilityActions={[{ name: 'increment', label: 'Later' }, { name: 'decrement', label: 'Earlier' }]}
                                onAccessibilityAction={event => turn(event.nativeEvent.actionName === 'decrement' ? 1 : -1)}>
                                {shown.days.map((day, index) => (
                                    <DayBar key={`${replay}-${day.date}`} share={day.date > today ? 0 : day.seconds / ceiling} index={index} replay={replay}
                                        tint={day.seconds ? primary : colors.border} lit={picked ? day.date === picked : day.date === today}
                                        dim={!!picked && day.date !== picked} />
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

                        {listed.length ? (
                            <View>
                                <SectionTitle first>{pickedDay ? `${shortDay(pickedDay.date)} went to` : page > 0 ? 'Those days went to' : range === 7 ? 'This week went to' : 'The last 30 days went to'}</SectionTitle>
                                <VoidCard style={styles.list}>
                                    {listed.slice(0, 8).map((item, index) => (
                                        <ListItem key={item.itemId} index={index}>
                                            <View style={styles.item}>
                                                <View style={styles.itemTop}>
                                                    <Text numberOfLines={1} style={[styles.itemName, { color: colors.textPrimary }]}>{nameOf(item.itemId)}</Text>
                                                    <CountUp style={[styles.itemValue, { color: colors.textSecondary }]} value={focusDuration(item.seconds)} replay={listReplay} />
                                                </View>
                                                <View style={[styles.track, { backgroundColor: colors.border }]}>
                                                    <AnimatedFill progress={item.seconds / topItem} delay={index * 60} replay={listReplay}
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
                </>
            </ScrollView>
            )}
        </SheetScreen>
    );
}
