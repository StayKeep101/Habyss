import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { VoidModal } from '@/components/Layout/VoidModal';
import { ModalHeader } from '@/components/Layout/ModalHeader';
import { GoalProgressChart } from '@/components/Goal/GoalProgressChart';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/DesignSystem';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { MARKS, RANKS, type MarkEvent } from '@/lib/marks';
import type { GoalPoint } from '@/lib/goalInsights';
import type { Marks } from '@/hooks/useMarks';

const longDay = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const shortDay = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

const VERB: Record<MarkEvent['kind'], string> = { add: 'Added', complete: 'Completed', miss: 'Missed' };

/**
 * Marks over time, read like a portfolio.
 *
 * The headline is the balance and how it moved; the chart is every day since
 * the first mark, with a finger to read any of them; then the ladder you are
 * climbing, what moved the number lately, and the rules — all of them, so
 * nothing about it has to be taken on trust.
 */
export const MarksModal: React.FC<{ visible: boolean; onClose: () => void; marks: Marks }> = ({ visible, onClose, marks }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary, foreground } = useAccentGradient();
    const [scrub, setScrub] = useState<GoalPoint | null>(null);

    const series = useMemo<GoalPoint[]>(
        () => marks.series.map(point => ({ date: point.date, actual: point.value, pace: point.value, value: point.value })),
        [marks.series],
    );
    // How much the balance moved over the last 30 days, like a fund's 1M.
    const monthAgo = series.length > 30 ? series[series.length - 31].actual : 0;
    const change30 = marks.total - monthAgo;
    const shown = scrub ? scrub.actual : marks.total;
    const tile = isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.04)';

    return (
        <VoidModal visible={visible} onClose={onClose}>
            <ModalHeader title="MARKS" onBack={onClose} />
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} scrollEnabled={!scrub}>
                <Text style={[styles.rankLabel, { color: foreground }]}>{marks.rank.name.toUpperCase()}</Text>
                <Text style={[styles.balance, { color: colors.textPrimary }]}>{shown.toLocaleString()}</Text>
                {scrub ? (
                    <Text style={[styles.sub, { color: colors.textSecondary }]}>{longDay(scrub.date)}</Text>
                ) : (
                    <View style={styles.changeRow}>
                        <Change value={marks.todayChange} label="today" />
                        <Change value={change30} label="30 days" />
                    </View>
                )}

                <View style={{ height: 18 }} />
                {series.length > 1 ? (
                    <GoalProgressChart series={series} color={primary} height={190} onScrub={setScrub} unbounded label="Marks" />
                ) : (
                    <View style={[styles.empty, { backgroundColor: tile }]}>
                        <Text style={[styles.sub, { color: colors.textTertiary }]}>The chart draws from your second day.</Text>
                    </View>
                )}

                <Text style={[styles.section, { color: colors.textTertiary }]}>RANKS</Text>
                <View style={[styles.card, { backgroundColor: tile }]}>
                    {RANKS.map((rank, index) => {
                        const next = RANKS[index + 1];
                        const current = rank.name === marks.rank.name;
                        const reached = marks.total >= rank.min;
                        return (
                            <View key={rank.name} style={[styles.rankRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                                <View style={[styles.rankDot, { backgroundColor: reached ? primary : 'transparent', borderColor: reached ? primary : colors.border }]} />
                                <Text style={[styles.rankName, { color: current ? colors.textPrimary : reached ? colors.textSecondary : colors.textTertiary, fontFamily: current ? FontFamily.bold : FontFamily.medium }]}>
                                    {rank.name}
                                </Text>
                                {current && marks.next ? (
                                    <Text style={[styles.rankHint, { color: foreground }]}>{marks.toNext.toLocaleString()} to go</Text>
                                ) : null}
                                <Text style={[styles.rankRange, { color: colors.textTertiary }]}>
                                    {next ? `${rank.min.toLocaleString()}–${(next.min - 1).toLocaleString()}` : `${rank.min.toLocaleString()}+`}
                                </Text>
                            </View>
                        );
                    })}
                </View>

                {marks.events.length ? (
                    <>
                        <Text style={[styles.section, { color: colors.textTertiary }]}>RECENT</Text>
                        <View style={[styles.card, { backgroundColor: tile }]}>
                            {marks.events.slice(0, 15).map((event, index) => (
                                <View key={`${event.date}-${index}`} style={[styles.eventRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                                    <View style={{ flex: 1 }}>
                                        <Text numberOfLines={1} style={[styles.eventTitle, { color: colors.textPrimary }]}>{event.title}</Text>
                                        <Text style={[styles.eventMeta, { color: colors.textTertiary }]}>{`${VERB[event.kind]} ${event.item} · ${shortDay(event.date)}`}</Text>
                                    </View>
                                    <Text style={[styles.points, { color: event.points > 0 ? colors.success : colors.error }]}>
                                        {event.points > 0 ? '+' : '−'}{Math.abs(event.points)}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </>
                ) : null}

                <Text style={[styles.section, { color: colors.textTertiary }]}>HOW MARKS ARE EARNED</Text>
                <View style={[styles.rules, { backgroundColor: tile }]}>
                    <View style={styles.ruleHead}>
                        <Text style={[styles.ruleCell, styles.ruleFirst]} />
                        {(['Habit', 'Task', 'Goal'] as const).map(label => (
                            <Text key={label} style={[styles.ruleCell, { color: colors.textTertiary, fontFamily: FontFamily.semibold }]}>{label}</Text>
                        ))}
                    </View>
                    {(['add', 'complete', 'miss'] as const).map(kind => (
                        <View key={kind} style={styles.ruleRow}>
                            <Text style={[styles.ruleCell, styles.ruleFirst, { color: colors.textSecondary }]}>{VERB[kind]}</Text>
                            {(['habit', 'task', 'goal'] as const).map(item => {
                                const points = MARKS[kind][item];
                                return (
                                    <Text key={item} style={[styles.ruleCell, { color: points > 0 ? colors.textPrimary : colors.error }]}>
                                        {points > 0 ? '+' : '−'}{Math.abs(points)}
                                    </Text>
                                );
                            })}
                        </View>
                    ))}
                    <View style={styles.note}>
                        <Ionicons name="information-circle-outline" size={14} color={colors.textTertiary} />
                        <Text style={[styles.noteText, { color: colors.textTertiary }]}>
                            A habit is missed when its day ends undone, unless you skipped it. A task is missed the day after it was due.
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </VoidModal>
    );
};

const Change: React.FC<{ value: number; label: string }> = ({ value, label }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const tone = value > 0 ? colors.success : value < 0 ? colors.error : colors.textTertiary;
    return (
        <View style={[styles.change, { backgroundColor: tone + '1F' }]}>
            <Ionicons name={value > 0 ? 'caret-up' : value < 0 ? 'caret-down' : 'remove'} size={11} color={tone} />
            <Text style={[styles.changeText, { color: tone }]}>{`${Math.abs(value).toLocaleString()} · ${label}`}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    content: { paddingHorizontal: 20, paddingBottom: 48 },
    rankLabel: { fontSize: 12, letterSpacing: 1.8, fontFamily: FontFamily.semibold, marginTop: 4 },
    balance: { fontSize: 48, fontFamily: FontFamily.bold, letterSpacing: -1.5, fontVariant: ['tabular-nums'], marginTop: 2 },
    sub: { fontSize: 13, fontFamily: FontFamily.regular },
    changeRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
    change: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
    changeText: { fontSize: 12, fontFamily: FontFamily.semibold, fontVariant: ['tabular-nums'] },
    empty: { height: 120, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    section: { fontSize: 11, letterSpacing: 1.4, fontFamily: FontFamily.semibold, marginTop: 28, marginBottom: 10 },
    card: { borderRadius: 16, paddingHorizontal: 14 },
    rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
    rankDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
    rankName: { flex: 1, fontSize: 14 },
    rankHint: { fontSize: 12, fontFamily: FontFamily.semibold },
    rankRange: { fontSize: 12, fontFamily: FontFamily.regular, fontVariant: ['tabular-nums'], minWidth: 92, textAlign: 'right' },
    eventRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    eventTitle: { fontSize: 14, fontFamily: FontFamily.medium },
    eventMeta: { fontSize: 12, fontFamily: FontFamily.regular, marginTop: 2 },
    points: { fontSize: 14, fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
    rules: { borderRadius: 16, padding: 14, gap: 8 },
    ruleHead: { flexDirection: 'row' },
    ruleRow: { flexDirection: 'row' },
    ruleCell: { flex: 1, fontSize: 13, textAlign: 'right', fontFamily: FontFamily.medium, fontVariant: ['tabular-nums'] },
    ruleFirst: { flex: 1.4, textAlign: 'left' },
    note: { flexDirection: 'row', gap: 6, marginTop: 6 },
    noteText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: FontFamily.regular },
});
