import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { CountUp, PopIn, useProgress } from '@/components/ui/Motion';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeOut, useAnimatedStyle } from 'react-native-reanimated';
import { AppIcon } from '@/components/ui/AppIcon';
import { Segmented } from '@/components/ui/Segmented';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { s, vs, ms } from '@/theme/scale';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useTasks } from '@/hooks/useTasks';
import { useDailyTarget } from '@/hooks/useDailyFocus';
import { focusHistory, focusInsights, type FocusDay } from '@/lib/dailyFocus';
import { onTimeRate } from '@/lib/taskStats';
import { todayKey } from '@/lib/tasks';
import { PAD, styles } from '@/styles/screens/task-stats.styles';

const HEAT_WEEKS = 18;
const HEAT_GAP = 4;
const WEEKDAY_LABELS = ['M', '', 'W', '', 'F', '', ''];

const shortDay = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/**
 * Your tasks, said simply.
 *
 * One number first — how many days you kept your 3 (or 5) — then the shape of
 * it as bars, then every day for four months as a heatmap: a filled square is a
 * day the promise was kept. That is the whole page for anyone who only wants
 * to know how it is going. The rest is one tap away for anyone curious, and
 * never in the way.
 */
export default function TaskStatsScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const light = theme === 'light';
    const { primary } = useAccentGradient();
    const { selectionFeedback } = useHaptics();
    const { width } = useWindowDimensions();

    const tasks = useTasks();
    const target = useDailyTarget();
    const [days, setDays] = useState<30 | 90>(30);
    const [more, setMore] = useState(false);
    const today = todayKey();

    const history = useMemo(() => focusHistory(tasks, target, days, today), [tasks, target, days, today]);
    const insights = useMemo(() => focusInsights(history), [history]);
    const year = useMemo(() => focusHistory(tasks, target, HEAT_WEEKS * 7 + 7, today), [tasks, target, today]);
    const yearInsights = useMemo(() => focusInsights(year), [year]);
    const onTime = useMemo(() => onTimeRate(tasks), [tasks]);

    const open = tasks.filter(task => task.status === 'open');
    const overdue = open.filter(task => task.dueDate && task.dueDate < today).length;
    const everFinished = tasks.filter(task => task.status === 'done').length;
    const idle = light ? 'rgba(15,23,42,0.07)' : 'rgba(255,255,255,0.07)';

    // The heatmap: whole weeks, Monday first, ending with this week.
    const heat = useMemo(() => {
        const byDate = new Map(year.map(day => [day.date, day]));
        const end = new Date(`${today}T12:00:00`);
        const mondayOffset = (end.getDay() + 6) % 7;
        const start = new Date(end);
        start.setDate(end.getDate() - mondayOffset - (HEAT_WEEKS - 1) * 7);
        const weeks: { date: string; day: FocusDay | null; future: boolean }[][] = [];
        for (let week = 0; week < HEAT_WEEKS; week++) {
            const column: { date: string; day: FocusDay | null; future: boolean }[] = [];
            for (let weekday = 0; weekday < 7; weekday++) {
                const when = new Date(start);
                when.setDate(start.getDate() + week * 7 + weekday);
                const key = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}`;
                column.push({ date: key, day: byDate.get(key) ?? null, future: key > today });
            }
            weeks.push(column);
        }
        return weeks;
    }, [year, today]);
    const labelWidth = s(14);
    const cell = Math.floor((width - PAD * 2 - labelWidth - HEAT_GAP * HEAT_WEEKS) / HEAT_WEEKS);

    return (
        <SheetScreen title="Tasks" subtitle={`${target} a day`} onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* One number. */}
                <Animated.View entering={FadeIn.duration(220)} style={styles.hero}>
                    <View style={styles.heroRow}>
                        <CountUp style={[styles.heroValue, { color: colors.textPrimary }]} value={insights.hits} replay={days} />
                        {insights.streak > 0 ? (
                            <View style={[styles.streak, { backgroundColor: '#F9731618' }]}>
                                <AppIcon name="flame" size={s(13)} color="#F97316" />
                                <CountUp style={styles.streakText} value={`${insights.streak} in a row`} replay={days} />
                            </View>
                        ) : null}
                    </View>
                    <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>
                        {insights.finished === 0
                            ? `days you finished ${target}. Do it today and this starts counting.`
                            : `of the last ${insights.days} days you finished ${target} or more · ${insights.rate}%`}
                    </Text>
                </Animated.View>

                {/* The shape of it. */}
                <View style={styles.block}>
                    <Segmented
                        accessibilityLabel="How far back"
                        options={[{ id: 30, label: '30 days' }, { id: 90, label: '90 days' }]}
                        value={days}
                        onChange={value => setDays(value as 30 | 90)}
                    />
                    <Chart replay={days} history={history} target={target} tint={primary} idle={idle} line={colors.textTertiary} />
                    <View style={styles.axis}>
                        <Text style={[styles.axisText, { color: colors.textTertiary }]}>{shortDay(history[0]?.date ?? today)}</Text>
                        <CountUp style={[styles.axisText, { color: colors.textTertiary }]} value={`${insights.perDay} a day`} replay={days} />
                        <Text style={[styles.axisText, { color: colors.textTertiary }]}>Today</Text>
                    </View>
                </View>

                {/* Every day, as a heatmap: filled is a day kept. */}
                <View style={styles.block}>
                    <View style={styles.blockHead}>
                        <Text style={[styles.blockTitle, { color: colors.textPrimary }]}>Days kept</Text>
                        <Text style={[styles.blockMeta, { color: colors.textTertiary }]}><CountUp value={yearInsights.hits} /> in {HEAT_WEEKS} weeks</Text>
                    </View>
                    <View style={styles.heat} accessibilityRole="image" accessibilityLabel={`${yearInsights.hits} days kept in the last ${HEAT_WEEKS} weeks`}>
                        <View style={{ width: labelWidth, gap: HEAT_GAP }}>
                            {WEEKDAY_LABELS.map((label, index) => (
                                <Text key={index} style={[styles.heatLabel, { height: cell, lineHeight: cell, color: colors.textTertiary }]}>{label}</Text>
                            ))}
                        </View>
                        {heat.map((column, index) => (
                            <PopIn key={index} index={index} style={{ gap: HEAT_GAP, marginLeft: HEAT_GAP }}>
                                {column.map(({ date, day, future }) => {
                                    const share = day ? Math.min(1, day.done / Math.max(1, day.target)) : 0;
                                    return (
                                        <View
                                            key={date}
                                            style={{
                                                width: cell, height: cell, borderRadius: Math.max(3, cell * 0.28),
                                                backgroundColor: future ? 'transparent' : day?.hit ? primary : share > 0 ? primary : idle,
                                                opacity: future ? 0 : day?.hit ? 1 : share > 0 ? 0.25 + share * 0.4 : 1,
                                                borderWidth: date === today ? 1.5 : 0,
                                                borderColor: colors.textPrimary,
                                            }}
                                        />
                                    );
                                })}
                            </PopIn>
                        ))}
                    </View>
                    <View style={styles.legend}>
                        <Text style={[styles.axisText, { color: colors.textTertiary }]}>Less</Text>
                        {[0, 0.35, 0.65, 1].map(level => (
                            <View key={level} style={[styles.legendCell, { backgroundColor: level ? primary : idle, opacity: level ? (level === 1 ? 1 : 0.25 + level * 0.4) : 1 }]} />
                        ))}
                        <Text style={[styles.axisText, { color: colors.textTertiary }]}>{target} done</Text>
                    </View>
                </View>

                {/* For the curious. */}
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: more }}
                    onPress={() => { selectionFeedback(); setMore(value => !value); }} style={styles.moreToggle}>
                    <Text style={[styles.moreText, { color: colors.textSecondary }]}>{more ? 'Fewer details' : 'More details'}</Text>
                    <AppIcon name={more ? 'chevron-up' : 'chevron-down'} size={s(14)} color={colors.textSecondary} />
                </Pressable>
                {more ? (
                    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={[styles.details, { borderColor: colors.border }]}>
                        <Row label="Best run" value={`${insights.bestStreak} days`} colors={colors} />
                        <Row label={`Finished in ${insights.days} days`} value={`${insights.finished}`} colors={colors} />
                        <Row label="Finished in all" value={`${everFinished}`} colors={colors} />
                        <Row label="Landed on time" value={onTime === null ? '—' : `${onTime}%`} colors={colors} />
                        <Row label="Still late" value={`${overdue}`} colors={colors} tint={overdue ? colors.error : undefined} />
                        {insights.bestWeekday ? <Row label="Your best day" value={insights.bestWeekday} colors={colors} last /> : null}
                    </Animated.View>
                ) : null}
            </ScrollView>
        </SheetScreen>
    );
}

const Row = ({ label, value, colors, tint, last }: { label: string; value: string; colors: typeof Colors.light; tint?: string; last?: boolean }) => (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
        <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{label}</Text>
        <CountUp style={[styles.rowValue, { color: tint ?? colors.textPrimary }]} value={value} />
    </View>
);

/** A bar per day, solid where the promise was kept, with the promise drawn across. */
const Chart = ({ history, target, tint, idle, line, replay }: { history: FocusDay[]; target: number; tint: string; idle: string; line: string; replay: number }) => {
    const ceiling = Math.max(...history.map(day => day.done), target + 1, 1);
    return (
        <View style={styles.chart} accessibilityRole="image" accessibilityLabel={`${history.filter(day => day.hit).length} of ${history.length} days kept`}>
            <View pointerEvents="none" style={[styles.targetLine, { bottom: `${(target / ceiling) * 100}%`, borderColor: line }]} />
            {history.map((day, index) => (
                <Bar key={day.date} day={day} ceiling={ceiling} index={index} tint={tint} idle={idle} replay={replay} />
            ))}
        </View>
    );
};

const Bar = ({ day, ceiling, index, tint, idle, replay }: { day: FocusDay; ceiling: number; index: number; tint: string; idle: string; replay: number }) => {
    const share = Math.max(day.done / ceiling, 0.035);
    // Grows in on opening and again when switching 30 and 90 days.
    const grown = useProgress(share, index * 5, replay);
    const style = useAnimatedStyle(() => ({ height: `${grown.get() * 100}%` }));
    return (
        <View style={styles.barTrack}>
            <Animated.View style={[styles.bar, style, { backgroundColor: day.done ? tint : idle, opacity: day.hit || !day.done ? 1 : 0.45 }]} />
        </View>
    );
};
