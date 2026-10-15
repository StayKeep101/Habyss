import React, { useCallback, useMemo, useState } from 'react';
import { Dimensions, LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View, type LayoutRectangle } from 'react-native';
import { IconButton } from '@/components/ui/IconButton';
import { AnimatedCircle, CountUp, MOTION, useProgress } from '@/components/ui/Motion';
import { router } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Easing, interpolate, runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { ScrubLine, ScrubReadout } from '@/components/Common/ScrubReadout';
import { useScrub } from '@/hooks/useScrub';
import Svg, { Circle } from 'react-native-svg';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { TASK_COLOR } from '@/components/Roadmap/TaskItem';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useGoalsInsights } from '@/hooks/useGoalInsights';
import { useTasks } from '@/hooks/useTasks';
import { useDailyTarget } from '@/hooks/useDailyFocus';
import { useHistory } from '@/hooks/useHistory';
import { dayFill, monthDays, monthTotals, type DaySummary } from '@/lib/progressMonth';
import { dateAt } from '@/lib/goalInsights';
import { styles } from '@/styles/screens/progress.styles';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const OPEN = { duration: 320, easing: Easing.out(Easing.cubic) };
const CLOSE = { duration: 220, easing: Easing.in(Easing.cubic) };

/**
 * Where the month went.
 *
 * A calendar of rings, the numbers under it, and a bar for each day. Tapping a
 * day does not open a sheet from somewhere else: the ring itself grows into the
 * card that tells you what you did, and shrinks back into the ring when you are
 * done, so you never lose track of which day you are looking at.
 */
