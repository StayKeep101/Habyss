import React, { useCallback, useMemo, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View, type LayoutRectangle } from 'react-native';
import { IconButton } from '@/components/ui/IconButton';
import { AnimatedCircle, CountUp, MOTION, useProgress } from '@/components/ui/Motion';
import { router } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Easing, interpolate, runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { textOn } from '@/theme/tokens';
import { FontFamily } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useGoalsInsights } from '@/hooks/useGoalInsights';
import { useTasks } from '@/hooks/useTasks';
import { useDailyTarget } from '@/hooks/useDailyFocus';
import { useHistory } from '@/hooks/useHistory';
import { dayFill, monthDays, monthTotals, type DaySummary } from '@/lib/progressMonth';
import { streakFrom } from '@/lib/dayComplete';
import { VoidCard } from '@/components/ui/VoidCard';
import { MatteSurface } from '@/components/ui/MatteSurface';
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
    // The month before, over the same number of days, so a half-finished
    // month is compared fairly: "+3" means ahead of this point last month.
    const elapsed = days.filter(day => !day.future).length;
    const before = useMemo(() => {
        const previous = new Date(month.getFullYear(), month.getMonth() - 1, 1);
        const all = monthDays({ habits, tasks, history, skips, month: previous, today });
        return monthTotals(all.slice(0, Math.max(1, elapsed)));
    }, [habits, tasks, history, skips, month, today, elapsed]);
    // Your streak, worked out exactly as Home works it out.
    const streak = useMemo(() => {
        const merged = { ...history, [today]: Object.keys(completions).filter(id => completions[id]) };
        return streakFrom(habits, tasks, merged, skips, today, undefined, dailyTarget).streak;
    }, [habits, tasks, history, skips, completions, today, dailyTarget]);
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
        <SheetScreen title="Streak" onBack={() => router.back()} backIcon="close">
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} scrollEnabled={!selected}>
                {/* The answer first, and the month in four numbers — small, so
                    the whole calendar fits on screen underneath. */}
                <View style={styles.hero}>
                    <CountUp style={[styles.heroValue, { color: colors.textPrimary }]} value={streak} />
                    <Ionicons name="flame" size={18} color={colors.warning} />
                    <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>{streak === 1 ? 'day in a row' : 'days in a row'}</Text>
                </View>
                <VoidCard style={styles.stats}>
                    <MiniStat label="Active days" value={totals.activeDays} change={totals.activeDays - before.activeDays} replay={offset} />
                    <MiniStat label="Perfect" value={totals.perfectDays} change={totals.perfectDays - before.perfectDays} replay={offset} />
                    <MiniStat label="Habits kept" value={totals.rate} suffix="%" change={totals.rate !== null && before.rate !== null ? totals.rate - before.rate : 0} replay={offset} />
                    <MiniStat label="Tasks" value={totals.tasks} change={totals.tasks - before.tasks} replay={offset} />
                </VoidCard>

                {/* Swipe the calendar for another month. */}
                <View style={styles.monthRow} accessible accessibilityLabel={month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                    accessibilityActions={[{ name: 'increment', label: 'Next month' }, { name: 'decrement', label: 'Previous month' }]}
                    onAccessibilityAction={event => goMonth(event.nativeEvent.actionName === 'increment' ? 1 : -1)}>
                    <Text style={[styles.month, { color: colors.textPrimary }]}>
                        {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                    </Text>
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
                            column={(firstWeekday + index) % 7}
                            prevPerfect={index > 0 && !days[index - 1].future && dayFill(days[index - 1]) >= 1}
                            nextPerfect={index < days.length - 1 && !days[index + 1].future && dayFill(days[index + 1]) >= 1}
                            day={day}
                            today={today}
                            accent={accent}
                            colors={colors}
                            onOpen={openDay}
                        />
                    ))}
                </Animated.View>
                </GestureDetector>

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
 * A perfect day (everything asked for done) is a solid disc instead, and
 * perfect days in a row are joined by a band behind them, along the week, so
 * a run reads at a glance as one unbroken stretch.
 */
const DayCell = React.memo(function DayCell({ day, index, today, accent, colors, onOpen, column, prevPerfect, nextPerfect }: {
    day: DaySummary; index: number; today: string; accent: string; colors: typeof Colors.light;
    /** 0 (Monday) to 6 (Sunday): the band never wraps onto the next row. */
    column: number;
    prevPerfect: boolean;
    nextPerfect: boolean;
    onOpen: (day: DaySummary, frame: LayoutRectangle) => void;
}) {
    const ref = React.useRef<View>(null);
    const fill = day.future ? 0 : dayFill(day);
    const closed = fill >= 1;
    const isToday = day.date === today;
    const size = 36;
    const stroke = 3.5;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    // Each ring closes after the one before it, so a month fills in like a wave.
    const shown = useProgress(fill, Math.min(index, 31) * (MOTION.stagger / 2));
    const arc = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - shown.get()) }));

    const bandLeft = closed && prevPerfect && column > 0;
    const bandRight = closed && nextPerfect && column < 6;

    return (
        <View style={styles.cell}>
            {/* The run's band, from this day's centre to its neighbours'. */}
            {bandLeft ? <View pointerEvents="none" style={[styles.band, styles.bandLeft, { height: size, backgroundColor: accent }]} /> : null}
            {bandRight ? <View pointerEvents="none" style={[styles.band, styles.bandRight, { height: size, backgroundColor: accent }]} /> : null}
            <Pressable
                ref={ref}
                accessibilityRole="button"
                accessibilityLabel={`${day.date}. ${Math.round(fill * 100)}% done: ${day.done.length} of ${day.scheduled} habits, ${day.tasks.length} tasks`}
                disabled={day.future}
                onPress={() => ref.current?.measureInWindow((x, y, width, height) => onOpen(day, { x, y, width, height }))}
                style={[styles.dayButton, { opacity: day.future ? 0.3 : 1 }]}
            >
                <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
                    {closed ? (
                        // A perfect day: filled, not ringed.
                        <View style={[StyleSheet.absoluteFill, { borderRadius: size / 2, backgroundColor: accent }]} />
                    ) : (
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
                    )}
                    <Text style={[styles.dayNumber, {
                        color: closed ? textOn(accent) : isToday ? accent : colors.textSecondary,
                        fontFamily: closed || isToday ? FontFamily.bold : FontFamily.regular,
                    }]}>
                        {Number(day.date.slice(-2))}
                    </Text>
                </View>
            </Pressable>
        </View>
    );
});

