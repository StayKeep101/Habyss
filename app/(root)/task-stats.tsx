import React, { useMemo, useState } from 'react';
import { Text, View, ScrollView } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useScrub } from '@/hooks/useScrub';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { CountUp, useProgress } from '@/components/ui/Motion';
import { AppIcon } from '@/components/ui/AppIcon';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { VoidCard } from '@/components/ui/VoidCard';
import { ValuePill } from '@/components/ui/ValuePill';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useTasks } from '@/hooks/useTasks';
import { useDailyTarget } from '@/hooks/useDailyFocus';
import { focusHistory, focusInsights, weekTarget } from '@/lib/dailyFocus';
import { WeekTargetStrip } from '@/components/Tasks/WeekTargetStrip';
import { onTimeRate, weekChange, weeklyDone, type WeekDone } from '@/lib/taskStats';
import { isLate, todayKey } from '@/lib/tasks';
import { styles } from '@/styles/screens/task-stats.styles';

const WEEKS = 8;
/** The space between bars; the scrub needs it to know which bar a finger is on. */
const CHART_GAP = 8;
const shortDay = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/**
 * Are you getting better? One page, one answer.
 *
 * The big number is how many tasks you finished this week, and beside it
 * whether that is more or less than at this point last week. Underneath, one
 * bar per week for two months, so the trend is a shape you can see. Drag a
 * finger across the bars to read any week. Then four plain numbers.
 */
export default function TaskStatsScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();

    const tasks = useTasks();
    const target = useDailyTarget();
    const today = todayKey();

    const weeks = useMemo(() => weeklyDone(tasks, today, WEEKS), [tasks, today]);
    const change = useMemo(() => weekChange(tasks, today), [tasks, today]);
    const focus = useMemo(() => focusInsights(focusHistory(tasks, target, 60, today)), [tasks, target, today]);
    const onTime = useMemo(() => onTimeRate(tasks), [tasks]);
    const late = tasks.filter(task => isLate(task, today)).length;
    const best = Math.max(0, ...weeks.map(week => week.done));

    // The week under the finger while it is on the chart; this week otherwise.
    const [picked, setPicked] = useState<number | null>(null);
    const shown = picked === null ? null : weeks[picked];
    // The days of the week on show (the one under the finger, else this one) against the daily 3 or 5.
    const weekDays = useMemo(() => weekTarget(tasks, target, (shown ?? weeks[weeks.length - 1]).start, today), [tasks, target, shown, weeks, today]);

    const up = change.change > 0;
    const down = change.change < 0;
    const trendColor = up ? colors.success : down ? colors.error : colors.textTertiary;

    return (
        <SheetScreen title="Tasks" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} scrollEnabled={picked === null}>
                {/* The answer. */}
                <View style={styles.hero}>
                    <CountUp style={[styles.heroValue, { color: colors.textPrimary }]} value={shown ? shown.done : change.thisWeek} />
                    {shown ? (
                        <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>
                            {picked === WEEKS - 1 ? 'This week' : `Week of ${shortDay(shown.start)}`}
                        </Text>
                    ) : (
                        <View style={styles.trendRow}>
                            <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>done this week</Text>
                            <View style={[styles.trend, { borderColor: trendColor }]}>
                                <AppIcon name={up ? 'arrow-up' : down ? 'arrow-down' : 'remove'} size={12} color={trendColor} />
                                <Text style={[styles.trendText, { color: trendColor }]}>
                                    {change.change === 0 ? 'Same as last week' : `${Math.abs(change.change)} vs last week`}
                                </Text>
                            </View>
                        </View>
                    )}
                </View>

                <WeekChart weeks={weeks} tint={primary} idle={colors.border} picked={picked} onPick={setPicked} />
                <View style={styles.axis}>
                    <Text style={[styles.axisText, { color: colors.textTertiary }]}>{shortDay(weeks[0].start)}</Text>
                    <Text style={[styles.axisText, { color: colors.textTertiary }]}>Now</Text>
                </View>

                <WeekTargetStrip days={weekDays} today={today} />

                <View>
                    <SectionTitle first>Numbers</SectionTitle>
                    <VoidCard style={styles.list}>
                        <NumberRow label="Days in a row" value={`${focus.streak}`} />
                        <NumberRow label="Best week" value={`${best}`} />
                        <NumberRow label="On time" value={onTime === null ? '—' : `${onTime}%`} />
                        <NumberRow label="Late" value={`${late}`} tone={late ? colors.error : undefined} />
                    </VoidCard>
                </View>
            </ScrollView>
        </SheetScreen>
    );
}

const NumberRow = ({ label, value, tone }: { label: string; value: string; tone?: string }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    return (
        <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
            <ValuePill value={value} tone={tone} />
        </View>
    );
};

/**
 * One bar per week. Touch and slide along it: the bar under the finger lights
 * up, the others dim, and the big number above reads that week. The finger is
 * tracked on the UI thread and keeps reading even when it drifts up or down —
 * the page cannot take the touch away mid-read.
 */
function WeekChart({ weeks, tint, idle, picked, onPick }: {
    weeks: WeekDone[]; tint: string; idle: string; picked: number | null;
    onPick: (index: number | null) => void;
}) {
    const [width, setWidth] = useState(0);
    const scrub = useScrub({ count: weeks.length, width, mode: 'slots', gap: CHART_GAP, onIndex: onPick });
    const ceiling = Math.max(1, ...weeks.map(week => week.done));
    return (
        <GestureDetector gesture={scrub.gesture}>
            <View
                testID="week-chart"
                style={styles.chart}
                onLayout={event => setWidth(event.nativeEvent.layout.width)}
                accessible
                accessibilityRole="image"
                accessibilityLabel={`Tasks done per week: ${weeks.map(week => week.done).join(', ')}`}
            >
                {weeks.map((week, index) => (
                    <WeekBar key={week.start} share={week.done / ceiling} index={index} tint={tint} idle={idle}
                        empty={week.done === 0} lit={picked === null ? index === weeks.length - 1 : picked === index} dim={picked !== null && picked !== index} />
                ))}
            </View>
        </GestureDetector>
    );
}

const WeekBar = ({ share, index, tint, idle, empty, lit, dim }: {
    share: number; index: number; tint: string; idle: string; empty: boolean; lit: boolean; dim: boolean;
}) => {
    const grown = useProgress(Math.max(share, 0.04), index * 40);
    const height = useAnimatedStyle(() => ({ height: `${grown.get() * 100}%` }));
    const fade = useAnimatedStyle(() => ({ opacity: withTiming(dim ? 0.3 : lit ? 1 : 0.55, { duration: 120 }) }));
    return (
        // Bars ignore touches so the finger's position is always read against
        // the whole chart, not whichever bar it happens to be over.
        <View pointerEvents="none" style={styles.barTrack}>
            <Animated.View style={[styles.bar, height, fade, { backgroundColor: empty ? idle : tint }]} />
        </View>
    );
};