export default function ProgressScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary: accent } = useAccentGradient();
    const { lightFeedback, selectionFeedback } = useHaptics();

    const { habits, completions, skippedToday, today } = useGoalsInsights();
    const tasks = useTasks();
    const { history, skips } = useHistory(400);
    const dailyTarget = useDailyTarget();

    const [offset, setOffset] = useState(0);
    const [selected, setSelected] = useState<{ day: DaySummary; frame: LayoutRectangle } | null>(null);
    const morph = useSharedValue(0);

    const month = useMemo(() => {
        const date = new Date();
        date.setDate(1);
        date.setMonth(date.getMonth() + offset);
        return date;
    }, [offset]);

    const days = useMemo(() => monthDays({
        habits,
        tasks,
        history: { ...history, [today]: Object.keys(completions).filter(id => completions[id]) },
        skips: { ...skips, [today]: Object.keys(skippedToday).filter(id => skippedToday[id]) },
        month,
        today,
    }), [habits, tasks, history, skips, completions, skippedToday, month, today]);

    const totals = useMemo(() => monthTotals(days), [days]);
    const name = (id: string) => habits.find(habit => habit.id === id)?.name ?? 'Habit';
    const taskName = (id: string) => tasks.find(task => task.id === id)?.title ?? 'Task';

    const openDay = useCallback((day: DaySummary, frame: LayoutRectangle) => {
        if (day.future) return;
        selectionFeedback();
        setSelected({ day, frame });
        morph.set(withTiming(1, OPEN));
    }, [selectionFeedback, morph]);

    const closeDay = () => {
        lightFeedback();
        // The card is only unmounted once it has shrunk back into its ring.
        morph.set(withTiming(0, CLOSE, finished => {
            if (finished) runOnJS(setSelected)(null);
        }));
    };

    /**
     * What the chart can say about each day, worked out once.
     *
     * A worklet picks one of these while the finger moves; it never formats a
     * date itself, which would be slow on that side and would ignore the phone's
     * own idea of how a date reads.
     */
    const labels = useMemo(() => ({
        days: days.map(day => dateAt(day.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })),
        totals: days.map(day => {
            if (day.future) return 'Still to come';
            const parts = [
                day.scheduled ? `${day.done.length} of ${day.scheduled} habits` : null,
                day.tasks.length ? `${day.tasks.length} task${day.tasks.length === 1 ? '' : 's'}` : null,
            ].filter(Boolean);
            return parts.length ? parts.join(' · ') : 'Nothing scheduled';
        }),
    }), [days]);

    const [chartWidth, setChartWidth] = useState(0);
    const chartRef = React.useRef<View>(null);
    const chartFrame = React.useRef<LayoutRectangle | null>(null);
    const onChartWidth = useCallback((event: LayoutChangeEvent) => {
        setChartWidth(event.nativeEvent.layout.width);
        // Where the bars are on screen, so the card can grow out of the one the
        // finger lifted from rather than appearing from nowhere.
        chartRef.current?.measureInWindow((x, y, width, height) => { chartFrame.current = { x, y, width, height }; });
    }, []);

    // Reading only: dragging shows the day in the heading above the chart, and
    // lifting the finger does nothing. Days open from the calendar.
    const scrub = useScrub({ count: days.length, width: chartWidth, mode: 'slots', gap: 1 });

    /**
     * Swipe the calendar sideways to change month, like Calendar does: left for
     * the next month, right for the one before. Horizontal only, so the page
     * still scrolls, and never past this month.
     */
    // The calendar follows the finger, then the month leaves the way it was
    // pushed and the next one comes in from the other side.
    const screenWidth = Dimensions.get('window').width;
    const drag = useSharedValue(0);
    const canGoForward = offset < 0;
    // The new month is placed and slid in only once it has been drawn. Moving
    // it first showed the old month on the wrong side for a frame: the jump.
    const [arrival, setArrival] = useState<{ by: 1 | -1; at: number } | null>(null);
    const arrive = useCallback((by: 1 | -1) => {
        selectionFeedback();
        setArrival({ by, at: Date.now() });
        setOffset(value => value + by);
    }, [selectionFeedback]);
    React.useLayoutEffect(() => {
        if (!arrival) return;
        drag.set(arrival.by * screenWidth * 0.6);
        drag.set(withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) }));
    }, [arrival, drag, screenWidth]);
    const goMonth = useCallback((by: 1 | -1) => {
        if (by === 1 && !canGoForward) return;
        drag.set(withTiming(-by * screenWidth * 0.6, { duration: 160, easing: Easing.in(Easing.cubic) }, finished => {
            if (finished) runOnJS(arrive)(by);
        }));
    }, [canGoForward, screenWidth, drag, arrive]);
    const swipeMonth = useMemo(() => Gesture.Pan()
        .activeOffsetX([-16, 16])
        .failOffsetY([-14, 14])
        .onUpdate(event => {
            'worklet';
            // Past this month there is nothing to show: the calendar resists.
            const blocked = event.translationX < 0 && !canGoForward;
            drag.set(blocked ? event.translationX * 0.2 : event.translationX);
        })
        .onEnd(event => {
            'worklet';
            const by = event.translationX < 0 ? 1 : -1;
            const far = Math.abs(event.translationX) > screenWidth * 0.22 || Math.abs(event.velocityX) > 500;
            if (!far || (by === 1 && !canGoForward)) {
                drag.set(withSpring(0, { damping: 18, stiffness: 220 }));
                return;
            }
            drag.set(withTiming(-by * screenWidth * 0.6, { duration: 140, easing: Easing.out(Easing.quad) }, finished => {
                if (finished) runOnJS(arrive)(by);
            }));
        }), [canGoForward, screenWidth, drag, arrive]);
    const gridMotion = useAnimatedStyle(() => ({
        transform: [{ translateX: drag.get() }],
        // Fully gone at the edge, so the swap between months is never seen.
        opacity: interpolate(Math.abs(drag.get()), [0, screenWidth * 0.6], [1, 0]),
    }));

    // Weeks start on Monday, so the first row is padded to that.
    const firstWeekday = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
    const screen = Dimensions.get('window');

    return (
        <SheetScreen title="Progress" onBack={() => router.back()} backIcon="close">
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} scrollEnabled={!selected}>
                <View style={styles.monthRow}>
                    <IconButton icon="chevron-back" label="Previous month" onPress={() => goMonth(-1)} diameter={36} size={20} color={colors.textSecondary} />
                    <Text style={[styles.month, { color: colors.textPrimary }]}>
                        {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                    </Text>
                    <IconButton icon="chevron-forward" label="Next month" onPress={() => goMonth(1)} diameter={36} size={20} color={offset >= 0 ? colors.border : colors.textSecondary} disabled={offset >= 0} />
                </View>

                <GestureDetector gesture={swipeMonth}>
                <Animated.View key={offset} style={[styles.grid, gridMotion]}>
                    {WEEKDAYS.map((label, index) => (
                        <Text key={index} style={[styles.weekday, { color: colors.textTertiary }]}>{label}</Text>
                    ))}
                    {Array.from({ length: firstWeekday }, (_, index) => <View key={`blank${index}`} style={styles.cell} />)}
                    {days.map((day, index) => (
                        <DayCell
                            key={day.date}
                            index={index}
                            day={day}
                            today={today}
                            accent={accent}
                            colors={colors}
                            taskTarget={dailyTarget}
                            onOpen={openDay}
                        />
                    ))}
                </Animated.View>
                </GestureDetector>

                {/* The month in numbers. */}
                <View style={styles.totals}>
                    <View>
                        <CountUp style={[styles.big, { color: colors.textPrimary }]} value={totals.activeDays} replay={offset} />
                        <Text style={[styles.bigLabel, { color: colors.textTertiary }]}>Active days</Text>
                    </View>
                    <View style={styles.statList}>
                        <Stat icon="checkmark-circle-outline" value={String(totals.checkIns)} replay={offset} label="Check-ins" color={accent} colors={colors} />
                        <Stat icon="flash-outline" value={String(totals.tasks)} replay={offset} label="Tasks" color={TASK_COLOR} colors={colors} />
                        <Stat icon="trending-up-outline" value={totals.rate === null ? '—' : `${totals.rate}%`} replay={offset} label="Hit rate" color={colors.success} colors={colors} />
                    </View>
                </View>

                {/* One bar per day, so a good week is visible as a shape — and
                    readable with a finger, the way a portfolio chart is. The
                    reading runs on the UI thread, so it keeps up with the drag
                    however much the rest of the page is doing. */}
                <View style={styles.chartHead}>
                    <ScrubReadout
                        labels={labels.days} idle="Every day"
                        index={scrub.index}
                        style={[styles.readDay, { color: colors.textPrimary }]}
                        accessibilityLabel="The day being read"
                    />
                    <ScrubReadout
                        labels={labels.totals} idle={`${totals.checkIns + totals.tasks} this month`}
                        index={scrub.index}
                        style={[styles.readTotal, { color: colors.textSecondary }]}
                    />
                </View>

                <GestureDetector gesture={scrub.gesture}>
                    <View ref={chartRef} style={styles.chart} onLayout={onChartWidth}>
                        {days.map((day, index) => (
                            <DayBar
                                key={day.date}
                                replay={offset}
                                day={day}
                                index={index}
                                reading={scrub.index}
                                busiest={totals.busiest}
                                accent={accent}
                                idle={isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)'}
                            />
                        ))}
                        <ScrubLine x={scrub.x} active={scrub.active} color={colors.textTertiary} height={80} />
                    </View>
                </GestureDetector>
                <View style={styles.chartAxis}>
                    <Text style={[styles.axisText, { color: colors.textTertiary }]}>1</Text>
                    <Text style={[styles.axisText, { color: colors.textTertiary }]}>Drag to read a day</Text>
                    <Text style={[styles.axisText, { color: colors.textTertiary }]}>{days.length}</Text>
                </View>
            </ScrollView>

            {/* The tapped ring, grown into a card. */}
            {selected ? (
                <DayCard
                    day={selected.day}
                    frame={selected.frame}
                    morph={morph}
                    screen={screen}
                    colors={colors}
                    isLight={isLight}
                    accent={accent}
                    habitName={name}
                    taskName={taskName}
                    onClose={closeDay}
                />
            ) : null}
        </SheetScreen>
    );
}