/** One of the month's numbers: the figure, its name, and the change since the same days last month. */
const MiniStat = ({ label, value, suffix = '', change, replay }: {
    label: string; value: number | null; suffix?: string; change: number; replay?: unknown;
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const tone = change > 0 ? colors.success : change < 0 ? colors.error : colors.textTertiary;
    return (
        <View style={styles.stat}>
            <View style={styles.statTop}>
                <CountUp style={[styles.statValue, { color: colors.textPrimary }]} value={value === null ? '—' : `${value}${suffix}`} replay={replay} />
                {value !== null && change !== 0 ? (
                    <Text style={[styles.statChange, { color: tone }]}>{change > 0 ? '+' : '−'}{Math.abs(change)}</Text>
                ) : null}
            </View>
            <Text numberOfLines={1} style={[styles.statLabel, { color: colors.textTertiary }]}>{label}</Text>
        </View>
    );
};

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
    const habitRows = day.done.length + day.missed.length + day.skipped.length;
    const taskRows = day.tasks.length + day.tasksOpen.length;
    const rows = habitRows + taskRows;
    const height = Math.min(screen.height * 0.6, 96 + rows * 34 + (habitRows ? 32 : 0) + (taskRows ? 32 : 0));
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
    /** One thing the day asked for: a filled tick if it was done, an empty circle if not. */
    const line = (name: string, state: 'done' | 'open' | 'skipped', key: string) => (
        <View key={key} style={styles.line}>
            <View style={[styles.check, state === 'done'
                ? { backgroundColor: colors.success, borderColor: colors.success }
                : { borderColor: colors.textTertiary }]}>
                {state === 'done' ? <Ionicons name="checkmark" size={13} color={colors.background} /> : null}
                {state === 'skipped' ? <View style={[styles.skipBar, { backgroundColor: colors.textTertiary }]} /> : null}
            </View>
            <Text numberOfLines={1} style={[styles.lineText, {
                color: state === 'done' ? colors.textPrimary : colors.textTertiary,
                textDecorationLine: state === 'skipped' ? 'line-through' : 'none',
            }]}>
                {name}
            </Text>
            {state === 'skipped' ? <Text style={[styles.lineTag, { color: colors.textTertiary }]}>Skipped</Text> : null}
        </View>
    );
    const section = (title: string, done: number, total: number) => (
        <View style={styles.cardSection}>
            <Text style={[styles.cardSectionTitle, { color: colors.textPrimary }]}>{title}</Text>
            <Text style={[styles.cardSectionCount, { color: done === total ? colors.success : colors.textSecondary }]}>{done}/{total}</Text>
        </View>
    );

    return (
        <>
            <AnimatedPressable
                testID="day-card-scrim"
                accessibilityLabel="Close day"
                onPress={onClose}
                style={[StyleSheet.absoluteFill, scrim, { backgroundColor: '#000' }]}
            />
            <Animated.View style={[styles.card, card]}>
                {/* The same matte card as everywhere else; the morphing corner clips it. */}
                <MatteSurface pointerEvents="none" radius={22} elevation="none" style={StyleSheet.absoluteFill} />
                <Animated.View style={[styles.cardBody, body]}>
                    <View style={styles.cardHead}>
                        <View>
                            <Text style={[styles.cardDate, { color: colors.textPrimary }]}>
                                {date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                            </Text>
                        </View>
                        <IconButton icon="close" label="Close day" onPress={onClose} diameter={32} size={20} color={colors.textTertiary} />
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
                        {habitRows ? section('Habits', day.done.length, day.done.length + day.missed.length) : null}
                        {day.done.map(id => line(habitName(id), 'done', `d${id}`))}
                        {day.missed.map(id => line(habitName(id), 'open', `m${id}`))}
                        {day.skipped.map(id => line(habitName(id), 'skipped', `s${id}`))}
                        {taskRows ? section('Tasks', day.tasks.length, taskRows) : null}
                        {day.tasks.map(id => line(taskName(id), 'done', `t${id}`))}
                        {day.tasksOpen.map(id => line(taskName(id), 'open', `o${id}`))}
                        {rows === 0 ? (
                            <Text style={[styles.empty, { color: colors.textTertiary }]}>Nothing planned</Text>
                        ) : null}
                    </ScrollView>
                </Animated.View>
            </Animated.View>
        </>
    );
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
