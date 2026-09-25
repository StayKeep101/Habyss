import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { Easing, FadeIn, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { AppIcon } from '@/components/Common/AppIcon';
import { SheetScreen } from '@/components/Layout/SheetScreen';
import { VoidCard } from '@/components/Layout/VoidCard';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/DesignSystem';
import { s, vs, ms } from '@/constants/Layout';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useTasks } from '@/hooks/useTasks';
import { useDailyTarget } from '@/hooks/useDailyFocus';
import { focusHistory, focusInsights, type FocusDay } from '@/lib/dailyFocus';
import { onTimeRate } from '@/lib/taskStats';
import { todayKey } from '@/lib/tasks';

const WINDOWS = [
    { id: 30, label: '30 days' },
    { id: 90, label: '90 days' },
] as const;

const shortDay = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** The glass the home cards are made of, so this page reads as their inside. */
type Surface = { glass: boolean; intensity: number; tint: { backgroundColor: string } | null };

/**
 * What the day's promise has actually been worth.
 *
 * One question answered first and in the largest type — how often the promise
 * was kept — because that is the only number that says whether the habit of
 * finishing is forming. Everything under it explains that number: the run of
 * days, the shape of the last month, and the few facts about tasks that habits
 * cannot have.
 *
 * Dressed like the card it opens from: the same glass surface, the same
 * letter-spaced headings, and type scaled with the screen rather than fixed.
 */
export default function TaskStatsScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const isTrueDark = theme === 'trueDark';
    const { primary } = useAccentGradient();
    const { selectionFeedback } = useHaptics();

    const tasks = useTasks();
    const target = useDailyTarget();
    const [days, setDays] = useState<number>(30);
    const today = todayKey();

    const surface: Surface = {
        glass: !isTrueDark,
        intensity: isLight ? 20 : 80,
        tint: isLight ? { backgroundColor: colors.surfaceSecondary } : null,
    };

    const history = useMemo(() => focusHistory(tasks, target, days, today), [tasks, target, days, today]);
    const insights = useMemo(() => focusInsights(history), [history]);
    const onTime = useMemo(() => onTimeRate(tasks), [tasks]);

    const open = tasks.filter(task => task.status === 'open');
    const overdue = open.filter(task => task.dueDate && task.dueDate < today).length;
    const everFinished = tasks.filter(task => task.status === 'done').length;

    return (
        <SheetScreen title="Your tasks" subtitle={`${target} a day`} onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* How often the promise was kept. */}
                <Animated.View entering={FadeIn.duration(220)}>
                    <VoidCard glass={surface.glass} intensity={surface.intensity} style={[styles.hero, surface.tint]}>
                        {/* A blunt 0% is only fair once there is something to be
                            0% of; before that it reads as a verdict on someone
                            who has not started yet. */}
                        <Text style={[styles.heroValue, { color: colors.textPrimary }]}>
                            {insights.finished === 0 ? `${target}` : `${insights.rate}%`}
                        </Text>
                        <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>
                            {insights.finished === 0
                                ? `things a day is the promise. Finish ${target} today and this fills in.`
                                : `of the last ${insights.days} days you finished ${target} or more`}
                        </Text>
                        <View style={[styles.heroSplit, { borderTopColor: colors.border }]}>
                            <Stat label="Days kept" value={`${insights.hits}`} colors={colors} />
                            <Stat label="On a run" value={`${insights.streak}`} colors={colors} divider />
                            <Stat label="Best run" value={`${insights.bestStreak}`} colors={colors} divider />
                        </View>
                    </VoidCard>
                </Animated.View>

                {/* The shape of it, day by day. */}
                <View style={styles.sectionHead}>
                    <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>EVERY DAY</Text>
                    <View style={styles.windows}>
                        {WINDOWS.map(window => {
                            const on = window.id === days;
                            return (
                                <Pressable
                                    key={window.id}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: on }}
                                    onPress={() => { selectionFeedback(); setDays(window.id); }}
                                    style={[styles.window, {
                                        backgroundColor: on ? primary + '20' : 'transparent',
                                        borderColor: on ? primary + '55' : colors.border,
                                    }]}
                                >
                                    <Text style={[styles.windowText, { color: on ? primary : colors.textSecondary }]}>{window.label}</Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>

                <VoidCard glass={surface.glass} intensity={surface.intensity} style={[styles.chartCard, surface.tint]}>
                    <Chart history={history} tint={primary} success={colors.success} idle={isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.09)'} />
                    <View style={styles.chartFoot}>
                        <Text style={[styles.foot, { color: colors.textTertiary }]}>{shortDay(history[0]?.date ?? today)}</Text>
                        <Text style={[styles.foot, { color: colors.textTertiary }]}>
                            {insights.perDay} a day on average
                        </Text>
                        <Text style={[styles.foot, { color: colors.textTertiary }]}>Today</Text>
                    </View>
                </VoidCard>

                {/* The things only tasks can be measured on. */}
                <Text style={[styles.sectionLabel, styles.sectionTop, { color: colors.textTertiary }]}>WHAT IT ADDS UP TO</Text>
                <View style={styles.grid}>
                    <Tile icon="checkmark-done-outline" value={`${insights.finished}`} label={`finished in ${insights.days} days`} colors={colors} tint={primary} surface={surface} />
                    <Tile icon="trophy-outline" value={`${everFinished}`} label="finished in all" colors={colors} tint={primary} surface={surface} />
                    <Tile
                        icon="time-outline"
                        value={onTime === null ? '—' : `${onTime}%`}
                        label={onTime === null ? 'nothing dated yet' : 'landed on time'}
                        colors={colors}
                        tint={primary}
                        surface={surface}
                    />
                    <Tile
                        icon="alert-circle-outline"
                        value={`${overdue}`}
                        label="still late"
                        colors={colors}
                        tint={overdue > 0 ? colors.error : primary}
                        surface={surface}
                    />
                </View>

                {insights.bestWeekday ? (
                    <VoidCard glass={surface.glass} intensity={surface.intensity} style={[styles.note, surface.tint]}>
                        <AppIcon name="calendar-outline" size={s(16)} color={primary} />
                        <Text style={[styles.noteText, { color: colors.textSecondary }]}>
                            <Text style={{ color: colors.textPrimary, fontFamily: FontFamily.medium }}>{insights.bestWeekday}</Text>
                            {' '}is the day you keep most often.
                        </Text>
                    </VoidCard>
                ) : null}

            </ScrollView>
        </SheetScreen>
    );
}