/**
 * One day as a ring, the way Activity draws them: a faint track, and an arc
 * that closes as much of it as the day was done — half the day's habits and
 * tasks, half a ring; all of them, a closed ring.
 *
 * The ring is drawn on its own square with nothing around it. It used to sit
 * inside a box with a border, which shifted the drawing over by the border's
 * width and clipped one side: the ring looked pushed off centre.
 */
const DayCell = React.memo(function DayCell({ day, index, today, accent, colors, onOpen, taskTarget }: {
    day: DaySummary; index: number; today: string; accent: string; colors: typeof Colors.light;
    onOpen: (day: DaySummary, frame: LayoutRectangle) => void;
    taskTarget: number;
}) {
    const ref = React.useRef<View>(null);
    const fill = day.future ? 0 : dayFill(day, taskTarget);
    const closed = fill >= 1;
    const isToday = day.date === today;
    const size = 36;
    const stroke = 3.5;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    // Each ring closes after the one before it, so a month fills in like a wave.
    const shown = useProgress(fill, Math.min(index, 31) * (MOTION.stagger / 2));
    const arc = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - shown.get()) }));

    return (
        <View style={styles.cell}>
            <Pressable
                ref={ref}
                accessibilityRole="button"
                accessibilityLabel={`${day.date}. ${Math.round(fill * 100)}% done: ${day.done.length} of ${day.scheduled} habits, ${day.tasks.length} tasks`}
                disabled={day.future}
                onPress={() => ref.current?.measureInWindow((x, y, width, height) => onOpen(day, { x, y, width, height }))}
                style={[styles.dayButton, { opacity: day.future ? 0.3 : 1 }]}
            >
                <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
                    <Svg width={size} height={size} style={styles.ringSvg}>
                        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={accent} strokeOpacity={0.16} strokeWidth={stroke} fill="none" />
                        {fill > 0 ? (
                            <AnimatedCircle
                                cx={size / 2} cy={size / 2} r={radius}
                                stroke={accent} strokeWidth={stroke} fill="none"
                                strokeDasharray={`${circumference} ${circumference}`}
                                animatedProps={arc}
                                strokeLinecap={closed ? 'butt' : 'round'}
                                rotation={-90} origin={`${size / 2}, ${size / 2}`}
                            />
                        ) : null}
                    </Svg>
                    <Text style={[styles.dayNumber, {
                        color: closed || isToday ? accent : colors.textSecondary,
                        fontFamily: closed || isToday ? FontFamily.bold : FontFamily.regular,
                    }]}>
                        {Number(day.date.slice(-2))}
                    </Text>
                </View>
            </Pressable>
        </View>
    );
});

