import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { TASK_COLOR } from '@/components/Roadmap/TaskItem';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/DesignSystem';
import { useTheme } from '@/constants/themeContext';
import { clockOf, spanLabel, type DayPlan } from '@/lib/dayPlan';

/**
 * The waking day as a calendar shows it: a thin hour track, a red line where
 * now is, and the things with a time sitting on it.
 *
 * It used to be a card of its own with a big headline, three numbers and a
 * row of free-window chips. It is now one quiet line above the list, the way
 * a calendar app marks the time without making you read about it.
 */
export const DayPlanCard: React.FC<{
    plan: DayPlan;
    accent: string;
    isToday: boolean;
    onEditDay: () => void;
}> = ({ plan, accent, isToday, onEditDay }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const light = theme === 'light';
    const [width, setWidth] = useState(0);
    const span = Math.max(1, plan.sleep - plan.wake);
    const x = (minutes: number) => ((Math.min(plan.sleep, Math.max(plan.wake, minutes)) - plan.wake) / span) * width;
    const track = light ? 'rgba(15,23,42,0.07)' : 'rgba(255,255,255,0.08)';
    const nowColor = colors.error;

    // An hour mark every three hours, labelled like a calendar's gutter.
    const ticks: number[] = [];
    for (let minutes = Math.ceil(plan.wake / 180) * 180; minutes < plan.sleep; minutes += 180) {
        if (minutes > plan.wake) ticks.push(minutes);
    }

    const summary = isToday
        ? (plan.left > 0 ? `${spanLabel(plan.left)} left` : 'Day done')
        : `${clockOf(plan.wake)}–${clockOf(plan.sleep)}`;

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${summary}. Awake ${clockOf(plan.wake)} to ${clockOf(plan.sleep)}. ${plan.blocks.length} things at set times. Change your day.`}
            onPress={onEditDay}
            style={styles.wrap}
        >
            <View style={styles.head}>
                <Text style={[styles.summary, { color: colors.textSecondary }]}>{summary}</Text>
                {isToday ? (
                    <Text style={[styles.window, { color: colors.textTertiary }]}>{clockOf(plan.wake)}–{clockOf(plan.sleep)}</Text>
                ) : null}
            </View>

            <View style={styles.trackArea} onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
                <View style={[styles.track, { backgroundColor: track }]} />
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
                {width > 0 && plan.now !== null ? (
                    <View style={[styles.now, { left: x(plan.now) - 1, backgroundColor: nowColor }]}>
                        <View style={[styles.nowDot, { backgroundColor: nowColor }]} />
                    </View>
                ) : null}
            </View>

            <View style={styles.axis}>
                {width > 0 ? ticks.map(minutes => (
                    <Text key={minutes} style={[styles.axisText, { left: x(minutes) - 16, color: colors.textTertiary }]}>{clockOf(minutes)}</Text>
                )) : null}
            </View>
        </Pressable>
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
    now: { position: 'absolute', width: 2, height: 14, borderRadius: 1 },
    nowDot: { position: 'absolute', top: 3, left: -3, width: 8, height: 8, borderRadius: 4 },
    axis: { height: 14, marginTop: 4 },
    axisText: { position: 'absolute', width: 32, textAlign: 'center', fontSize: 10, fontFamily: FontFamily.medium, fontVariant: ['tabular-nums'] },
});
