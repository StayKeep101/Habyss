import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {ActivityIndicator, AppState, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, FadeIn, LinearTransition, ReduceMotion, runOnJS } from 'react-native-reanimated';
import { AppIcon } from '@/components/Common/AppIcon';
import { IconButton } from '@/components/Common/IconButton';
import { ShareButton } from '@/components/Common/ShareButton';
import { ViewSwitcher, type SwitcherOption } from '@/components/Common/ViewSwitcher';
import { SheetScreen } from '@/components/Layout/SheetScreen';
import { VoidCard } from '@/components/Layout/VoidCard';
import { HabitProgressCard } from '@/components/Habit/HabitProgressCard';
import { SharedWith } from '@/components/Habit/SharedWith';
import { DetailedHeatmap } from '@/components/Habit/DetailedHeatmap';
import { ShareHabitModal } from '@/components/ShareHabitModal';
import { HabitSheet } from '@/components/Create/HabitSheet';
import { Colors } from '@/constants/Colors';
import { FontFamily, Typography, surfaceFor } from '@/constants/DesignSystem';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { Habit, getHabits, getHabitMeasurement, getLastNDaysCompletions, saveHabitMeasurement } from '@/lib/habitsSQLite';
import { localHabitDate, measurementFor } from '@/lib/habitMeasurement';
import { isHabitScheduledForDate, parseHabitDate } from '@/lib/habitSchedule';
import { readableAccent } from '@/lib/colorContrast';
import { on } from '@/lib/appEvents';

// Timing rather than a spring, so nothing overshoots when the page
// changes size under a tap.
const transition = LinearTransition.duration(200).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System);
const entering = FadeIn.duration(200).reduceMotion(ReduceMotion.System);
const param = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const validDate = (value?: string) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && localHabitDate(new Date(value + 'T12:00:00')) === value;
type HistoryDay = { date: string; completed: boolean; skipped: boolean; scheduled: boolean };
type HabitView = 'today' | 'stats';

const VIEWS: SwitcherOption<HabitView>[] = [
    { id: 'today', label: 'Today', icon: 'today-outline' },
    { id: 'stats', label: 'Stats', icon: 'stats-chart-outline' },
];