/**
 * One day's bar, which lights up under the finger.
 *
 * It compares itself with the scrubbing index on the UI thread rather than
 * being told by React, so dragging across a month costs no renders at all.
 */
const DayBar = ({ day, index, reading, busiest, accent, idle, replay }: {
    day: DaySummary; index: number; reading: SharedValue<number>;
    busiest: number; accent: string; idle: string; replay: number;
}) => {
    const height = Math.max(day.total ? 6 : 2, busiest ? (day.total / busiest) * 74 : 0);
    // Grows up from the axis, one bar after another, whenever the month changes.
    const grown = useProgress(height, index * (MOTION.stagger / 2), replay);
    const style = useAnimatedStyle(() => {
        const on = reading.get() === index;
        return {
            height: grown.get(),
            opacity: (day.future ? 0.35 : 1) * (on ? 1 : 0.9), transform: [{ scaleX: on ? 1.6 : 1 }],
        };
    });

    return (
        <View style={styles.barSlot}>
            <Animated.View style={[styles.bar, style, { backgroundColor: day.total ? accent : idle }]} />
        </View>
    );
};

const Stat = ({ icon, value, label, color, colors, replay }: {
    icon: React.ComponentProps<typeof Ionicons>['name']; value: string; label: string; color: string; colors: typeof Colors.light;
    replay?: unknown;
}) => (
    <View style={styles.stat}>
        <Ionicons name={icon} size={15} color={color} />
        <CountUp style={[styles.statValue, { color: colors.textPrimary }]} value={value} replay={replay} />
        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{label}</Text>
    </View>
);

/**
 * The day's detail, morphing out of its ring.
 *
 * It starts exactly where the ring is, the same size and shape, and grows into
 * a card below it. The contents only fade in once it is most of the way open,
 * so text never appears squeezed inside a circle.
 */
