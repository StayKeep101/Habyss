import React, { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { AppIcon } from '@/components/ui/AppIcon';
import { useHaptics } from '@/hooks/useHaptics';
import { TASK_COLOR } from '@/components/Roadmap/TaskItem';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { blocksAt, clockOf, spanLabel, type DayPlan } from '@/lib/dayPlan';

/**
 * The waking day as a calendar shows it: a thin hour track, the part already
 * lived filled in, and the things with a time sitting on it.
 *
 * One accent line is both "now" and the finger: it rests where the day is,
 * follows a drag (or a tap) to show the time and every habit and task set for
 * then, and glides back to now when the finger lets go.
 */
export const DayPlanCard: React.FC<{
    plan: DayPlan;
    accent: string;
    isToday: boolean;
    /** No longer used: the strip is for reading the day, not opening settings. */
    onEditDay?: () => void;
}> = ({ plan, accent, isToday }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const light = theme === 'light';
    const [width, setWidth] = useState(0);
    const span = Math.max(1, plan.sleep - plan.wake);
    const x = (minutes: number) => ((Math.min(plan.sleep, Math.max(plan.wake, minutes)) - plan.wake) / span) * width;
    const track = light ? 'rgba(15,23,42,0.07)' : 'rgba(255,255,255,0.08)';
    const { selectionFeedback } = useHaptics();

    // The minute under the finger, while reading the day.
    const [scrub, setScrub] = useState<number | null>(null);
    const hide = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastHour = useRef<number | null>(null);
    const minuteAt = (pageX: number) => Math.round(plan.wake + (Math.max(0, Math.min(width, pageX)) / Math.max(1, width)) * span);
    const read = (localX: number) => {
        if (hide.current) clearTimeout(hide.current);
        const minute = minuteAt(localX);
        // A light tick each hour passed, so the finger feels the clock.
        const hour = Math.floor(minute / 60);
        if (hour !== lastHour.current) { lastHour.current = hour; selectionFeedback(); }
        setScrub(minute);
    };
    const release = () => {
        if (hide.current) clearTimeout(hide.current);
        hide.current = setTimeout(() => { setScrub(null); lastHour.current = null; }, 1800);
    };
    useEffect(() => () => { if (hide.current) clearTimeout(hide.current); }, []);

    // The marker: on the finger while reading, otherwise on now (today only).
    const marker = scrub ?? plan.now;
    const markerX = useSharedValue(0);
    const placed = useRef(false);
    useEffect(() => {
        if (marker === null || width === 0) return;
        const target = x(marker) - 1.5;
        if (scrub !== null || !placed.current) markerX.set(target);
        else markerX.set(withTiming(target, { duration: 320 }));
        placed.current = true;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [marker, width, scrub !== null]);
    const markerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: markerX.get() }] }));
    const pan = Gesture.Pan()
        .activeOffsetX([-6, 6])
        .failOffsetY([-14, 14])
        .onBegin(event => { runOnJS(read)(event.x); })
        .onUpdate(event => { runOnJS(read)(event.x); })
        .onFinalize(() => { runOnJS(release)(); });
    const tap = Gesture.Tap().onEnd(event => { runOnJS(read)(event.x); runOnJS(release)(); });
    const gesture = Gesture.Exclusive(pan, tap);
    const atScrub = scrub === null ? [] : blocksAt(plan, scrub);

    // An hour mark every three hours, labelled like a calendar's gutter.
    const ticks: number[] = [];
    for (let minutes = Math.ceil(plan.wake / 180) * 180; minutes < plan.sleep; minutes += 180) {
        if (minutes > plan.wake) ticks.push(minutes);
    }

    const summary = isToday
        ? (plan.left > 0 ? `${spanLabel(plan.left)} left` : 'Day done')
        : `${clockOf(plan.wake)}–${clockOf(plan.sleep)}`;

    return (
        <GestureDetector gesture={gesture}>
        <View
            accessible
            accessibilityLabel={`${summary}. Awake ${clockOf(plan.wake)} to ${clockOf(plan.sleep)}. ${plan.blocks.length} things at set times. Drag along it to see what is on when.`}
            style={styles.wrap}
        >
            <View style={styles.head}>
                {scrub === null ? (
                    <>
                        <Text style={[styles.summary, { color: colors.textSecondary }]}>{summary}</Text>
                        {isToday ? (
                            <Text style={[styles.window, { color: colors.textTertiary }]}>{clockOf(plan.wake)}–{clockOf(plan.sleep)}</Text>
                        ) : null}
                    </>
                ) : (
                    <Text style={[styles.summary, { color: accent }]}>{clockOf(scrub)}</Text>
                )}
            </View>

            <View style={styles.trackArea} onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
                <View style={[styles.track, { backgroundColor: track }]} />
                {width > 0 && plan.now !== null ? (
                    <View style={[styles.lived, { width: x(plan.now), backgroundColor: accent }]} />
                ) : null}
                {width > 0 ? ticks.map(minutes => (
                    <View key={minutes} style={[styles.tick, { left: x(minutes), backgroundColor: track }]} />
                )) : null}
                {width > 0 ? plan.blocks.map(block => (
                    <View key={`${block.kind}:${block.id}`} style={[styles.block, {
                        left: x(block.start), width: Math.max(3, x(block.end) - x(block.start)),
                        backgroundColor: block.kind === 'task' ? TASK_COLOR : (block.color || accent),
                        opacity: block.done ? 0.35 : 0.85,
                    }]} />
                )) : null}
                {width > 0 && marker !== null ? (
                    <Animated.View pointerEvents="none" style={[styles.cursor, { backgroundColor: accent }, markerStyle]} />
                ) : null}
            </View>

            <View style={styles.axis}>
                {width > 0 ? ticks.map(minutes => (
                    <Text key={minutes} style={[styles.axisText, { left: x(minutes) - 16, color: colors.textTertiary }]}>{clockOf(minutes)}</Text>
                )) : null}
            </View>

            {/* What is on at the finger's time. */}
            {scrub !== null ? (
                <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(160)} style={styles.readout}>
                    {atScrub.length === 0 ? (
                        <Text style={[styles.free, { color: colors.textTertiary }]}>Nothing set for {clockOf(scrub)}</Text>
                    ) : atScrub.map(block => (
                        <View key={`${block.kind}:${block.id}`} style={styles.item}>
                            <View style={[styles.itemDot, { backgroundColor: block.kind === 'task' ? TASK_COLOR : (block.color || accent) }]} />
                            <Text numberOfLines={1} style={[styles.itemTitle, { color: block.done ? colors.textTertiary : colors.textPrimary, textDecorationLine: block.done ? 'line-through' : 'none' }]}>
                                {block.title}
                            </Text>
                            <Text style={[styles.itemTime, { color: colors.textTertiary }]}>
                                {block.end > block.start ? `${clockOf(block.start)}–${clockOf(block.end)}` : clockOf(block.start)}
                            </Text>
                            {block.done ? <AppIcon name="checkmark" size={13} color={colors.success} /> : null}
                        </View>
                    ))}
                </Animated.View>
            ) : null}
        </View>
        </GestureDetector>
    );
};

