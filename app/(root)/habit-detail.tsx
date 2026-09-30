import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {ActivityIndicator, Alert, AppState, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, LinearTransition, ReduceMotion, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
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
/** Settles without a bounce: a page that overshoots reads as a mis-tap. */
const SPRING = { damping: 22, stiffness: 190, mass: 0.7, reduceMotion: ReduceMotion.System };
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
    const { lightFeedback, selectionFeedback, successFeedback, errorFeedback } = useHaptics();
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
    /**
     * Whether this habit is yours to change.
     *
     * One arrangement, two records: whoever offered a shared habit owns what it
     * is, and everybody on it owns whether they did it. If both sides could
     * edit, one of them moves it to 7am and the other is late for something
     * they never agreed to — and there is no merge for a disagreement about
     * what a habit is. `lib/sharedAdopt.ts` states the rule; this is where it
     * is visible.
     */
    const [owner, setOwner] = useState<{ name: string; mine: boolean } | null>(null);
    useEffect(() => {
        if (!habitId) return;
        let alive = true;
        (async () => {
            const { FriendsService } = require('@/lib/friendsService') as typeof import('@/lib/friendsService');
            const rows = await FriendsService.getSharedItemParticipants(habitId, 'habit').catch(() => []);
            // One person on it is not a shared habit, it is an ordinary one, and
            // an ordinary habit has no owner to be told about.
            if (!alive || rows.length < 2) return;
            const found = (rows as { isOwner?: boolean; isYou?: boolean; username?: string }[])
                .find(row => row.isOwner);
            if (!found) return;
            setOwner({ name: found.isYou ? 'You' : (found.username ?? 'A friend'), mine: !!found.isYou });
        })().catch(() => undefined);
        return () => { alive = false; };
    }, [habitId]);
    const [showShare, setShowShare] = useState(false);
    const [view, setView] = useState<HabitView>('today');
    /**
     * The two pages, as one strip that moves.
     *
     * It used to swap on release and fade the new view in from nothing, so a
     * swipe did not move anything until it had already finished — which reads
     * as the page jumping into place rather than being dragged there. Both
     * pages are mounted side by side now and the strip follows the finger.
     */
    const { width: screenWidth } = useWindowDimensions();
    const pageWidth = screenWidth;
    const page = useSharedValue(0);
    /**
     * Which page is showing, for the worklet to compare against.
     *
     * A shared value rather than a ref: the gesture runs on the UI thread, and
     * a ref read there is both a lint error and a read of whatever React last
     * left behind.
     */
    const onStats = useSharedValue(false);
    // Tapping the switcher has to move the strip too, or the two controls
    // would disagree about which page is showing.
    useEffect(() => {
        onStats.set(view === 'stats');
        page.set(withSpring(view === 'stats' ? -pageWidth : 0, SPRING));
    }, [view, pageWidth, page, onStats]);
    const strip = useAnimatedStyle(() => ({ transform: [{ translateX: page.get() }] }));
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
        .onChange(event => {
            'worklet';
            // Follows the finger, with the two ends rubber-banded: there is
            // nothing to the left of Today or the right of Stats, and a page
            // that slides freely into empty space says there is.
            const at = page.get();
            const next = at + event.changeX;
            const limit = -pageWidth;
            page.set(next > 0 ? next * 0.3 : next < limit ? limit + (next - limit) * 0.3 : next);
        })
        .onEnd(event => {
            'worklet';
            // Distance or speed. Distance alone makes a quick flick feel
            // ignored; speed alone turns the page on a twitch.
            const far = Math.abs(event.translationX) > pageWidth * 0.22;
            const fast = Math.abs(event.velocityX) > 500;
            const wants: HabitView = (far || fast)
                ? (event.translationX < 0 ? 'stats' : 'today')
                : (page.get() < -pageWidth / 2 ? 'stats' : 'today');
            page.set(withSpring(wants === 'stats' ? -pageWidth : 0, SPRING));
            if ((wants === 'stats') !== onStats.get()) {
                onStats.set(wants === 'stats');
                runOnJS(setView)(wants);
                runOnJS(selectionFeedback)();
            }
        }), [selectionFeedback, page, pageWidth, onStats]);

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
                {/* Only the owner can offer it on, for the same reason only
                    the owner can change it: it is theirs. */}
                {owner && !owner.mine ? null : (
                    <ShareButton variant="friend" onPress={() => setShowShare(true)} />
                )}
                {owner && !owner.mine ? (
                    <IconButton
                        icon="lock-closed-outline"
                        label={`${owner.name} set this habit up, so only they can change it`}
                        onPress={() => {
                            lightFeedback();
                            Alert.alert(
                                `${owner.name}'s habit`,
                                'You are doing this one together, so only the person who set it up can change what it is. You can still do it, skip it, or leave it from the menu.',
                            );
                        }}
                    />
                ) : (
                    <IconButton icon="pencil-outline" label="Edit habit" variant="accent" onPress={() => { selectionFeedback(); setShowEditor(true); }} />
                )}
            </View> : undefined}
        >
            {!habit ? <View style={styles.empty}>
                {loading ? <ActivityIndicator color={accent} /> : <><Text style={[Typography.body, { color: colors.textSecondary }]}>{error || 'This habit is unavailable.'}</Text><Pressable onPress={error ? load : () => router.back()} style={styles.retry} accessibilityRole="button"><Text style={[Typography.button, { color: ink }]}>{error ? 'Retry' : 'Go back'}</Text></Pressable></>}
            </View> : <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                {/* Swiping between the two is the gesture the switcher implies.
                    Horizontal only, and it fails to the page for anything
                    vertical, so scrolling never accidentally changes the tab. */}
                <GestureDetector gesture={swap}>
                <Animated.View style={[styles.strip, strip, { width: pageWidth * 2 }]}>
                <ScrollView style={{ width: pageWidth }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <>
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
                    </>
                </ScrollView>

                {/* Every day since it began, and nothing else. A bar chart of
                    the last week and a ring of today were two more ways of
                    saying what the squares already say. */}
                <ScrollView style={{ width: pageWidth }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    <VoidCard matte style={styles.heatmap}>
                        <DetailedHeatmap
                            completionData={history}
                            color={accent}
                            startDate={habit.startDate?.slice(0, 10)}
                            description="Every day since you started"
                        />
                    </VoidCard>
                </ScrollView>
                </Animated.View>
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
    strip: { flex: 1, flexDirection: 'row' },
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
