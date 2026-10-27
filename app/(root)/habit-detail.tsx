import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { markSeen } from '@/lib/dayMemory';
import { ActivityIndicator, Alert, AppState, Pressable, Text, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { IconButton } from '@/components/ui/IconButton';
import { ShareButton } from '@/components/Common/ShareButton';
import { BottomFade } from '@/components/ui/BottomFade';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { HabitHero, HabitStats, HabitToday } from '@/components/Habit/HabitDetailParts';
import { HabitHeatmap } from '@/components/Habit/HabitHeatmap';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { useWeekStart } from '@/hooks/useWeekStart';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { habitRecord } from '@/lib/habitRecord';
import { describeSchedule } from '@/lib/goalInsights';
import { formatDuration } from '@/lib/habitMeasurement';
import { setSkipped, toggleCompletion } from '@/lib/habitsSQLite';
import { ShareHabitModal } from '@/components/Social/ShareHabitModal';
import { HabitSheet } from '@/components/Create/HabitSheet';
import { Colors } from '@/theme/colors';
import { Typography } from '@/theme/designSystem';
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
    const [showEditor, setShowEditor] = useState(false);
    const [showShare, setShowShare] = useState(false);
    /**
     * Whether this habit is yours to change: whoever offered a shared habit
     * owns what it is (lib/sharedAdopt.ts), so only they can edit or share it.
     */
    const [owner, setOwner] = useState<{ name: string; mine: boolean } | null>(null);
    useEffect(() => {
        if (!habitId) return;
        let alive = true;
        (async () => {
            const { FriendsService } = require('@/lib/friendsService') as typeof import('@/lib/friendsService');
            const rows = await FriendsService.getSharedItemParticipants(habitId, 'habit').catch(() => []);
            if (!alive || rows.length < 2) return;
            const found = (rows as { isOwner?: boolean; isYou?: boolean; username?: string }[]).find(row => row.isOwner);
            if (!found) return;
            setOwner({ name: found.isYou ? 'You' : (found.username ?? 'A friend'), mine: !!found.isYou });
        })().catch(() => undefined);
        return () => { alive = false; };
    }, [habitId]);

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
    const todayDay = history.find(day => day.date === today);
    const doneToday = !!todayDay?.completed;
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
    const markDone = () => {
        if (!habit) return;
        const next = !doneToday;
        if (next) { playComplete(); selectionFeedback(); } else lightFeedback();
        patchToday({ completed: next, skipped: false });
        toggleCompletion(habit.id, today).catch(() => { patchToday({ completed: !next }); Alert.alert('Not saved', 'That check-in could not be saved. Try again.'); });
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
        transform: [{ scale: interpolate(scrollY.value, [-80, 0, 150], [1.06, 1, 0.88], Extrapolation.CLAMP) }],
    }));
    const focus = () => { if (habit) router.push({ pathname: '/(root)/focus', params: { kind: 'habit', id: habit.id, title: habit.name } }); };

    const accent = habit?.color || accentSolid;
    const ink = readableAccent(accent, colors.surfaceSecondary);
    const schedule = habit
        ? `${habit.frequency === 'daily' || !habit.frequency ? 'Daily' : habit.frequency.charAt(0).toUpperCase() + habit.frequency.slice(1)}${habit.startTime ? ` · ${habit.startTime}` : ' · Anytime'}`
        : undefined;

    return (
        <SheetScreen
            title={habit?.name || 'Habit'}
            subtitle={schedule}
            titleStyle={habit ? headerTitle : undefined}
            onBack={() => router.back()}
            rightSlot={habit ? <View style={styles.headerActions}>
                {owner && !owner.mine ? null : <ShareButton variant="friend" onPress={() => setShowShare(true)} />}
                {owner && !owner.mine ? (
                    <IconButton
                        icon="lock-closed-outline"
                        label={`${owner.name} set this habit up, so only they can change it`}
                        onPress={() => { lightFeedback(); Alert.alert(`${owner.name}'s habit`, 'Only they can edit it.'); }}
                    />
                ) : (
                    <IconButton icon="pencil-outline" label="Edit habit" onPress={() => { selectionFeedback(); setShowEditor(true); }} />
                )}
            </View> : undefined}
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
                    <HabitToday done={doneToday} skipped={skippedToday} scheduled={scheduledToday} color={accent} onDone={markDone} onSkip={skip} onFocus={focus} />
                    <HabitStats record={record} color={accent} />

                    <View>
                        <SectionTitle first>Every day</SectionTitle>
                        <HabitHeatmap history={history} color={accent} startDate={habit.startDate?.slice(0, 10)} today={today} />
                    </View>

                    {owner && !owner.mine ? null : (
                        <View>
                            <SectionTitle first>Settings</SectionTitle>
                            <SettingsGroup>
                                <SettingsRow icon="repeat" color={accent} label="Repeats" value={describeSchedule(habit).split(' · ')[0]} onPress={() => { selectionFeedback(); setShowEditor(true); }} />
                                <SettingsRow icon="time" color="#FF9F0A" label="Time" value={habit.startTime ? `${habit.startTime}${habit.durationMinutes ? ` · ${formatDuration(habit.durationMinutes * 60, true)}` : ''}` : 'Any time'} onPress={() => { selectionFeedback(); setShowEditor(true); }} />
                                <SettingsRow icon="notifications" color="#FF453A" label="Reminders" value={habit.reminders?.length ? habit.reminders.join(', ') : 'None'} onPress={() => { selectionFeedback(); setShowEditor(true); }} />
                                {habit.startDate ? <SettingsRow icon="calendar" color="#30D158" label="Started" value={new Date(`${habit.startDate.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} /> : null}
                            </SettingsGroup>
                        </View>
                    )}
                </Animated.ScrollView>
            )}

            {habit ? <BottomFade height={64} /> : null}

            {showEditor && habit && <HabitSheet visible onClose={() => setShowEditor(false)} habit={habit} goalId={habit.goalId} onSaved={load} />}
            {habit && habitId && <ShareHabitModal visible={showShare} habitId={habitId} habitName={habit.name} onClose={() => setShowShare(false)} />}
        </SheetScreen>
    );
}
