import React, { useCallback, useMemo, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type LayoutRectangle } from 'react-native';
import { IconButton } from '@/components/ui/IconButton';
import { ChoicePill } from '@/components/ui/ChoicePill';
import { ChoiceSheet } from '@/components/ui/ChoiceSheet';
import { AnimatedCircle, CountUp, MOTION, useProgress } from '@/components/ui/Motion';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Easing, interpolate, runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { textOn } from '@/theme/tokens';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useGoalsInsights } from '@/hooks/useGoalInsights';
import { useTasks } from '@/hooks/useTasks';
import { useDailyTarget } from '@/hooks/useDailyFocus';
import { useHistory } from '@/hooks/useHistory';
import { dayFill, monthDays, type DaySummary } from '@/lib/progressMonth';
import { longestRun, streakFrom } from '@/lib/dayComplete';
import { useWeekStart } from '@/hooks/useWeekStart';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { dateAt } from '@/lib/goalInsights';
import { styles } from '@/styles/screens/progress.styles';
import { usePagerGesture } from '@/components/ui/PagerGesture';

/** Whose streak it shows: every habit and task together (null), or one habit; and whether its chooser is open. */
export interface StreakWhose { only: string | null; setOnly: (id: string | null) => void; choosing: boolean; setChoosing: (open: boolean) => void }
export function useStreakWhose(): StreakWhose {
    const [only, setOnly] = useState<string | null>(null);
    const [choosing, setChoosing] = useState(false);
    return { only, setOnly, choosing, setChoosing };
}

/** Whose streak, for the header beside "Streak": All habits, or the one chosen; tap to choose. */
export function StreakWhosePill({ whose }: { whose: StreakWhose }) {
    const { primary: accent } = useAccentGradient();
    const { selectionFeedback } = useHaptics();
    const { habits } = useGoalsInsights();
    const picked = whose.only ? habits.find(habit => habit.id === whose.only) ?? null : null;
    return (
        <ChoicePill label={picked ? picked.name : 'All habits'} icon="chevron-down" on={false} color={accent} role="button"
            onPress={() => { selectionFeedback(); whose.setChoosing(true); }}
            accessibilityLabel={`Streak for ${picked ? picked.name : 'all habits and tasks'}. Change`} />
    );
}

/** Inside a sideways pager, a gesture that holds it off while it has the finger (components/ui/PagerGesture.ts). */
const withPager = <G extends ReturnType<typeof Gesture.Pan>>(gesture: G, pager: ReturnType<typeof usePagerGesture>) => (pager ? gesture.blocksExternalGesture(pager) : gesture);

const MONDAY_FIRST = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const SUNDAY_FIRST = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const OPEN = { duration: 320, easing: Easing.out(Easing.cubic) };
const CLOSE = { duration: 220, easing: Easing.in(Easing.cubic) };

/**
 * Your streak, and the month it was made in.
 *
 * The run going now, big, then the whole month as a calendar of day pills
 * filling the page, each with a ring of how much of the day was done. Tapping a
 * day does not open a sheet from somewhere else: the ring itself grows into the
 * card that tells you what you did, and shrinks back into the ring when you are
 * done, so you never lose track of which day you are looking at.
 */
