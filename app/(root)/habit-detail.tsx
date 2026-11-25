import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { markSeen } from '@/lib/dayMemory';
import { ActivityIndicator, Alert, AppState, Pressable, Text, View } from 'react-native';
import Animated, { Extrapolation, FadeIn, ReduceMotion, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { DURATION } from '@/theme/motion';
import { useHabitOwner } from '@/hooks/useHabitOwner';
import { useSharedItems } from '@/hooks/useSharedItems';
import { SharedFaces } from '@/components/Common/SharedFaces';
import { waitingLabel, waitingOnOthers } from '@/lib/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { IconButton } from '@/components/ui/IconButton';
import { ShareButton } from '@/components/Common/ShareButton';
import { BottomFade } from '@/components/ui/BottomFade';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { HabitHero, HabitMark, HabitStats, HabitToday } from '@/components/Habit/HabitDetailParts';
import { HabitHeatmap } from '@/components/Habit/HabitHeatmap';
import { HabitConsistency } from '@/components/Habit/HabitConsistency';
import { PeopleFilter } from '@/components/ui/PeopleFilter';
import { useTokens } from '@/hooks/useTokens';
import { consistencyFrom } from '@/lib/habitRecord';
import { friendHistory, peopleColors, togetherHistory } from '@/lib/sharedProgress';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { HabitTracking } from '@/components/Habit/HabitTracking';
import { HabitPhotos } from '@/components/Habit/HabitPhotos';
import { HabitThoughts } from '@/components/Habit/HabitThoughts';
import { useWeekStart } from '@/hooks/useWeekStart';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { habitRecord } from '@/lib/habitRecord';
import { describeSchedule } from '@/lib/goalInsights';
import { getCompletionSources, getCompletionTicks, setSkipped, toggleCompletion } from '@/lib/habitsSQLite';
import { PatternList } from '@/components/Echo/PatternList';
import { useEchoPatterns } from '@/hooks/useEchoPatterns';
import { habitPatterns } from '@/lib/habitPatterns';
import type { TickSource } from '@/lib/tickSource';
import { proveTick } from '@/lib/challengeProof';
import { ShareHabitModal } from '@/components/Social/ShareHabitModal';
import { HabitSheet } from '@/components/Create/HabitSheet';
import { Colors } from '@/theme/colors';
import { Control, Typography } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { Habit, getHabits } from '@/lib/habitsSQLite';
import { historyWindow, loadedData } from '@/lib/dataStore';
import { localHabitDate } from '@/lib/habitMeasurement';
import { isHabitScheduledForDate, parseHabitDate } from '@/lib/habitSchedule';
import { readableAccent } from '@/lib/colorContrast';
import { on } from '@/lib/appEvents';
import { styles } from '@/styles/screens/habit-detail.styles';
import { oopsTitle } from '@/lib/voice';

const param = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
type HistoryDay = { date: string; completed: boolean; skipped: boolean; scheduled: boolean };

/**
 * A habit, whole: its face (icon in a ring of how much of this week is kept,
 * its name, how it repeats, the goal it serves), today as one big button with
 * skip and focus beside it, its four numbers, this week day by day, what the
 * record says, every day since it began, and its settings, each a tap from
 * being changed. Stopping or deleting it is at the very bottom.
 */
export default function HabitDetailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ habitId?: string }>();
    const habitId = param(params.habitId);
    // Opened: the timeline's "moved" dot on it goes until it moves again.
    useEffect(() => { if (habitId) markSeen(habitId); }, [habitId]);
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary: accentSolid } = useAccentGradient();
    const { lightFeedback, selectionFeedback } = useHaptics();
    const [today, setToday] = useState(localHabitDate);
    const [habit, setHabit] = useState<Habit | null>(null);
    const [loading, setLoading] = useState(!!habitId);
    const [error, setError] = useState<string | null>(null);
    const [history, setHistory] = useState<HistoryDay[]>([]);
    // When it was ticked and what logged it, for its patterns.
    const [ticks, setTicks] = useState<{ date: string; at: string }[]>([]);
    const [sources, setSources] = useState<Record<string, TickSource>>({});
    const [showEditor, setShowEditor] = useState(false);
    const [showShare, setShowShare] = useState(false);
    /**
     * Whether this habit is yours to change: whoever offered a shared habit
     * owns what it is (lib/sharedAdopt.ts), so only they can edit or share it.
     * The buttons wait until that is known, so they never swap.
     */
    const { owner, known: ownerKnown } = useHabitOwner(habitId);

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
            const found = (await getHabits()).find(item => item.id === habitId) || null;
            if (!mounted.current || request !== generation.current) return;
            setHabit(found);
            if (!found) return;
            const days = (await loadedData().then(data => historyWindow(366, data).rows));
            if (!mounted.current || request !== generation.current) return;
            // Whether the day asked for the habit at all, so a day off is not drawn as a miss.
            setHistory(days.map(day => {
                const when = parseHabitDate(day.date);
                return {
                    date: day.date,
                    completed: day.completedIds.includes(habitId),
                    skipped: (day.skippedIds ?? []).includes(habitId),
                    scheduled: when ? isHabitScheduledForDate(found, when) : true,
                };
            }));
            setError(null);
            const [allTicks, logged] = await Promise.all([getCompletionTicks(90), getCompletionSources(habitId, 90)]);
            if (!mounted.current || request !== generation.current) return;
            setTicks(allTicks.filter(tick => tick.habitId === habitId));
            setSources(logged);
        } catch {
            if (mounted.current && request === generation.current) setError('Couldn’t load this habit. Tap retry to try again.');
        } finally {
            if (mounted.current && request === generation.current) setLoading(false);
        }
    }, [habitId]);

    useEffect(() => {
        void load();
        const update = on('habit_completion_updated', ({ habitId: id }) => { if (id === undefined || id === habitId) void load(); });
        const edit = on('habit_updated', ({ habitId: id }) => { if (id === undefined || id === habitId) void load(); });
        return () => { generation.current++; update.remove(); edit.remove(); };
    }, [habitId, load]);

    const [goals, setGoals] = useState<Habit[]>([]);
    useEffect(() => { void getHabits().then(all => setGoals(all.filter(item => item.isGoal))).catch(() => undefined); }, []);
    const weekStartsMonday = useWeekStart() === 'monday';
    const record = useMemo(() => habitRecord(history, today, habit?.startDate?.slice(0, 10), weekStartsMonday), [history, today, habit?.startDate, weekStartsMonday]);
    const echoPatterns = useEchoPatterns();
    const patterns = useMemo(() => (habitId ? habitPatterns({ habitId, days: history, ticks, sources, global: echoPatterns, today }) : []),
        [habitId, history, ticks, sources, echoPatterns, today]);
    const todayDay = history.find(day => day.date === today);
    const doneToday = !!todayDay?.completed;
    // Shared: the friends on it beside the buttons, ringed once they have done
    // today's (the same faces and rings as on the timeline). Yours from your tick.
    const sharedIds = useMemo(() => (habitId ? [habitId] : []), [habitId]);
    const sharedDone = useMemo(() => (habitId ? { [habitId]: doneToday } : {}), [habitId, doneToday]);
    const { stateFor: sharedFor } = useSharedItems(sharedIds, sharedDone);
    const shared = habitId ? sharedFor(habitId) : null;
    // A shared habit, person by person (lib/sharedProgress.ts): each person in a
    // colour of their own, their ticks from the server, all of you together.
    const tokens = useTokens();
    const [viewer, setViewer] = useState('all');
    const [friendTicks, setFriendTicks] = useState<Record<string, Set<string>>>({});
    const sharedPeopleKey = shared ? shared.people.filter(person => !person.pending).map(person => person.userId).join(',') : '';
    useEffect(() => {
        if (!habitId || !sharedPeopleKey) return;
        let alive = true;
        void (require('@/lib/friendsService') as typeof import('@/lib/friendsService')).FriendsService.sharedCompletions(habitId)
            .then(ticks => { if (alive) setFriendTicks(ticks); }).catch(() => undefined);
        return () => { alive = false; };
    }, [habitId, sharedPeopleKey, doneToday]);
    const people = useMemo(() => {
        if (!shared || !sharedPeopleKey) return [];
        const agreed = shared.people.filter(person => !person.pending);
        const colors = peopleColors(habit?.color || accentSolid, [tokens.color.cobalt, tokens.color.success, tokens.color.warning, tokens.color.danger, tokens.color.silver], agreed.length);
        return agreed.map((person, index) => ({
            id: person.userId, name: person.isYou ? 'You' : person.username, color: colors[index], avatarUrl: person.avatarUrl, you: person.isYou,
            history: person.isYou ? history : friendHistory(history, friendTicks[person.userId] ?? new Set()),
        }));
        // `sharedPeopleKey` stands for who is on it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sharedPeopleKey, history, friendTicks, habit?.color, accentSolid, tokens]);
    const startKey = habit?.startDate?.slice(0, 10);
    // Where the heat map and the line begin, on the left: the day you made it
    // (or the start date, if that is earlier).
    const fromKey = [habit?.createdAt?.slice(0, 10), startKey].filter((day): day is string => !!day && /^\d{4}-\d{2}-\d{2}$/.test(day)).sort()[0] ?? startKey;
    const chosen = people.find(person => person.id === viewer);
    const shownHistory = !people.length ? history : chosen ? chosen.history : togetherHistory(people.map(person => person.history));
    const shownColor = chosen?.color ?? (habit?.color || accentSolid);
    const series = useMemo(() => (people.length && !chosen
        ? people.map(person => ({ id: person.id, name: person.name, color: person.color, points: consistencyFrom(person.history, today, fromKey, 0) }))
        : [{ id: chosen?.id ?? 'me', name: chosen?.name ?? 'You', color: shownColor, points: consistencyFrom(chosen?.history ?? history, today, fromKey, 0) }]),
    [people, chosen, history, today, fromKey, shownColor]);
    const skippedToday = !!todayDay?.skipped;
    const scheduledToday = todayDay ? todayDay.scheduled : true;
    const weekDue = record.week.filter(day => day.state !== 'off' && day.state !== 'future');
    const weekShare = weekDue.length ? weekDue.filter(day => day.state === 'done').length / weekDue.length : 0;
    const { playComplete } = useSoundEffects();
    // Ticked here, it shows at once; the store catches up behind it.
    const patchToday = (patch: Partial<HistoryDay>) => setHistory(days => {
        const found = days.some(day => day.date === today);
        return found ? days.map(day => (day.date === today ? { ...day, ...patch } : day))
            : [...days, { date: today, completed: false, skipped: false, scheduled: true, ...patch }];
    });
    const markDone = async () => {
        if (!habit) return;
        const next = !doneToday;
        if (next && !(await proveTick({ kind: 'habit', habit }, today))) return;
        if (next) { playComplete(); selectionFeedback(); } else lightFeedback();
        patchToday({ completed: next, skipped: false });
        toggleCompletion(habit.id, today).catch(() => { patchToday({ completed: !next }); Alert.alert(oopsTitle(), 'That check-in could not be saved. Try again.'); });
    };
    const skip = () => {
        if (!habit) return;
        lightFeedback();
        patchToday({ skipped: !skippedToday });
        setSkipped(habit.id, !skippedToday, today).catch(() => patchToday({ skipped: skippedToday }));
    };
    // As the page scrolls, its big name and icon shrink and fade, and the
    // header's title fades in to take their place.
    const scrollY = useSharedValue(0);
    const onScroll = useAnimatedScrollHandler(event => { scrollY.value = event.contentOffset.y; });
    const headerTitle = useAnimatedStyle(() => ({
        opacity: interpolate(scrollY.value, [110, 170], [0, 1], Extrapolation.CLAMP),
        transform: [{ translateY: interpolate(scrollY.value, [110, 170], [8, 0], Extrapolation.CLAMP) }],
    }));
    const heroFade = useAnimatedStyle(() => ({
        opacity: interpolate(scrollY.value, [0, 150], [1, 0], Extrapolation.CLAMP),
        transform: [{ translateY: interpolate(scrollY.value, [0, 150], [0, -12], Extrapolation.CLAMP) }],
    }));
    const focus = () => { if (habit) void (require('@/lib/openFocus') as typeof import('@/lib/openFocus')).openFocus({ kind: 'habit', id: habit.id, title: habit.name }); };

    const accent = habit?.color || accentSolid;
    const ink = readableAccent(accent, colors.surfaceSecondary);
    // The same words as everywhere else (describeSchedule), so the header never disagrees with the card.
    const schedule = habit ? describeSchedule(habit) : undefined;

    return (
        <SheetScreen
            title={habit?.name || 'Habit'}
            subtitle={schedule}
            titleStyle={habit ? headerTitle : undefined}
            // No close button: the sheet swipes down. Scrolled, its icon and name
            // sit at the top from the left, where the big ones were.
            leading={habit ? <HabitMark icon={habit.icon} color={habit.color || accentSolid} /> : undefined}
            onBack={habit ? undefined : () => router.back()}
            backIcon="close"
            rightSlot={habit && ownerKnown ? <Animated.View entering={FadeIn.duration(DURATION.quick).reduceMotion(ReduceMotion.System)} style={styles.headerActions}>
                {shared ? <View style={styles.faces}><SharedFaces people={shared.people} tint={accent} size={Control.hitTarget} othersOnly /></View> : null}
                {owner.mine ? <ShareButton variant="friend" onPress={() => setShowShare(true)} /> : null}
                {!owner.mine ? (
                    <IconButton
                        icon="lock-closed-outline"
                        label={`${owner.name} set this habit up, so only they can change it`}
                        onPress={() => { lightFeedback(); Alert.alert(`${owner.name}'s habit`, 'Only they can edit it.'); }}
                    />
                ) : (
                    <IconButton icon="pencil-outline" label="Edit habit" onPress={() => { selectionFeedback(); setShowEditor(true); }} />
                )}
            </Animated.View> : undefined}
        >
            {!habit ? <View style={styles.empty}>
                {loading ? <ActivityIndicator color={accent} /> : <><Text style={[Typography.body, { color: colors.textSecondary }]}>{error || 'This habit is unavailable.'}</Text><Pressable onPress={error ? load : () => router.back()} style={styles.retry} accessibilityRole="button"><Text style={[Typography.button, { color: ink }]}>{error ? 'Retry' : 'Go back'}</Text></Pressable></>}
            </View> : (
                <Animated.ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16}>
                    <Animated.View style={heroFade}>
                    <HabitHero icon={habit.icon} name={habit.name} schedule={describeSchedule(habit)} color={accent} weekShare={weekShare}
                        goalName={goals.find(goal => goal.id === habit.goalId)?.name}
                        onGoal={habit.goalId ? () => router.push({ pathname: '/goal-detail', params: { goalId: habit.goalId! } }) : undefined} />
                    </Animated.View>
                    <HabitToday done={doneToday} skipped={skippedToday} scheduled={scheduledToday} color={accent} onDone={markDone} onSkip={skip} onFocus={focus}
                        waiting={shared && waitingOnOthers(shared, doneToday) ? waitingLabel(shared) : null} />
                    <HabitTracking habit={habit} color={accent} />
                    <HabitStats record={record} color={accent} />

                    {/* How it has gone, day by day: the heat map. */}
                    <View>
                        <SectionTitle first>Progress</SectionTitle>
                        {/* Shared: everyone together, or one of you at a time. */}
                        {people.length > 1 ? (
                            <View style={styles.people}>
                                <PeopleFilter people={people} value={viewer} onChange={setViewer} allColor={accent} />
                            </View>
                        ) : null}
                        <HabitHeatmap history={shownHistory} color={shownColor} startDate={startKey} from={fromKey} today={today} replay={viewer} />
                    </View>
                    {/* And how steady: each day's rolling week kept, over eight weeks. */}
                    <View>
                        <SectionTitle first>Consistency</SectionTitle>
                        <HabitConsistency series={series} replay={viewer} />
                    </View>
                    {/* How it goes, not just how often: its weekdays, its hours, what a miss does, how it is logged. */}
                    <PatternList patterns={patterns} title="Patterns" limit={6}
                        empty="Patterns show up here after a few weeks of check-ins." />
                    {/* The photos taken as it was ticked. */}
                    <HabitThoughts habitId={habit.id} />
                    <HabitPhotos habitId={habit.id} />
                </Animated.ScrollView>
            )}

            {habit ? <BottomFade height={64} /> : null}

            {showEditor && habit && <HabitSheet visible onClose={() => setShowEditor(false)} habit={habit} goalId={habit.goalId} onSaved={load} />}
            {habit && habitId && <ShareHabitModal visible={showShare} habitId={habitId} habitName={habit.name} onClose={() => setShowShare(false)} />}
        </SheetScreen>
    );
}