export default function HabitDetailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ habitId?: string; date?: string }>();
    const habitId = param(params.habitId);
    const requestedDate = param(params.date);
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { selectionFeedback, successFeedback, errorFeedback } = useHaptics();
    const [today, setToday] = useState(localHabitDate);
    const [date, setDate] = useState(validDate(requestedDate) ? requestedDate! : localHabitDate());
    const [habit, setHabit] = useState<Habit | null>(null);
    const [loading, setLoading] = useState(!!habitId);
    const [loadedFor, setLoadedFor] = useState<string | null>(null);
    const ready = loadedFor === `${habitId}:${date}`;
    const [value, setValue] = useState(0);
    const valueRef = useRef(0);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [history, setHistory] = useState<HistoryDay[]>([]);
    const [undo, setUndo] = useState<number | null>(null);
    const [showEditor, setShowEditor] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [view, setView] = useState<HabitView>('today');
    const pending = useRef(0);
    const generation = useRef(0);
    const mounted = useRef(true);

    useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; }; }, []);
    useEffect(() => {
        const refreshDate = () => setToday(localHabitDate());
        const timer = setInterval(refreshDate, 30000);
        const sub = AppState.addEventListener('change', state => { if (state === 'active') refreshDate(); });
        return () => { clearInterval(timer); sub.remove(); };
    }, []);

    const load = useCallback(async () => {
        if (!habitId) return;
        const request = ++generation.current;
        try {
            const habits = await getHabits();
            const found = habits.find(item => item.id === habitId) || null;
            if (!mounted.current || request !== generation.current) return;
            setHabit(found);
            if (!found) return;
            const [amount, days] = await Promise.all([
                getHabitMeasurement(habitId, measurementFor(found).target, date),
                getLastNDaysCompletions(366),
            ]);
            if (!mounted.current || request !== generation.current || pending.current) return;
            valueRef.current = amount;
            setValue(amount);
            // Whether the day asked for the habit at all, so the charts can
            // tell a day off from a day missed instead of drawing both as zero.
            setHistory(days.map(day => {
                const when = parseHabitDate(day.date);
                return {
                    date: day.date,
                    completed: day.completedIds.includes(habitId),
                    skipped: day.skippedIds.includes(habitId),
                    scheduled: when ? isHabitScheduledForDate(found, when) : true,
                };
            }));
            setLoadedFor(`${habitId}:${date}`);
            setError(null);
        } catch {
            if (mounted.current && request === generation.current) setError('Couldn’t load your progress. Tap retry to try again.');
        } finally {
            if (mounted.current && request === generation.current) setLoading(false);
        }
    }, [habitId, date]);

    useEffect(() => {
        // Fetch persisted state when the selected habit/day changes.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void load();
        const update = on('habit_completion_updated', ({ habitId: id }) => {
            // No id means everything may have moved, so this habit too.
            if ((id === undefined || id === habitId) && !pending.current) void load();
        });
        const edit = on('habit_updated', ({ habitId: id }) => { if (id === undefined || id === habitId) void load(); });
        return () => { generation.current++; update.remove(); edit.remove(); };
    }, [habitId, date, load]);

    const changeValue = async (next: number, isUndo = false) => {
        if (!habit || !ready || date !== localHabitDate() || !Number.isFinite(next) || next < 0) return;
        const previous = valueRef.current;
        if (next === previous) return;
        const target = measurementFor(habit).target;
        selectionFeedback();
        setUndo(isUndo ? null : previous);
        valueRef.current = next;
        setValue(next);
        setError(null);
        setSaving(true);
        pending.current++;
        generation.current++;
        let failed = false;
        try {
            await saveHabitMeasurement(habit.id, next, date);
            if (next >= target && previous < target) successFeedback();
        } catch {
            failed = true;
            errorFeedback();
            if (mounted.current) {
                setError('That change wasn’t saved. Please try again.');
                setUndo(null);
                // Reload the actual saved amount once all queued writes have settled.
                const stored = await getHabitMeasurement(habit.id, target, date).catch(() => previous);
                if (pending.current === 1) { valueRef.current = stored; setValue(stored); }
            }
        } finally {
            pending.current--;
            if (mounted.current && !pending.current) {
                setSaving(false);
                await load();
                if (failed && mounted.current) setError('That change wasn’t saved. Please try again.');
            }
        }
    };

    /**
     * Left and right move between Today and Stats.
     *
     * `activeOffsetX` keeps the page's vertical scroll intact — the gesture has
     * to travel sideways before it claims anything — and `failOffsetY` hands a
     * vertical drag straight back, so neither has to steal from the other.
     */
    const swap = useMemo(() => Gesture.Pan()
        .activeOffsetX([-24, 24])
        .failOffsetY([-16, 16])
        .onEnd(event => {
            'worklet';
            if (Math.abs(event.translationX) < 60) return;
            runOnJS(setView)(event.translationX < 0 ? 'stats' : 'today');
            runOnJS(selectionFeedback)();
        }), [selectionFeedback]);

    const selectDate = (next: string) => {
        if (saving || next === date) return;
        selectionFeedback();
        setUndo(null);
        setDate(next);
    };
    const accent = habit?.color || colors.primary;
    const ink = readableAccent(accent, colors.surfaceSecondary);
    // The card's own steps, so nothing on this page has to invent a colour by
    // putting the accent behind an alpha value.
    const tone = surfaceFor(theme);
    const track = theme === 'light' ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.07)';
    const target = habit ? measurementFor(habit).target : 1;
    const week = Array.from({ length: 7 }, (_, i) => {
        const day = new Date(today + 'T12:00:00');
        day.setDate(day.getDate() - 6 + i);
        const key = localHabitDate(day);
        const record = history.find(item => item.date === key);
        return { date: key, day, completed: key === date && ready ? value >= target : !!record?.completed, skipped: !!record?.skipped };
    });
    const schedule = habit
        ? `${habit.frequency === 'daily' || !habit.frequency ? 'Daily' : habit.frequency.charAt(0).toUpperCase() + habit.frequency.slice(1)}${habit.startTime ? ` · ${habit.startTime}` : ' · Anytime'}`
        : undefined;

    return (
        // The habit's own name and rhythm live in the header. Repeating them in
        // the page cost a block of height this screen could not spare.
        <SheetScreen
            title={habit?.name || 'Habit'}
            subtitle={schedule}
            onBack={() => router.back()}
            rightSlot={habit ? <View style={styles.headerActions}>
                <ShareButton variant="friend" onPress={() => setShowShare(true)} />
                <IconButton icon="pencil-outline" label="Edit habit" variant="accent" onPress={() => { selectionFeedback(); setShowEditor(true); }} />
            </View> : undefined}
        >
            {!habit ? <View style={styles.empty}>
                {loading ? <ActivityIndicator color={accent} /> : <><Text style={[Typography.body, { color: colors.textSecondary }]}>{error || 'This habit is unavailable.'}</Text><Pressable onPress={error ? load : () => router.back()} style={styles.retry} accessibilityRole="button"><Text style={[Typography.button, { color: ink }]}>{error ? 'Retry' : 'Go back'}</Text></Pressable></>}
            </View> : <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                {/* Swiping between the two is the gesture the switcher implies.
                    Horizontal only, and it fails to the page for anything
                    vertical, so scrolling never accidentally changes the tab. */}
                <GestureDetector gesture={swap}>
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    {view === 'today' ? <>
                        <HabitProgressCard key={`${habit.id}:${date}`} habit={habit} date={date} value={value} saving={saving} ready={ready} error={error} canUndo={undo !== null} onChange={next => void changeValue(next)} onAdd={amount => void changeValue(Math.round((valueRef.current + amount) * 1000) / 1000)} onUndo={() => { if (undo !== null) void changeValue(undo, true); }} onToday={() => selectDate(today)} />
                        {!ready && error && <Pressable onPress={load} accessibilityRole="button" style={styles.retry}><Text style={[Typography.button, { color: ink }]}>Retry</Text></Pressable>}

                        {/* The week and the three numbers it adds up to, in one
                            card: they are the same story, and two cards cost a
                            gap and a heading to say so. */}
                        <Animated.View layout={transition}>
                            <VoidCard matte style={styles.rhythm}>
                                <View style={styles.week}>
                                    {week.map(day => {
                                        const scheduled = isHabitScheduledForDate(habit, day.day);
                                        const selected = date === day.date;
                                        return <Pressable key={day.date} onPress={() => selectDate(day.date)} disabled={saving} accessibilityRole="button" accessibilityState={{ selected, disabled: saving }} accessibilityLabel={`${day.day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}, ${day.completed ? 'completed' : day.skipped ? 'skipped' : scheduled ? 'not completed' : 'not scheduled'}`} style={[styles.day, { backgroundColor: selected ? tone.raised : 'transparent' }]}>
                                            <Text style={[styles.weekday, { color: selected ? colors.textPrimary : colors.textTertiary }]}>{day.day.toLocaleDateString(undefined, { weekday: 'narrow' })}</Text>
                                            <View style={[styles.dayCircle, { backgroundColor: day.completed ? accent : (selected ? track : tone.raised) }]}>{day.completed ? <AppIcon name="checkmark" size={14} color={readableAccent('#FFFFFF', accent)} /> : <Text style={[styles.dayNumber, { color: colors.textSecondary }]}>{day.skipped || !scheduled ? '–' : day.day.getDate()}</Text>}</View>
                                            <View style={[styles.todayDot, { backgroundColor: day.date === today ? accent : 'transparent' }]} />
                                        </Pressable>;
                                    })}
                                </View>
                            </VoidCard>
                        </Animated.View>

                        {/* Only renders when somebody else is on it. */}
                        <SharedWith habitId={habit.id} doneToday={history.find(day => day.date === today)?.completed ?? false} />

                        {habit.description ? <Animated.View layout={transition} style={styles.note}><Text style={[Typography.label, { color: colors.textTertiary }]}>Your intention</Text><Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>{habit.description}</Text></Animated.View> : null}
                    </> : (
                        /* Every day since it began, and nothing else. A bar
                           chart of the last week and a ring of today were two
                           more ways of saying what the squares already say. */
                        <Animated.View key="stats" entering={entering} style={styles.swapped}>
                            <VoidCard matte style={styles.heatmap}>
                                <DetailedHeatmap
                                    completionData={history}
                                    color={accent}
                                    startDate={habit.startDate?.slice(0, 10)}
                                    description="EVERY DAY SINCE YOU STARTED"
                                />
                            </VoidCard>
                        </Animated.View>
                    )}
                </ScrollView>
                </GestureDetector>
            </KeyboardAvoidingView>}

            {habit ? (
                <View pointerEvents="box-none" style={styles.switcher}>
                    <ViewSwitcher options={VIEWS} value={view} onChange={setView} accent={accent} />
                </View>
            ) : null}

            {showEditor && habit && <HabitSheet visible onClose={() => setShowEditor(false)} habit={habit} goalId={habit.goalId} onSaved={load} />}
            {habit && habitId && <ShareHabitModal visible={showShare} habitId={habitId} habitName={habit.name} onClose={() => setShowShare(false)} />}
        </SheetScreen>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    swapped: { gap: 18 },
    switcher: { position: 'absolute', left: 20, right: 20, bottom: 16 },
    headerActions: { flexDirection: 'row', gap: 4 },
    content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 84, gap: 14 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    retry: { minHeight: 44, padding: 12, alignItems: 'center', justifyContent: 'center' },
    rhythm: { paddingVertical: 12, paddingHorizontal: 10 },
    week: { flexDirection: 'row', gap: 2 },
    day: { flex: 1, paddingVertical: 8, borderRadius: 14, gap: 5, alignItems: 'center', justifyContent: 'center' },
    weekday: { fontFamily: FontFamily.medium, fontSize: 10 },
    dayCircle: { width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    dayNumber: { fontFamily: FontFamily.regular, fontSize: 12 },
    todayDot: { width: 3, height: 3, borderRadius: 2 },
    divider: { height: StyleSheet.hairlineWidth, marginVertical: 8, marginHorizontal: 4 },
    statRow: { flexDirection: 'row' },
    stat: { flex: 1, alignItems: 'center', gap: 1, paddingHorizontal: 4 },
    statTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    statValue: { fontFamily: FontFamily.display, fontSize: 19, lineHeight: 26, fontVariant: ['tabular-nums'] },
    statLabel: { fontFamily: FontFamily.regular, fontSize: 10, textAlign: 'center' },
    note: { gap: 6, paddingHorizontal: 4 },
    heatmap: { padding: 16 },
});
