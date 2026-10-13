import React, { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Easing, FadeIn, FadeOut, LinearTransition, ReduceMotion,
    useAnimatedStyle, useSharedValue, withDelay, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { ScrubLine, ScrubReadout } from '@/components/Common/ScrubReadout';
import { useScrub } from '@/hooks/useScrub';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { VoidCard } from '@/components/Layout/VoidCard';
import { VoidModal } from '@/components/Layout/VoidModal';
import { ModalHeader } from '@/components/Layout/ModalHeader';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { s, vs, ms } from '@/theme/scale';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import type { Habit } from '@/lib/habitsSQLite';
import type { HabitDay, HistoryDay } from '@/lib/habitDays';
import { habitMomentum, momentum } from '@/lib/momentum';

const WINDOWS = [
    { id: 14, label: '14 days' },
    { id: 30, label: '30 days' },
] as const;

// Layout transitions are timed, never sprung: a spring overshoots and the whole
// panel visibly bounces every time a day is tapped.
const MORPH = LinearTransition.duration(260).easing(Easing.out(Easing.cubic));
const EASE = { duration: 460, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };

const longDay = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
const shortDay = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/**
 * Why momentum is what it is, and which habit is moving it.
 *
 * The page it replaces restated the headline as a row of bars, which explains
 * nothing. This one is built to be argued with: tap any day and it opens to
 * show exactly what was asked of you and what you did, so a number you dispute
 * can be checked rather than believed. Underneath, the habits are ranked
 * weakest first — one habit quietly failing is the usual reason everything
 * looks worse than it feels.
 */
export const MomentumModal = ({ visible, onClose, habits, history, completions }: {
    visible: boolean;
    onClose: () => void;
    habits: Habit[];
    history: HistoryDay[];
    completions: Record<string, boolean>;
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const isTrueDark = theme === 'trueDark';
    const { primary } = useAccentGradient();
    const { selectionFeedback, lightFeedback } = useHaptics();

    const [days, setDays] = useState<number>(30);
    const [picked, setPicked] = useState<string | null>(null);

    // Changing the window invalidates the open day, so it closes with it.
    const [lastDays, setLastDays] = useState(days);
    if (days !== lastDays) { setLastDays(days); setPicked(null); }

    const result = useMemo(() => momentum(habits, history, completions, days), [habits, history, completions, days]);
    const ranked = useMemo(() => habitMomentum(habits, history, completions, days), [habits, history, completions, days]);
    const names = useMemo(() => new Map(habits.map(habit => [habit.id, habit.name])), [habits]);

    const surface = { glass: !isTrueDark, intensity: isLight ? 20 : 80 };
    const tint = { backgroundColor: colors.surfaceSecondary };
    const glassy = (extra?: object) => [isLight ? tint : null, extra] as never;

    // What the readout can say, worked out once. A worklet picks from these; it
    // never formats a date, which would be slow and locale-blind on that side.
    const labels = useMemo(() => ({
        days: result.window.map(each => longDay(each.date)),
        kept: result.window.map(each => {
            const countable = each.scheduled.length - each.skipped.length;
            return countable === 0 ? 'Nothing due' : `${each.done.length} of ${countable} kept`;
        }),
    }), [result.window]);
    const last = result.window.length - 1;

    const [chartWidth, setChartWidth] = useState(0);
    const onChartWidth = useCallback((event: LayoutChangeEvent) => setChartWidth(event.nativeEvent.layout.width), []);

    /**
     * The day panel opens where the finger lifted, not while it moves.
     *
     * Its contents are a list of habits, and re-rendering that thirty times
     * across one flick is the sort of thing that makes a drag feel cheap. The
     * readout above the chart follows the finger; the panel waits for it. While
     * the finger is down nothing here runs at all — not one render for a drag
     * across the whole month.
     */
    const onScrubRelease = useCallback((index: number) => {
        setPicked(result.window[index]?.date ?? null);
    }, [result.window]);

    const scrub = useScrub({
        count: result.window.length, width: chartWidth,
        mode: 'slots', gap: s(2), onRelease: onScrubRelease,
    });

    const day = picked ? result.window.find(each => each.date === picked) ?? null : null;
    const direction = !result.comparable ? colors.textSecondary
        : result.direction === 'up' ? colors.success
            : result.direction === 'down' ? colors.warning : colors.textSecondary;

    return (
        <VoidModal visible={visible} onClose={onClose}>
            <ModalHeader
                title="MOMENTUM"
                onBack={onClose}
                shareSummary={{
                    title: 'Momentum',
                    value: `${result.rate}%`,
                    subtitle: result.comparable
                        ? `${result.delta >= 0 ? 'Up' : 'Down'} ${Math.abs(result.delta)} on the ${days} days before`
                        : `Habits kept over ${days} days`,
                }}
            />

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* The number, and the only framing that makes it useful. */}
                <VoidCard {...surface} style={[styles.hero, glassy()]}>
                    <View style={styles.heroTop}>
                        <Text testID="momentum-rate" style={[styles.heroValue, { color: colors.textPrimary }]}>{result.rate}%</Text>
                        {result.comparable && result.delta !== 0 ? (
                            <View style={[styles.deltaPill, { backgroundColor: direction + '22' }]}>
                                <Ionicons name={result.delta > 0 ? 'trending-up' : 'trending-down'} size={s(13)} color={direction} />
                                <Text testID="momentum-delta" style={[styles.deltaText, { color: direction }]}>
                                    {`${result.delta > 0 ? '+' : ''}${result.delta}`}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                    <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>
                        {!result.comparable
                            ? `of everything your habits asked of you in the last ${days} days. Keep going and this starts comparing itself with the ${days} before.`
                            : result.delta === 0
                                ? `kept over ${days} days — exactly level with the ${days} before.`
                                : `kept over ${days} days, ${result.delta > 0 ? 'up' : 'down'} ${Math.abs(result.delta)} on the ${days} days before.`}
                    </Text>
                    <View style={[styles.heroSplit, { borderTopColor: colors.border }]}>
                        <Stat label="Kept" value={`${result.kept}`} colors={colors} />
                        <Stat label="Asked for" value={`${result.countable}`} colors={colors} divider />
                        <Stat label="Before" value={result.comparable ? `${result.previous}%` : '—'} colors={colors} divider />
                    </View>
                </VoidCard>

                {/* Day by day — and every bar is a question you can open. */}
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

                <Animated.View layout={MORPH}>
                    <VoidCard {...surface} style={[styles.chartCard, glassy()]}>
                        {/* The live reading, the way a portfolio puts its value
                            above the line. Both of these are written straight
                            from the gesture, so they keep up with the finger
                            rather than a render behind it. */}
                        <View style={styles.readout}>
                            <ScrubReadout
                                labels={labels.days} idle={labels.days[last] ?? ''} index={scrub.index}
                                style={[styles.readDay, { color: colors.textPrimary }]}
                                accessibilityLabel="The day being read"
                            />
                            <ScrubReadout
                                labels={labels.kept} idle={labels.kept[last] ?? ''} index={scrub.index}
                                style={[styles.readKept, { color: colors.textSecondary }]}
                            />
                        </View>

                        <GestureDetector gesture={scrub.gesture}>
                            <View style={styles.chart} onLayout={onChartWidth}>
                                {result.window.map((each, index) => (
                                    <Bar
                                        key={each.date}
                                        day={each}
                                        index={index}
                                        pinned={each.date === picked}
                                        reading={scrub.index}
                                        tint={primary}
                                        success={colors.success}
                                        idle={isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.09)'}
                                        onPress={() => {
                                            lightFeedback();
                                            setPicked(current => (current === each.date ? null : each.date));
                                        }}
                                    />
                                ))}
                                <ScrubLine x={scrub.x} active={scrub.active} color={colors.textTertiary} height={vs(96)} />
                            </View>
                        </GestureDetector>

                        <View style={styles.chartFoot}>
                            <Text style={[styles.foot, { color: colors.textTertiary }]}>{shortDay(result.window[0]?.date ?? '')}</Text>
                            <Text style={[styles.foot, { color: colors.textTertiary }]}>
                                {picked ? 'Tap again to close' : 'Drag across the days'}
                            </Text>
                            <Text style={[styles.foot, { color: colors.textTertiary }]}>Yesterday</Text>
                        </View>

                        {/* The day, opened. It morphs the card taller rather than
                            covering the chart, so the bar you tapped stays in view. */}
                        {day ? (
                            <Animated.View
                                entering={FadeIn.duration(200)}
                                exiting={FadeOut.duration(140)}
                                layout={MORPH}
                                testID="day-detail"
                                style={[styles.dayPanel, { borderTopColor: colors.border }]}
                            >
                                <DayDetail day={day} names={names} colors={colors} tint={primary} />
                            </Animated.View>
                        ) : null}
                    </VoidCard>
                </Animated.View>

                {/* The part that can actually be acted on. */}
                {ranked.length ? (
                    <>
                        <Text style={[styles.sectionLabel, styles.sectionTop, { color: colors.textTertiary }]}>WEAKEST FIRST</Text>
                        <Text style={[styles.sectionNote, { color: colors.textTertiary }]}>
                            One habit slipping is usually why everything else looks worse than it feels.
                        </Text>
                        <Animated.View layout={MORPH} style={styles.list}>
                            {ranked.map(item => (
                                <VoidCard key={item.id} {...surface} style={[styles.habitRow, glassy()]}>
                                    <View style={styles.habitTop}>
                                        <Text numberOfLines={1} style={[styles.habitName, { color: colors.textPrimary }]}>{item.name}</Text>
                                        <Text style={[styles.habitRate, { color: colors.textPrimary }]}>{item.rate}%</Text>
                                        {item.comparable && item.delta !== 0 ? (
                                            <Text style={[styles.habitDelta, { color: item.delta > 0 ? colors.success : colors.warning }]}>
                                                {`${item.delta > 0 ? '+' : ''}${item.delta}`}
                                            </Text>
                                        ) : null}
                                    </View>
                                    <Meter
                                        share={item.countable ? item.kept / item.countable : 0}
                                        tint={item.rate >= 70 ? colors.success : item.rate >= 40 ? primary : colors.warning}
                                        idle={isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.09)'}
                                    />
                                    <Text style={[styles.habitFoot, { color: colors.textSecondary }]}>
                                        {item.kept} kept of {item.countable} asked for
                                    </Text>
                                </VoidCard>
                            ))}
                        </Animated.View>
                    </>
                ) : (
                    <Text style={[styles.empty, { color: colors.textSecondary }]}>
                        Your habits will appear here once they have been due for a few days.
                    </Text>
                )}
            </ScrollView>
        </VoidModal>
    );
};

const Stat = ({ label, value, colors, divider }: { label: string; value: string; colors: typeof Colors.light; divider?: boolean }) => (
    <View style={[styles.stat, divider && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border }]}>
        <Text style={[styles.statValue, { color: colors.textPrimary }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
);

/** What a single day asked for, and what became of it. */
const DayDetail = ({ day, names, colors, tint }: {
    day: HabitDay; names: Map<string, string>; colors: typeof Colors.light; tint: string;
}) => {
    const countable = day.scheduled.length - day.skipped.length;
    return (
        <View style={styles.dayInner}>
            <View style={styles.dayHead}>
                <Text style={[styles.dayTitle, { color: colors.textPrimary }]}>{longDay(day.date)}</Text>
                <Text style={[styles.dayCount, { color: colors.textSecondary }]}>
                    {countable === 0 ? 'Nothing due' : `${day.done.length} of ${countable} kept`}
                </Text>
            </View>

            {day.scheduled.length === 0 ? (
                <Text style={[styles.dayEmpty, { color: colors.textTertiary }]}>No habits were due on this day.</Text>
            ) : (
                <View style={styles.dayList}>
                    {day.scheduled.map(id => {
                        const done = day.done.includes(id);
                        const skipped = day.skipped.includes(id);
                        const colour = skipped ? colors.textTertiary : done ? colors.success : colors.warning;
                        return (
                            <View key={id} style={styles.dayRow}>
                                <Ionicons
                                    name={skipped ? 'remove-circle-outline' : done ? 'checkmark-circle' : 'close-circle-outline'}
                                    size={s(16)}
                                    color={colour}
                                />
                                <Text
                                    numberOfLines={1}
                                    style={[styles.dayName, {
                                        color: done || skipped ? colors.textSecondary : colors.textPrimary,
                                        textDecorationLine: done ? 'line-through' : 'none',
                                    }]}
                                >
                                    {names.get(id) ?? 'Habit'}
                                </Text>
                                {skipped ? <Text style={[styles.daySkip, { color: tint }]}>skipped</Text> : null}
                            </View>
                        );
                    })}
                </View>
            )}
        </View>
    );
};

/** One day. Grows on first paint, and lifts when it is the one being read. */
const Bar = ({ day, index, pinned, reading, tint, success, idle, onPress }: {
    day: HabitDay; index: number; pinned: boolean;
    /** The day under the finger, as a shared value, so a drag costs no render. */
    reading: SharedValue<number>;
    tint: string; success: string; idle: string; onPress: () => void;
}) => {
    const countable = day.scheduled.length - day.skipped.length;
    const share = countable > 0 ? day.done.length / countable : 0;
    const perfect = countable > 0 && day.done.length === countable;

    const grown = useSharedValue(0);
    const pin = useSharedValue(pinned ? 1 : 0);
    React.useEffect(() => {
        grown.set(withDelay(index * 8, withTiming(Math.max(share, day.done.length > 0 ? 0.12 : 0.04), EASE)));
    }, [share, index, grown, day.done.length]);
    React.useEffect(() => {
        pin.set(withTiming(pinned ? 1 : 0, { duration: 200, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
    }, [pinned, pin]);

    const height = useAnimatedStyle(() => ({ height: `${grown.get() * 100}%` }));
    // The lift under the finger is instant and unanimated on purpose: a 200ms
    // ease would always be trailing where the finger actually is.
    const focus = useAnimatedStyle(() => {
        const on = Math.max(pin.get(), reading.get() === index ? 1 : 0);
        return { opacity: 0.55 + on * 0.45, transform: [{ scaleX: 1 + on * 0.6 }] };
    });

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: pinned }}
            accessibilityLabel={`${longDay(day.date)}, ${day.done.length} of ${countable} kept`}
            hitSlop={{ top: 6, bottom: 6 }}
            onPress={onPress}
            style={styles.barTrack}
        >
            <Animated.View
                style={[styles.bar, height, focus, {
                    backgroundColor: countable === 0 ? idle : perfect ? success : day.done.length > 0 ? tint : idle,
                }]}
            />
        </Pressable>
    );
};

/** A habit's share of what it was asked for. */
const Meter = ({ share, tint, idle }: { share: number; tint: string; idle: string }) => {
    const filled = useSharedValue(0);
    React.useEffect(() => { filled.value = withTiming(Math.min(1, Math.max(0, share)), EASE); }, [share, filled]);
    const style = useAnimatedStyle(() => ({ width: `${filled.value * 100}%` }));
    return (
        <View style={[styles.meter, { backgroundColor: idle }]}>
            <Animated.View style={[styles.meterFill, style, { backgroundColor: tint }]} />
        </View>
    );
};

const styles = StyleSheet.create({
    content: { paddingHorizontal: s(20), paddingBottom: vs(40), gap: vs(12) },
    hero: { padding: s(20), gap: vs(4) },
    heroTop: { flexDirection: 'row', alignItems: 'center', gap: s(10) },
    heroValue: { fontFamily: FontFamily.bold, fontSize: ms(46), lineHeight: ms(54), letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
    deltaPill: { flexDirection: 'row', alignItems: 'center', gap: s(3), paddingHorizontal: s(8), paddingVertical: vs(4), borderRadius: 999 },
    deltaText: { fontSize: ms(13), fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
    heroLabel: { fontSize: ms(13), lineHeight: ms(19), fontFamily: FontFamily.regular },
    heroSplit: { flexDirection: 'row', marginTop: vs(14), paddingTop: vs(14), borderTopWidth: StyleSheet.hairlineWidth },
    stat: { flex: 1, alignItems: 'center', gap: vs(2) },
    statValue: { fontFamily: FontFamily.bold, fontSize: ms(20), lineHeight: ms(26), fontVariant: ['tabular-nums'] },
    statLabel: { fontSize: ms(10), lineHeight: ms(15), fontFamily: FontFamily.regular, textAlign: 'center' },
    sectionLabel: { fontSize: ms(11), lineHeight: ms(16), letterSpacing: 1.5, fontFamily: FontFamily.bold },
    sectionNote: { fontSize: ms(12), lineHeight: ms(18), fontFamily: FontFamily.regular, marginTop: vs(-6) },
    sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: vs(10) },
    sectionTop: { marginTop: vs(10) },
    windows: { flexDirection: 'row', gap: s(6) },
    window: { paddingHorizontal: s(11), paddingVertical: vs(6), borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
    windowText: { fontSize: ms(11), fontFamily: FontFamily.medium },
    chartCard: { padding: s(16), gap: vs(10) },
    readout: { gap: vs(1) },
    readDay: { fontSize: ms(14), lineHeight: ms(20), fontFamily: FontFamily.bold },
    readKept: { fontSize: ms(12), lineHeight: ms(18), fontFamily: FontFamily.regular },
    chart: { flexDirection: 'row', alignItems: 'flex-end', gap: s(2), height: vs(96) },
    barTrack: { flex: 1, height: '100%', justifyContent: 'flex-end' },
    bar: { width: '100%', borderRadius: s(3), minHeight: vs(3) },
    chartFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    foot: { fontSize: ms(10), lineHeight: ms(15), fontFamily: FontFamily.regular },
    dayPanel: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: vs(12) },
    dayInner: { gap: vs(8) },
    dayHead: { gap: vs(2) },
    dayTitle: { fontSize: ms(14), lineHeight: ms(20), fontFamily: FontFamily.bold },
    dayCount: { fontSize: ms(12), lineHeight: ms(18), fontFamily: FontFamily.regular },
    dayList: { gap: vs(6) },
    dayRow: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
    dayName: { flex: 1, fontSize: ms(13), lineHeight: ms(19), fontFamily: FontFamily.regular },
    daySkip: { fontSize: ms(10), fontFamily: FontFamily.medium },
    dayEmpty: { fontSize: ms(12), lineHeight: ms(18), fontFamily: FontFamily.regular },
    list: { gap: vs(10) },
    habitRow: { padding: s(16), gap: vs(8) },
    habitTop: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
    habitName: { flex: 1, fontSize: ms(14), lineHeight: ms(20), fontFamily: FontFamily.medium },
    habitRate: { fontFamily: FontFamily.bold, fontSize: ms(17), fontVariant: ['tabular-nums'] },
    habitDelta: { fontSize: ms(11), fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
    habitFoot: { fontSize: ms(11), lineHeight: ms(16), fontFamily: FontFamily.regular },
    meter: { height: vs(5), borderRadius: s(3), overflow: 'hidden' },
    meterFill: { height: '100%', borderRadius: s(3) },
    empty: { fontSize: ms(13), lineHeight: ms(19), fontFamily: FontFamily.regular, textAlign: 'center', paddingVertical: vs(28) },
});
