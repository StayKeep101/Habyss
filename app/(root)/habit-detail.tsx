import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { markSeen } from '@/lib/dayMemory';
import { ActivityIndicator, Alert, AppState, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, LinearTransition, ReduceMotion, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { IconButton } from '@/components/ui/IconButton';
import { ShareButton } from '@/components/Common/ShareButton';
import { ViewSwitcher, type SwitcherOption } from '@/components/ui/ViewSwitcher';
import { BottomFade } from '@/components/ui/BottomFade';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { HabitProgressCard } from '@/components/Habit/HabitProgressCard';
import { SharedWith } from '@/components/Habit/SharedWith';
import { HabitCalendarMap } from '@/components/Habit/HabitCalendarMap';
import { ShareHabitModal } from '@/components/Social/ShareHabitModal';
import { HabitSheet } from '@/components/Create/HabitSheet';
import { Colors } from '@/theme/colors';
import { FontFamily, Typography } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { Habit, getHabits, getHabitMeasurement, saveHabitMeasurement } from '@/lib/habitsSQLite';
import { historyWindow, loadedData } from '@/lib/dataStore';
import { localHabitDate, measurementFor } from '@/lib/habitMeasurement';
import { isHabitScheduledForDate, parseHabitDate } from '@/lib/habitSchedule';
import { readableAccent } from '@/lib/colorContrast';
import { on } from '@/lib/appEvents';
import { styles } from '@/styles/screens/habit-detail.styles';

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
    // Opened: the timeline's "moved" dot on it goes until it moves again.
    useEffect(() => { if (habitId) markSeen(habitId); }, [habitId]);
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary: accentSolid } = useAccentGradient();
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
                loadedData().then(data => historyWindow(366, data).rows),
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
                    skipped: (day.skippedIds ?? []).includes(habitId),
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
    const accent = habit?.color || accentSolid;
    const ink = readableAccent(accent, colors.surfaceSecondary);
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
                                'Only they can edit it.',
                            );
                        }}
                    />
                ) : (
                    <IconButton icon="pencil-outline" label="Edit habit" onPress={() => { selectionFeedback(); setShowEditor(true); }} />
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

                        {/* Only renders when somebody else is on it. */}
                        <SharedWith habitId={habit.id} doneToday={history.find(day => day.date === today)?.completed ?? false} />

                        {habit.description ? <Animated.View layout={transition} style={styles.note}><Text style={[Typography.caption, { color: colors.textTertiary }]}>Your intention</Text><Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>{habit.description}</Text></Animated.View> : null}
                    </>
                </ScrollView>

                {/* Every day since it began, and nothing else. A bar chart of
                    the last week and a ring of today were two more ways of
                    saying what the squares already say. */}
                <ScrollView style={{ width: pageWidth }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Remounted on arrival, so its months and numbers play in when you get there. */}
                    <HabitCalendarMap key={view} history={history} color={accent} startDate={habit.startDate?.slice(0, 10)} today={today} inset={20} />
                </ScrollView>
                </Animated.View>
                </GestureDetector>
            </KeyboardAvoidingView>}

            {habit ? <BottomFade height={64 + 72} /> : null}
            {/* Focus, one tap from the corner: a timed habit starts its timer straight
                away; anything else picks Timer or Stopwatch on the focus page. */}
            {habit && date === today ? (
                <View style={styles.focusCorner}>
                    <IconButton icon="timer" label={`Focus on ${habit.name}`} diameter={56} size={22} color={accent}
                        onPress={() => router.push({ pathname: '/(root)/focus', params: { kind: 'habit', id: habit.id, title: habit.name } })} />
                </View>
            ) : null}
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