const styles = StyleSheet.create({
    wrap: { marginBottom: 14, paddingTop: 2 },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
    summary: { fontSize: 13, fontFamily: FontFamily.semibold, fontVariant: ['tabular-nums'] },
    window: { fontSize: 12, fontFamily: FontFamily.medium, fontVariant: ['tabular-nums'] },
    trackArea: { height: 14, justifyContent: 'center' },
    track: { position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2 },
    tick: { position: 'absolute', width: StyleSheet.hairlineWidth * 2, height: 10 },
    block: { position: 'absolute', height: 4, borderRadius: 2 },
    lived: { position: 'absolute', left: 0, height: 4, borderRadius: 2, opacity: 0.3 },
    cursor: { position: 'absolute', left: 0, width: 3, height: 22, top: -4, borderRadius: 1.5 },
    readout: { marginTop: 10, gap: 6 },
    free: { fontSize: 13, fontFamily: FontFamily.medium },
    item: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    itemDot: { width: 8, height: 8, borderRadius: 4 },
    itemTitle: { flex: 1, fontSize: 14, fontFamily: FontFamily.medium },
    itemTime: { fontSize: 12, fontFamily: FontFamily.medium, fontVariant: ['tabular-nums'] },
    axis: { height: 14, marginTop: 4 },
    axisText: { position: 'absolute', width: 32, textAlign: 'center', fontSize: 10, fontFamily: FontFamily.medium, fontVariant: ['tabular-nums'] },
});