const Stat = ({ label, value, colors, divider }: { label: string; value: string; colors: typeof Colors.light; divider?: boolean }) => (
    <View style={[styles.stat, divider && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border }]}>
        <Text style={[styles.statValue, { color: colors.textPrimary }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
);

const Tile = ({ icon, value, label, colors, tint, surface }: {
    icon: any; value: string; label: string; colors: typeof Colors.light; tint: string; surface: Surface;
}) => (
    <VoidCard glass={surface.glass} intensity={surface.intensity} style={[styles.tile, surface.tint]}>
        <AppIcon name={icon} size={s(16)} color={tint} />
        <Text style={[styles.tileValue, { color: colors.textPrimary }]}>{value}</Text>
        <Text style={[styles.tileLabel, { color: colors.textSecondary }]}>{label}</Text>
    </VoidCard>
);

/** A bar per day, full where the promise was kept. */
const Chart = ({ history, tint, success, idle }: { history: FocusDay[]; tint: string; success: string; idle: string }) => {
    const ceiling = Math.max(...history.map(day => day.done), history[0]?.target ?? 3, 1);
    return (
        <View style={styles.chart} accessibilityRole="image" accessibilityLabel={`${history.filter(day => day.hit).length} of ${history.length} days kept`}>
            {history.map((day, index) => (
                <Bar key={day.date} day={day} ceiling={ceiling} index={index} tint={tint} success={success} idle={idle} />
            ))}
        </View>
    );
};

const Bar = ({ day, ceiling, index, tint, success, idle }: {
    day: FocusDay; ceiling: number; index: number; tint: string; success: string; idle: string;
}) => {
    const grown = useSharedValue(0);
    const share = Math.max(day.done / ceiling, day.done > 0 ? 0.12 : 0.04);
    React.useEffect(() => {
        grown.value = withDelay(index * 6, withTiming(share, { duration: 420, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
    }, [share, index, grown]);
    const style = useAnimatedStyle(() => ({ height: `${grown.value * 100}%` }));
    return (
        <View style={styles.barTrack}>
            <Animated.View style={[styles.bar, style, { backgroundColor: day.hit ? success : day.done > 0 ? tint : idle }]} />
        </View>
    );
};

const styles = StyleSheet.create({
    content: { paddingHorizontal: s(20), paddingBottom: vs(40), gap: vs(12) },
    hero: { padding: s(20), gap: vs(4) },
    heroValue: { fontFamily: FontFamily.bold, fontSize: ms(46), lineHeight: ms(54), letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
    heroLabel: { fontSize: ms(13), lineHeight: ms(19), fontFamily: FontFamily.regular },
    heroSplit: { flexDirection: 'row', marginTop: vs(14), paddingTop: vs(14), borderTopWidth: StyleSheet.hairlineWidth },
    stat: { flex: 1, alignItems: 'center', gap: vs(2) },
    statValue: { fontFamily: FontFamily.bold, fontSize: ms(20), lineHeight: ms(26), fontVariant: ['tabular-nums'] },
    statLabel: { fontSize: ms(10), lineHeight: ms(15), fontFamily: FontFamily.regular, textAlign: 'center' },
    // The heading the home cards use: bold, wide, and quiet in colour.
    sectionLabel: { fontSize: ms(11), lineHeight: ms(16), letterSpacing: 1.5, fontFamily: FontFamily.bold },
    sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: vs(10) },
    sectionTop: { marginTop: vs(10) },
    windows: { flexDirection: 'row', gap: s(6) },
    window: { paddingHorizontal: s(11), paddingVertical: vs(6), borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
    windowText: { fontSize: ms(11), fontFamily: FontFamily.medium },
    chartCard: { padding: s(16), gap: vs(10) },
    chart: { flexDirection: 'row', alignItems: 'flex-end', gap: s(2), height: vs(92) },
    barTrack: { flex: 1, height: '100%', justifyContent: 'flex-end' },
    bar: { width: '100%', borderRadius: s(3), minHeight: vs(3) },
    chartFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    foot: { fontSize: ms(10), lineHeight: ms(15), fontFamily: FontFamily.regular },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: s(10) },
    tile: { width: '47.8%', flexGrow: 1, padding: s(16), gap: vs(3) },
    tileValue: { fontFamily: FontFamily.bold, fontSize: ms(24), lineHeight: ms(30), fontVariant: ['tabular-nums'] },
    tileLabel: { fontSize: ms(11), lineHeight: ms(16), fontFamily: FontFamily.regular },
    note: { flexDirection: 'row', alignItems: 'center', gap: s(10), padding: s(16) },
    noteText: { flex: 1, fontSize: ms(13), lineHeight: ms(19), fontFamily: FontFamily.regular },
});