export function StreakView({ whose }: { whose: StreakWhose }) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary: accent } = useAccentGradient();
    const { lightFeedback, selectionFeedback } = useHaptics();

    const { habits: allHabits, completions, skippedToday, today } = useGoalsInsights();
    const allTasks = useTasks();
    // One habit's streak, or the whole day's (tasks included). The same streakFrom
    // either way: given one habit and no tasks, it is that habit's run.
    const { only, setOnly, choosing, setChoosing } = whose;
    const picked = only ? allHabits.find(habit => habit.id === only) ?? null : null;
    const habits = useMemo(() => (picked ? [picked] : allHabits), [picked, allHabits]);
    const tasks = useMemo(() => (picked ? [] : allTasks), [picked, allTasks]);
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

    // Your streak, worked out exactly as Home works it out.
    // And the best run there has ever been, from the same days.
    const { streak, best } = useMemo(() => {
        const merged = { ...history, [today]: Object.keys(completions).filter(id => completions[id]) };
        const result = streakFrom(habits, tasks, merged, skips, today, undefined, dailyTarget);
        return { streak: result.streak, best: Math.max(result.streak, longestRun(result.completedDates)) };
    }, [habits, tasks, history, skips, completions, today, dailyTarget]);
    const mondayFirst = useWeekStart() === 'monday';
    const name = (id: string) => habits.find(habit => habit.id === id)?.name ?? 'Habit';
    const taskName = (id: string) => tasks.find(task => task.id === id)?.title ?? 'Task';

    // The day's card grows out of its ring, placed in this page's own space (whatever holds the page:
    // its own sheet, or the Wallet · Streak · Missed sheet), so it opens exactly over the ring.
    const root = React.useRef<View>(null);
    const [page, setPage] = useState({ width: 0, height: 0 });
    const openDay = useCallback((day: DaySummary, frame: LayoutRectangle) => {
        if (day.future) return;
        selectionFeedback();
        root.current?.measureInWindow((x, y, width, height) => {
            setPage({ width, height });
            setSelected({ day, frame: { x: frame.x - x, y: frame.y - y, width: frame.width, height: frame.height } });
            morph.set(withTiming(1, OPEN));
        });
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
    const pager = usePagerGesture();
    const swipeMonth = useMemo(() => withPager(Gesture.Pan()
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
        }), pager), [canGoForward, screenWidth, drag, arrive, pager]);
    const gridMotion = useAnimatedStyle(() => ({
        transform: [{ translateX: drag.get() }],
        // Fully gone at the edge, so the swap between months is never seen.
        opacity: interpolate(Math.abs(drag.get()), [0, screenWidth * 0.6], [1, 0]),
    }));

    // Weeks start on the day set in Settings; the first row is padded to that.
    const firstWeekday = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + (mondayFirst ? 6 : 0)) % 7;
    const screen = Dimensions.get('window');
    // The month fills the page: the streak on top, then every week as a row of day pills sharing what is left of the height.
    const { height, width } = useWindowDimensions();
    const heroSize = Math.round(Math.min(112, height * 0.12));
    const rows = Math.ceil((firstWeekday + days.length) / 7);
    // Seven columns across, the weeks sharing the height left under the month's name (measured).
    const cellWidth = (width - Spacing.xl * 2) / 7;
    const [viewport, setViewport] = useState(0);
    const [calendarTop, setCalendarTop] = useState(0);
    const room = viewport && calendarTop ? viewport - calendarTop - Spacing.section - Spacing.sm : 0;
    const weekdayRow = Spacing.xl;
    const rowHeight = room ? Math.max(cellWidth * 0.9, Math.min(cellWidth * 1.5, (room - weekdayRow) / rows)) : cellWidth;
    const ring = Math.round(Math.min(cellWidth * 0.84, rowHeight - Spacing.sm));
    const gap = Math.round((rowHeight - ring) / 2);
    return (
        <View ref={root} style={styles.page} collapsable={false}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} scrollEnabled={!selected}
                onLayout={event => setViewport(event.nativeEvent.layout.height)}>
                {/* The run going now, big, with the flame; your best under it. */}
                <View style={styles.hero} accessible accessibilityLabel={`${streak} ${streak === 1 ? 'day' : 'days'} in a row. Best ${best}.`}>
                    <View style={styles.heroRow}>
                        <CountUp style={[styles.heroValue, { fontSize: heroSize, lineHeight: Math.round(heroSize * 1.08), letterSpacing: -heroSize / 24, color: colors.textPrimary }]} value={streak} replay={only} />
                        <Ionicons name="flame" filled size={Math.round(heroSize * 0.42)} color={streak > 0 ? colors.warning : colors.textTertiary} />
                    </View>
                    <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>
                        {`${streak === 1 ? 'day in a row' : 'days in a row'}${best > streak ? ` · best ${best}` : streak > 1 ? ' · your best yet' : ''}`}
                    </Text>
                </View>

                {/* Swipe the calendar for another month. */}
                <View style={styles.monthRow}>
                    <Text style={[styles.month, { color: colors.textPrimary }]} accessibilityRole="header">
                        {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                    </Text>
                    <View style={styles.monthArrows}>
                        <IconButton icon="chevron-back" label="Previous month" diameter={36} size={18} onPress={() => goMonth(-1)} />
                        <IconButton icon="chevron-forward" label="Next month" diameter={36} size={18} disabled={!canGoForward} onPress={() => goMonth(1)} />
                    </View>
                </View>

                <View onLayout={event => setCalendarTop(event.nativeEvent.layout.y)}>
                <GestureDetector gesture={swipeMonth}>
                <Animated.View key={offset} style={[styles.grid, gridMotion]}>
                    {(mondayFirst ? MONDAY_FIRST : SUNDAY_FIRST).map((label, index) => (
                        <Text key={index} style={[styles.weekday, { height: weekdayRow, color: colors.textTertiary }]}>{label}</Text>
                    ))}
                    {Array.from({ length: firstWeekday }, (_, index) => <View key={`blank${index}`} style={[styles.cell, { paddingVertical: gap }]} />)}
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
                            size={ring}
                            gap={gap}
                        />
                    ))}
                </Animated.View>
                </GestureDetector>
                </View>

            </ScrollView>

            {/* The tapped ring, grown into a card. */}
            {selected ? (
                <DayCard
                    day={selected.day}
                    frame={selected.frame}
                    morph={morph}
                    screen={page.width ? page : screen}
                    colors={colors}
                    isLight={isLight}
                    accent={accent}
                    habitName={name}
                    taskName={taskName}
                    onClose={closeDay}
                />
            ) : null}
            <ChoiceSheet visible={choosing} title="Streak for" onClose={() => setChoosing(false)}
                choices={[
                    { label: 'All habits', icon: only === null ? 'checkmark' : 'layers', onPress: () => setOnly(null) },
                    ...allHabits.filter(habit => !habit.isGoal && !habit.isArchived).map(habit => ({
                        label: habit.name, icon: only === habit.id ? 'checkmark' : habit.icon || 'repeat', onPress: () => setOnly(habit.id),
                    })),
                ]} />
        </View>
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
const DayCell = React.memo(function DayCell({ day, index, today, accent, colors, onOpen, column, prevPerfect, nextPerfect, size, gap }: {
    day: DaySummary; index: number; today: string; accent: string; colors: typeof Colors.light;
    /** 0 (the week's first day) to 6: the band never wraps onto the next row. */
    column: number;
    prevPerfect: boolean;
    nextPerfect: boolean;
    onOpen: (day: DaySummary, frame: LayoutRectangle) => void;
    /** The ring's size and the room around it, from the screen's height. */
    size: number;
    gap: number;
}) {
    const ref = React.useRef<View>(null);
    const fill = day.future ? 0 : dayFill(day);
    const closed = fill >= 1;
    const isToday = day.date === today;
    const stroke = 3.5;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    // Each ring closes after the one before it, so a month fills in like a wave.
    const shown = useProgress(fill, Math.min(index, 31) * (MOTION.stagger / 2));
    const arc = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - shown.get()) }));

    const bandLeft = closed && prevPerfect && column > 0;
    const bandRight = closed && nextPerfect && column < 6;

    return (
        <View style={[styles.cell, { paddingVertical: gap }]}>
            {/* The run's band, from this day's centre to its neighbours'. */}
            {bandLeft ? <View pointerEvents="none" style={[styles.band, styles.bandLeft, { top: gap, height: size, backgroundColor: accent }]} /> : null}
            {bandRight ? <View pointerEvents="none" style={[styles.band, styles.bandRight, { top: gap, height: size, backgroundColor: accent }]} /> : null}
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
                        // The date grows with the ring, as the month fills the page.
                        fontSize: Math.max(14, Math.round(size * 0.3)),
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

