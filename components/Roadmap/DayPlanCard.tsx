import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { VoidCard } from '@/components/Layout/VoidCard';
import { TASK_COLOR } from '@/components/Roadmap/TaskItem';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/DesignSystem';
import { useTheme } from '@/constants/themeContext';
import { clockOf, spanLabel, type DayPlan } from '@/lib/dayPlan';

/**
 * How much day there is, and where things go in it.
 *
 * The headline is the hours left before bed. Under it the waking day is one
 * bar — what is behind you shaded, a line where now is, and every habit and
 * task that has a time sitting on it — so a crowded evening or an empty
 * afternoon can be seen rather than worked out. Then the free windows big
 * enough to use, and whatever still has no time.
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
    const isTrueDark = theme === 'trueDark';
    const [width, setWidth] = useState(0);
    const span = Math.max(1, plan.sleep - plan.wake);
    const x = (minutes: number) => ((Math.min(plan.sleep, Math.max(plan.wake, minutes)) - plan.wake) / span) * width;
    const over = plan.spare < 0;
    const track = light ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.06)';

    return (
        <VoidCard glass={!isTrueDark} intensity={light ? 20 : 80} style={[styles.card, light && { backgroundColor: colors.surfaceSecondary }]}>
            <View style={styles.head}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.eyebrow, { color: colors.textTertiary }]}>{isToday ? 'LEFT TODAY' : 'AWAKE THAT DAY'}</Text>
                    <Text style={[styles.left, { color: colors.textPrimary }]}>{plan.left > 0 ? spanLabel(plan.left) : 'Day done'}</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={`Awake ${clockOf(plan.wake)} to ${clockOf(plan.sleep)}. Change your day.`}
                    onPress={onEditDay} hitSlop={8} style={[styles.window, { backgroundColor: track }]}>
                    <Ionicons name="sunny-outline" size={12} color={colors.textSecondary} />
                    <Text style={[styles.windowText, { color: colors.textSecondary }]}>{clockOf(plan.wake)}</Text>
                    <Ionicons name="moon-outline" size={12} color={colors.textSecondary} />
                    <Text style={[styles.windowText, { color: colors.textSecondary }]}>{clockOf(plan.sleep)}</Text>
                </Pressable>
            </View>

            {/* The waking day, wake on the left and bed on the right. */}
            <View style={[styles.bar, { backgroundColor: track }]} onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
                accessible accessibilityLabel={`${plan.blocks.length} things at set times today.`}>
                {width > 0 && plan.now !== null ? (
                    <View style={[styles.past, { width: x(plan.now), backgroundColor: light ? 'rgba(15,23,42,0.06)' : 'rgba(0,0,0,0.35)' }]} />
                ) : null}
                {width > 0 ? plan.blocks.map(block => (
                    <View key={`${block.kind}:${block.id}`} style={[styles.block, {
                        left: x(block.start), width: Math.max(4, x(block.end) - x(block.start)),
                        backgroundColor: block.kind === 'task' ? TASK_COLOR : (block.color || accent),
                        opacity: block.done ? 0.3 : 0.9,
                    }]} />
                )) : null}
                {width > 0 && plan.now !== null ? (
                    <View style={[styles.now, { left: x(plan.now) - 1, backgroundColor: colors.textPrimary }]}>
                        <View style={[styles.nowDot, { backgroundColor: colors.textPrimary }]} />
                    </View>
                ) : null}
            </View>
            <View style={styles.axis}>
                <Text style={[styles.axisText, { color: colors.textTertiary }]}>{clockOf(plan.wake)}</Text>
                {plan.now !== null ? <Text style={[styles.axisText, { color: colors.textSecondary }]}>now {clockOf(plan.now)}</Text> : null}
                <Text style={[styles.axisText, { color: colors.textTertiary }]}>{clockOf(plan.sleep)}</Text>
            </View>

            <View style={styles.stats}>
                <Stat label="Planned" value={plan.planned ? spanLabel(plan.planned) : '—'} color={colors.textPrimary} sub={colors.textTertiary} />
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Stat label={over ? 'Over by' : 'Spare'} value={spanLabel(Math.abs(plan.spare))} color={over ? colors.error : colors.success} sub={colors.textTertiary} />
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Stat label="No time yet" value={String(plan.unplaced.length)} color={plan.unplaced.length ? TASK_COLOR : colors.textPrimary} sub={colors.textTertiary} />
            </View>

            {plan.free.length && plan.left > 0 ? (
                <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>FREE WINDOWS</Text>
                    <View style={styles.chips}>
                        {plan.free.map(slot => (
                            <View key={slot.start} style={[styles.chip, { borderColor: accent + '55', backgroundColor: accent + '14' }]}>
                                <Text style={[styles.chipTime, { color: colors.textPrimary }]}>{clockOf(slot.start)}–{clockOf(slot.end)}</Text>
                                <Text style={[styles.chipSpan, { color: accent }]}>{spanLabel(slot.end - slot.start)}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            ) : null}

            {plan.unplaced.length ? (
                <Text style={[styles.unplaced, { color: colors.textSecondary }]} numberOfLines={2}>
                    <Text style={{ fontFamily: FontFamily.semibold, color: colors.textPrimary }}>Give these a time: </Text>
                    {plan.unplaced.slice(0, 4).map(item => item.minutes ? `${item.title} (${spanLabel(item.minutes)})` : item.title).join(' · ')}
                    {plan.unplaced.length > 4 ? ` · +${plan.unplaced.length - 4}` : ''}
                </Text>
            ) : null}
        </VoidCard>
    );
};

const Stat = ({ label, value, color, sub }: { label: string; value: string; color: string; sub: string }) => (
    <View style={styles.stat}>
        <Text style={[styles.statValue, { color }]} numberOfLines={1}>{value}</Text>
        <Text style={[styles.statLabel, { color: sub }]}>{label}</Text>
    </View>
);

const styles = StyleSheet.create({
    card: { padding: 16, borderRadius: 22, marginBottom: 14, gap: 12 },
    head: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
    eyebrow: { fontSize: 10, letterSpacing: 1.6, fontFamily: FontFamily.semibold },
    left: { fontSize: 30, fontFamily: FontFamily.bold, letterSpacing: -0.8, fontVariant: ['tabular-nums'], marginTop: 2 },
    window: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
    windowText: { fontSize: 12, fontFamily: FontFamily.semibold, fontVariant: ['tabular-nums'] },
    bar: { height: 30, borderRadius: 10, overflow: 'hidden' },
    past: { position: 'absolute', left: 0, top: 0, bottom: 0 },
    block: { position: 'absolute', top: 5, bottom: 5, borderRadius: 5 },
    now: { position: 'absolute', top: 0, bottom: 0, width: 2 },
    nowDot: { position: 'absolute', top: -1, left: -2, width: 6, height: 6, borderRadius: 3 },
    axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -6 },
    axisText: { fontSize: 10, fontFamily: FontFamily.medium, fontVariant: ['tabular-nums'] },
    stats: { flexDirection: 'row', alignItems: 'center' },
    stat: { flex: 1, alignItems: 'center', gap: 2 },
    statValue: { fontSize: 15, fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
    statLabel: { fontSize: 11, fontFamily: FontFamily.regular },
    divider: { width: StyleSheet.hairlineWidth, height: 26 },
    section: { gap: 8 },
    sectionLabel: { fontSize: 10, letterSpacing: 1.4, fontFamily: FontFamily.semibold },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 12, borderWidth: 1 },
    chipTime: { fontSize: 13, fontFamily: FontFamily.semibold, fontVariant: ['tabular-nums'] },
    chipSpan: { fontSize: 12, fontFamily: FontFamily.semibold },
    unplaced: { fontSize: 12, lineHeight: 17, fontFamily: FontFamily.regular },
});
