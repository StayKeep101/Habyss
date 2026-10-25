import React, { useCallback, useEffect, useRef, useState } from 'react';
import { markSeen } from '@/lib/dayMemory';
import { ActivityIndicator, Alert, AppState, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { IconButton } from '@/components/ui/IconButton';
import { ShareButton } from '@/components/Common/ShareButton';
import { BottomFade } from '@/components/ui/BottomFade';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { HabitCalendarMap } from '@/components/Habit/HabitCalendarMap';
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
 * A habit, as its record: every day since it began, filled where it was done,
 * and the focus button in the corner. Ticking happens where the habit is (the
 * timeline, Home, a widget, the watch); this page is for seeing how it goes.
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

    const accent = habit?.color || accentSolid;
    const ink = readableAccent(accent, colors.surfaceSecondary);
    const schedule = habit
        ? `${habit.frequency === 'daily' || !habit.frequency ? 'Daily' : habit.frequency.charAt(0).toUpperCase() + habit.frequency.slice(1)}${habit.startTime ? ` · ${habit.startTime}` : ' · Anytime'}`
        : undefined;

    return (
        <SheetScreen
            title={habit?.name || 'Habit'}
            subtitle={schedule}
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
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    <HabitCalendarMap history={history} color={accent} startDate={habit.startDate?.slice(0, 10)} today={today} inset={20} />
                </ScrollView>
            )}

            {habit ? <BottomFade height={96} /> : null}
            {/* Focus, one tap from the corner: a timed habit starts its timer straight
                away; anything else picks Timer or Stopwatch on the focus page. */}
            {habit ? (
                <View style={styles.focusCorner}>
                    <IconButton icon="timer" label={`Focus on ${habit.name}`} diameter={56} size={22} color={accent}
                        onPress={() => router.push({ pathname: '/(root)/focus', params: { kind: 'habit', id: habit.id, title: habit.name } })} />
                </View>
            ) : null}

            {showEditor && habit && <HabitSheet visible onClose={() => setShowEditor(false)} habit={habit} goalId={habit.goalId} onSaved={load} />}
            {habit && habitId && <ShareHabitModal visible={showShare} habitId={habitId} habitName={habit.name} onClose={() => setShowShare(false)} />}
        </SheetScreen>
    );
}