const DayCard = ({ day, frame, morph, screen, colors, isLight, accent, habitName, taskName, onClose }: {
    day: DaySummary;
    frame: LayoutRectangle;
    morph: SharedValue<number>;
    screen: { width: number; height: number };
    colors: typeof Colors.light;
    isLight: boolean;
    accent: string;
    habitName: (id: string) => string;
    taskName: (id: string) => string;
    onClose: () => void;
}) => {
    const margin = 16;
    const width = screen.width - margin * 2;
    const rows = day.done.length + day.missed.length + day.skipped.length + day.tasks.length;
    const height = Math.min(screen.height * 0.55, 132 + rows * 30);
    // Below the ring when there is room, otherwise above it.
    const top = Math.min(frame.y + frame.height + 10, screen.height - height - 24);

    const card = useAnimatedStyle(() => ({
        left: interpolate(morph.value, [0, 1], [frame.x, margin]),
        top: interpolate(morph.value, [0, 1], [frame.y, top]),
        width: interpolate(morph.value, [0, 1], [frame.width, width]),
        height: interpolate(morph.value, [0, 1], [frame.height, height]),
        borderRadius: interpolate(morph.value, [0, 1], [frame.width / 2, 22]),
        opacity: interpolate(morph.value, [0, 0.12, 1], [0, 1, 1]),
    }));
    const body = useAnimatedStyle(() => ({ opacity: interpolate(morph.value, [0, 0.55, 1], [0, 0, 1]) }));
    const scrim = useAnimatedStyle(() => ({ opacity: morph.value * 0.45 }));

    const date = dateAt(day.date);
    const line = (id: string, kind: 'done' | 'missed' | 'skipped' | 'task') => {
        const icon = kind === 'done' ? 'checkmark-circle' : kind === 'task' ? 'flash' : kind === 'skipped' ? 'remove-circle-outline' : 'ellipse-outline';
        const color = kind === 'done' ? accent : kind === 'task' ? TASK_COLOR : colors.textTertiary;
        return (
            <View key={kind + id} style={styles.line}>
                <Ionicons name={icon} size={16} color={color} />
                <Text
                    numberOfLines={1}
                    style={[styles.lineText, {
                        color: kind === 'missed' ? colors.textTertiary : colors.textSecondary,
                        textDecorationLine: kind === 'skipped' ? 'line-through' : 'none',
                    }]}
                >
                    {kind === 'task' ? taskName(id) : habitName(id)}
                </Text>
            </View>
        );
    };

    return (
        <>
            <AnimatedPressable
                testID="day-card-scrim"
                accessibilityLabel="Close day"
                onPress={onClose}
                style={[StyleSheet.absoluteFill, scrim, { backgroundColor: '#000' }]}
            />
            <Animated.View
                style={[styles.card, card, {
                    backgroundColor: isLight ? '#FFFFFF' : '#12161C',
                    borderColor: colors.border,
                }]}
            >
                <Animated.View style={[styles.cardBody, body]}>
                    <View style={styles.cardHead}>
                        <View>
                            <Text style={[styles.cardDate, { color: colors.textPrimary }]}>
                                {date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                            </Text>
                            <Text style={[styles.cardMeta, { color: colors.textTertiary }]}>
                                {day.scheduled ? `${day.done.length} of ${day.scheduled} habits` : 'No habits scheduled'}
                                {day.tasks.length ? ` · ${day.tasks.length} task${day.tasks.length === 1 ? '' : 's'}` : ''}
                            </Text>
                        </View>
                        <IconButton icon="close" label="Close day" onPress={onClose} diameter={32} size={20} color={colors.textTertiary} />
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
                        {day.done.map(id => line(id, 'done'))}
                        {day.tasks.map(id => line(id, 'task'))}
                        {day.skipped.map(id => line(id, 'skipped'))}
                        {day.missed.map(id => line(id, 'missed'))}
                        {rows === 0 ? (
                            <Text style={[styles.empty, { color: colors.textTertiary }]}>Nothing was scheduled or logged.</Text>
                        ) : null}
                    </ScrollView>
                </Animated.View>
            </Animated.View>
        </>
    );
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
