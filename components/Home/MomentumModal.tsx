import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { VoidModal } from '@/components/ui/VoidModal';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { VoidCard } from '@/components/ui/VoidCard';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { CountUp, ListItem, useProgress } from '@/components/ui/Motion';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { habitMomentum, momentum, weeklyKept } from '@/lib/momentum';
import type { Habit } from '@/lib/habitsSQLite';
import type { HistoryDay } from '@/lib/habitDays';

const CHART = 120;

/**
 * Trend: are you getting better?
 *
 * One sentence answers it — the share of your habits you kept in the last 30
 * days, against the 30 before. The bars show the same thing week by week, so
 * the direction is a shape, not a number to remember. Then which habits are
 * rising and which are slipping, so you know where to look.
 */
export const MomentumModal: React.FC<{
    visible: boolean;
    onClose: () => void;
    habits: Habit[];
    history: HistoryDay[];
    completions: Record<string, boolean>;
}> = ({ visible, onClose, habits, history, completions }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();

    const trend = useMemo(() => momentum(habits, history, completions, 30), [habits, history, completions]);
    const weeks = useMemo(() => weeklyKept(habits, history, completions, 8), [habits, history, completions]);
    const perHabit = useMemo(() => habitMomentum(habits, history, completions, 30), [habits, history, completions]);
    const rising = perHabit.filter(item => item.comparable && item.delta > 0).sort((a, b) => b.delta - a.delta);
    const slipping = perHabit.filter(item => item.comparable && item.delta < 0).sort((a, b) => a.delta - b.delta);

    const up = trend.comparable && trend.delta > 0;
    const down = trend.comparable && trend.delta < 0;
    const changeLine = !trend.comparable ? '' : trend.delta === 0 ? 'Same as last month' : `${up ? '↑' : '↓'} ${Math.abs(trend.delta)} vs last month`;

    return (
        <VoidModal visible={visible} onClose={onClose}>
            <ModalHeader title="Trend" onBack={onClose} />
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.hero}>
                    <CountUp style={[styles.heroValue, { color: colors.textPrimary }]} value={`${trend.rate}%`} replay={visible} />
                    <Text style={[styles.heroText, { color: colors.textSecondary }]}>of habits kept · last 30 days</Text>
                    {changeLine ? <Text style={[styles.change, { color: up ? colors.success : down ? colors.warning : colors.textTertiary }]}>{changeLine}</Text> : null}
                </View>

                <SectionTitle>Week by week</SectionTitle>
                <VoidCard style={styles.chartCard}>
                    <View style={styles.chart} accessible accessibilityLabel={`Habits kept per week: ${weeks.map(week => (week.rate === null ? 'none' : `${week.rate} percent`)).join(', ')}`}>
                        {weeks.map((week, index) => (
                            <View key={week.start || index} style={styles.barCol}>
                                <WeekBar share={(week.rate ?? 0) / 100} index={index} color={week.rate === null ? colors.surfaceTertiary : index === weeks.length - 1 ? primary : primary + '88'} />{/* ui-allow: dim */}
                                <Text style={[styles.barLabel, { color: colors.textTertiary }]}>{week.rate === null ? '–' : `${week.rate}`}</Text>
                            </View>
                        ))}
                    </View>
                    <View style={styles.axis}>
                        <Text style={[styles.axisText, { color: colors.textTertiary }]}>8 weeks ago</Text>
                        <Text style={[styles.axisText, { color: colors.textTertiary }]}>Last week</Text>
                    </View>
                </VoidCard>

                {rising.length ? (
                    <>
                        <SectionTitle>Rising</SectionTitle>
                        <HabitList items={rising} tint={colors.success} />
                    </>
                ) : null}
                {slipping.length ? (
                    <>
                        <SectionTitle>Slipping</SectionTitle>
                        <HabitList items={slipping} tint={colors.warning} />
                    </>
                ) : null}
            </ScrollView>
        </VoidModal>
    );
};

function HabitList({ items, tint }: { items: { id: string; name: string; rate: number; delta: number }[]; tint: string }) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    return (
        <VoidCard style={styles.list}>
            {items.map((item, index) => (
                <ListItem key={item.id} index={index}>
                    <View style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                        <Text numberOfLines={1} style={[styles.rowName, { color: colors.textPrimary }]}>{item.name}</Text>
                        <Text style={[styles.rowRate, { color: colors.textSecondary }]}>{item.rate}%</Text>
                        <Text style={[styles.rowDelta, { color: tint }]}>{item.delta > 0 ? '↑' : '↓'} {Math.abs(item.delta)}</Text>
                    </View>
                </ListItem>
            ))}
        </VoidCard>
    );
}

function WeekBar({ share, index, color }: { share: number; index: number; color: string }) {
    const grown = useProgress(Math.max(0.04, Math.min(1, share)), index * 50);
    const style = useAnimatedStyle(() => ({ height: grown.get() * CHART }));
    return (
        <View style={styles.barTrack}>
            <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />
        </View>
    );
}

const styles = StyleSheet.create({
    content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.bottom },
    hero: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.lg },
    heroValue: { fontFamily: FontFamily.bold, fontSize: 56, lineHeight: 62, letterSpacing: -2, fontVariant: ['tabular-nums'] },
    heroText: { fontFamily: FontFamily.medium, fontSize: 15, textAlign: 'center' },
    change: { fontFamily: FontFamily.semibold, fontSize: 14, textAlign: 'center', marginTop: Spacing.xs },
    chartCard: { padding: Spacing.lg, gap: Spacing.sm },
    chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: CHART + 20 },
    barCol: { flex: 1, alignItems: 'center', gap: Spacing.xs },
    barTrack: { width: 18, height: CHART, justifyContent: 'flex-end' },
    bar: { width: '100%', borderRadius: 6 },
    barLabel: { fontFamily: FontFamily.medium, fontSize: 10, fontVariant: ['tabular-nums'] },
    axis: { flexDirection: 'row', justifyContent: 'space-between' },
    axisText: { fontFamily: FontFamily.regular, fontSize: 11 },
    list: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
    rowName: { flex: 1, fontFamily: FontFamily.medium, fontSize: 15 },
    rowRate: { fontFamily: FontFamily.medium, fontSize: 14, fontVariant: ['tabular-nums'] },
    rowDelta: { width: 44, textAlign: 'right', fontFamily: FontFamily.semibold, fontSize: 13, fontVariant: ['tabular-nums'] },
});
