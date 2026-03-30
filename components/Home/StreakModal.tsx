import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Habit } from '@/lib/habitsSQLite';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { VoidCard } from '@/components/Layout/VoidCard';
import { VoidModal } from '@/components/Layout/VoidModal';
import { ModalHeader } from '@/components/Layout/ModalHeader';
import { ShareStatsModal } from '@/components/Social/ShareStatsModal';
import { useAccentGradient } from '@/constants/AccentContext';

interface StreakModalProps {
    visible: boolean;
    onClose: () => void;
    goals: Habit[];
    completedDays: Record<string, string[]>;
    streak: number;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const getDateKey = (date: Date) => date.toISOString().split('T')[0];

const getDeadlineDateStr = (goal: Habit | undefined): string | null => {
    if (!goal?.targetDate) return null;
    return new Date(goal.targetDate).toISOString().split('T')[0];
};

const getLongestRun = (days: { completed: boolean }[]) => {
    let best = 0;
    let current = 0;

    for (const day of days) {
        if (day.completed) {
            current += 1;
            best = Math.max(best, current);
        } else {
            current = 0;
        }
    }

    return best;
};

export const StreakModal: React.FC<StreakModalProps> = ({ visible, onClose, goals, completedDays, streak }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { colors: accentGradient, primary: accentColor } = useAccentGradient();
    const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
    const [monthOffset, setMonthOffset] = useState(0);
    const [showShare, setShowShare] = useState(false);

    const selectedGoal = goals.find((goal) => goal.id === selectedGoalId) || goals[0];
    const selectedGoalIndex = selectedGoal ? goals.findIndex((goal) => goal.id === selectedGoal.id) : -1;
    const goalCompletedDays = selectedGoal ? completedDays[selectedGoal.id] || [] : [];

    const currentMonth = useMemo(() => {
        const date = new Date();
        date.setMonth(date.getMonth() + monthOffset);
        return date;
    }, [monthOffset]);

    const calendarData = useMemo(() => {
        const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const dayCount = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
        const days = [];

        for (let day = 1; day <= dayCount; day += 1) {
            const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
            const dateStr = getDateKey(date);
            days.push({
                date,
                dateStr,
                completed: goalCompletedDays.includes(dateStr),
                isToday: dateStr === getDateKey(new Date()),
                dayOfWeek: date.getDay(),
            });
        }

        return days;
    }, [currentMonth, goalCompletedDays]);

    const completedCount = calendarData.filter((day) => day.completed).length;
    const rate = calendarData.length > 0 ? Math.round((completedCount / calendarData.length) * 100) : 0;
    const longestRun = useMemo(() => getLongestRun(calendarData), [calendarData]);
    const deadlineStr = getDeadlineDateStr(selectedGoal);
    const daysLeft = selectedGoal?.targetDate
        ? Math.max(0, Math.ceil((new Date(selectedGoal.targetDate).getTime() - Date.now()) / 86400000))
        : null;

    const leadingEmptyCells = calendarData.length > 0 ? Array.from({ length: calendarData[0].dayOfWeek }, (_, index) => index) : [];
    const currentMonthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const monthInsight = useMemo(() => {
        if (!selectedGoal) return 'Pick a mission to inspect its streak rhythm.';
        if (completedCount === 0) return `No check-ins logged for ${selectedGoal.name} in ${currentMonth.toLocaleDateString('en-US', { month: 'long' })} yet.`;
        if (rate >= 80) return `You are protecting ${selectedGoal.name} with elite consistency this month.`;
        if (rate >= 50) return `${selectedGoal.name} is moving. Lock in a few more wins to build momentum.`;
        return `${selectedGoal.name} needs a tighter rhythm. Focus on the next few days.`;
    }, [selectedGoal, completedCount, rate, currentMonth]);

    const shareSubtitle = selectedGoal
        ? `${selectedGoal.name} • ${rate}% hit rate`
        : `Consistency Rate: ${rate}%`;

    const switchGoal = (direction: 1 | -1) => {
        if (goals.length <= 1 || selectedGoalIndex < 0) return;
        const nextIndex = selectedGoalIndex + direction;
        if (nextIndex < 0 || nextIndex >= goals.length) return;
        setSelectedGoalId(goals[nextIndex].id);
    };

    const goalSwipeGesture = Gesture.Pan()
        .activeOffsetX([-24, 24])
        .failOffsetY([-14, 14])
        .onEnd((event) => {
            if (event.translationX <= -56) {
                switchGoal(1);
            } else if (event.translationX >= 56) {
                switchGoal(-1);
            }
        });

    return (
        <VoidModal visible={visible} onClose={onClose} heightPercentage={0.82}>
            <View style={styles.container}>
                <ModalHeader title="STREAK" subtitle="MOMENTUM CONTROL" onBack={onClose} onAction={() => setShowShare(true)} />

                <GestureDetector gesture={goalSwipeGesture}>
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <LinearGradient
                        colors={[accentGradient[0] + '26', accentGradient[1] + '12', isLight ? 'rgba(255,255,255,0.92)' : 'rgba(12,16,24,0.92)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.heroCard, { borderColor: colors.border }]}
                    >
                        <View style={styles.heroTopRow}>
                            <View style={[styles.streakOrb, { backgroundColor: accentColor + '18', borderColor: accentColor + '40' }]}>
                                <Ionicons name="flame" size={34} color={accentColor} />
                            </View>
                            <View style={styles.heroMetricGroup}>
                                <Text style={[styles.heroValue, { color: colors.textPrimary }]}>{streak}</Text>
                                <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>current streak</Text>
                            </View>
                            <View style={[styles.heroPill, { backgroundColor: isLight ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.06)' }]}>
                                <Text style={[styles.heroPillValue, { color: accentColor }]}>{rate}%</Text>
                                <Text style={[styles.heroPillLabel, { color: colors.textTertiary }]}>this month</Text>
                            </View>
                        </View>

                        <Text style={[styles.heroHeadline, { color: colors.textPrimary }]}>
                            {selectedGoal ? selectedGoal.name : 'No goal selected'}
                        </Text>
                        <Text style={[styles.heroDescription, { color: colors.textSecondary }]}>
                            {monthInsight}
                        </Text>

                        <View style={styles.heroMetaRow}>
                            <View style={[styles.heroMetaCard, { backgroundColor: isLight ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.04)' }]}>
                                <Text style={[styles.heroMetaValue, { color: colors.textPrimary }]}>{longestRun}</Text>
                                <Text style={[styles.heroMetaLabel, { color: colors.textTertiary }]}>best run</Text>
                            </View>
                            <View style={[styles.heroMetaCard, { backgroundColor: isLight ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.04)' }]}>
                                <Text style={[styles.heroMetaValue, { color: colors.textPrimary }]}>{completedCount}</Text>
                                <Text style={[styles.heroMetaLabel, { color: colors.textTertiary }]}>active days</Text>
                            </View>
                            <View style={[styles.heroMetaCard, { backgroundColor: isLight ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.04)' }]}>
                                <Text style={[styles.heroMetaValue, { color: colors.textPrimary }]}>{calendarData.length - completedCount}</Text>
                                <Text style={[styles.heroMetaLabel, { color: colors.textTertiary }]}>missed days</Text>
                            </View>
                        </View>

                        {selectedGoal?.targetDate ? (
                            <View style={[styles.deadlineStrip, { backgroundColor: isLight ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.05)' }]}>
                                <View style={[styles.deadlineIcon, { backgroundColor: accentColor + '16' }]}>
                                    <Ionicons name="flag" size={14} color={accentColor} />
                                </View>
                                <View style={styles.deadlineContent}>
                                    <Text style={[styles.deadlineTitle, { color: colors.textTertiary }]}>deadline</Text>
                                    <Text style={[styles.deadlineDate, { color: colors.textPrimary }]}>
                                        {new Date(selectedGoal.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </Text>
                                </View>
                                {daysLeft !== null ? (
                                    <View style={[styles.deadlineCountdown, { backgroundColor: accentColor + '16' }]}>
                                        <Text style={[styles.deadlineCountdownText, { color: accentColor }]}>
                                            {daysLeft}d left
                                        </Text>
                                    </View>
                                ) : null}
                            </View>
                        ) : null}
                    </LinearGradient>

                    {goals.length > 0 ? (
                        <>
                            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>TRACKED MISSIONS</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.goalChipsRow}>
                                {goals.map((goal) => {
                                    const selected = selectedGoal?.id === goal.id;
                                    return (
                                        <TouchableOpacity
                                            key={goal.id}
                                            onPress={() => setSelectedGoalId(goal.id)}
                                            style={[
                                                styles.goalChip,
                                                {
                                                    borderColor: selected ? accentColor : colors.border,
                                                    backgroundColor: selected ? accentColor + '18' : colors.surfaceSecondary,
                                                },
                                            ]}
                                        >
                                            <View style={[styles.goalChipIcon, { backgroundColor: selected ? accentColor + '18' : colors.surface }]}>
                                                <Ionicons
                                                    name={(goal.icon as keyof typeof Ionicons.glyphMap) || 'flag'}
                                                    size={14}
                                                    color={selected ? accentColor : colors.textSecondary}
                                                />
                                            </View>
                                            <Text
                                                style={[styles.goalChipText, { color: selected ? colors.textPrimary : colors.textSecondary }]}
                                                numberOfLines={1}
                                            >
                                                {goal.name}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>

                            <VoidCard glass style={[styles.monthCard, { backgroundColor: isLight ? colors.surfaceSecondary : undefined }]}>
                                <TouchableOpacity onPress={() => setMonthOffset(monthOffset - 1)} style={[styles.monthNavBtn, { backgroundColor: colors.surface }]}>
                                    <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
                                </TouchableOpacity>

                                <View style={styles.monthCenter}>
                                    <Text style={[styles.monthLabel, { color: colors.textPrimary }]}>{currentMonthLabel}</Text>
                                    <Text style={[styles.monthSubLabel, { color: colors.textTertiary }]}>swipe left or right to switch mission</Text>
                                </View>

                                <TouchableOpacity
                                    onPress={() => setMonthOffset(Math.min(0, monthOffset + 1))}
                                    style={[styles.monthNavBtn, { backgroundColor: colors.surface, opacity: monthOffset === 0 ? 0.45 : 1 }]}
                                    disabled={monthOffset === 0}
                                >
                                    <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
                                </TouchableOpacity>
                            </VoidCard>

                            <View style={styles.statsGrid}>
                                <VoidCard glass style={styles.statCard}>
                                    <Text style={[styles.statValue, { color: colors.textPrimary }]}>{completedCount}</Text>
                                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>check-ins</Text>
                                </VoidCard>
                                <VoidCard glass style={styles.statCard}>
                                    <Text style={[styles.statValue, { color: accentColor }]}>{rate}%</Text>
                                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>hit rate</Text>
                                </VoidCard>
                                <VoidCard glass style={styles.statCard}>
                                    <Text style={[styles.statValue, { color: colors.textPrimary }]}>{longestRun}</Text>
                                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>best run</Text>
                                </VoidCard>
                            </View>

                            <VoidCard glass style={[styles.calendarCard, { backgroundColor: isLight ? colors.surfaceSecondary : undefined }]}>
                                <View style={styles.calendarHeader}>
                                    <View>
                                        <Text style={[styles.calendarTitle, { color: colors.textPrimary }]}>activity map</Text>
                                        <Text style={[styles.calendarCaption, { color: colors.textTertiary }]}>
                                            Filled cells are completed days for this mission.
                                        </Text>
                                    </View>
                                    <View style={styles.legendRow}>
                                        <View style={styles.legendItem}>
                                            <View style={[styles.legendSwatch, { backgroundColor: accentColor }]} />
                                            <Text style={[styles.legendText, { color: colors.textTertiary }]}>done</Text>
                                        </View>
                                        <View style={styles.legendItem}>
                                            <View style={[styles.legendSwatch, { backgroundColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }]} />
                                            <Text style={[styles.legendText, { color: colors.textTertiary }]}>idle</Text>
                                        </View>
                                        {deadlineStr ? (
                                            <View style={styles.legendItem}>
                                                <View style={[styles.legendSwatch, { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#EF4444' }]} />
                                                <Text style={[styles.legendText, { color: colors.textTertiary }]}>deadline</Text>
                                            </View>
                                        ) : null}
                                    </View>
                                </View>

                                <View style={styles.weekdayRow}>
                                    {WEEKDAY_LABELS.map((label) => (
                                        <Text key={label} style={[styles.weekdayLabel, { color: colors.textTertiary }]}>
                                            {label}
                                        </Text>
                                    ))}
                                </View>

                                <View style={styles.calendarGrid}>
                                    {leadingEmptyCells.map((empty) => (
                                        <View key={`empty-${empty}`} style={styles.emptyHeatCell} />
                                    ))}

                                    {calendarData.map((day) => {
                                        const isDeadline = deadlineStr === day.dateStr;
                                        return (
                                            <View
                                                key={day.dateStr}
                                                style={[
                                                    styles.heatCell,
                                                    {
                                                        backgroundColor: day.completed
                                                            ? accentColor
                                                            : isLight
                                                                ? 'rgba(0,0,0,0.07)'
                                                                : 'rgba(255,255,255,0.07)',
                                                        borderColor: day.isToday ? accentColor + '55' : 'transparent',
                                                    },
                                                    isDeadline && styles.deadlineCell,
                                                ]}
                                            >
                                                <Text style={[styles.heatCellText, { color: day.completed ? '#fff' : colors.textTertiary }]}>
                                                    {day.date.getDate()}
                                                </Text>
                                                {day.isToday ? <View style={[styles.todayDot, { backgroundColor: day.completed ? '#fff' : accentColor }]} /> : null}
                                            </View>
                                        );
                                    })}
                                </View>
                            </VoidCard>
                        </>
                    ) : (
                        <VoidCard glass style={styles.emptyState}>
                            <Ionicons name="flame-outline" size={32} color={colors.textTertiary} />
                            <Text style={[styles.emptyStateTitle, { color: colors.textPrimary }]}>No streak data yet</Text>
                            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                                Start building a mission on the roadmap and this screen will turn into your momentum dashboard.
                            </Text>
                        </VoidCard>
                    )}
                    </ScrollView>
                </GestureDetector>
            </View>

            <ShareStatsModal
                visible={showShare}
                onClose={() => setShowShare(false)}
                stats={{
                    title: 'STREAK MASTER',
                    value: `${streak} FIRE`,
                    subtitle: shareSubtitle,
                    type: 'streak',
                }}
            />
        </VoidModal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 48,
        gap: 18,
    },
    heroCard: {
        borderRadius: 28,
        borderWidth: 1,
        padding: 22,
        overflow: 'hidden',
    },
    heroTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 18,
    },
    streakOrb: {
        width: 68,
        height: 68,
        borderRadius: 34,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    heroMetricGroup: {
        flex: 1,
        marginLeft: 14,
    },
    heroValue: {
        fontSize: 42,
        lineHeight: 42,
        fontWeight: '900',
        fontFamily: 'Lexend',
    },
    heroLabel: {
        marginTop: 6,
        fontSize: 11,
        letterSpacing: 1.4,
        textTransform: 'uppercase',
        fontFamily: 'Lexend_400Regular',
    },
    heroPill: {
        minWidth: 82,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 18,
        alignItems: 'center',
    },
    heroPillValue: {
        fontSize: 18,
        fontWeight: '800',
        fontFamily: 'Lexend',
    },
    heroPillLabel: {
        marginTop: 2,
        fontSize: 9,
        letterSpacing: 1,
        textTransform: 'uppercase',
        fontFamily: 'Lexend_400Regular',
    },
    heroHeadline: {
        fontSize: 24,
        lineHeight: 28,
        fontWeight: '800',
        fontFamily: 'Lexend',
    },
    heroDescription: {
        marginTop: 10,
        fontSize: 14,
        lineHeight: 20,
        fontFamily: 'Lexend_400Regular',
    },
    heroMetaRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 18,
    },
    heroMetaCard: {
        flex: 1,
        borderRadius: 18,
        paddingVertical: 14,
        paddingHorizontal: 12,
    },
    heroMetaValue: {
        fontSize: 20,
        lineHeight: 22,
        fontWeight: '800',
        textAlign: 'center',
        fontFamily: 'Lexend',
    },
    heroMetaLabel: {
        marginTop: 6,
        fontSize: 10,
        letterSpacing: 1.1,
        textAlign: 'center',
        textTransform: 'uppercase',
        fontFamily: 'Lexend_400Regular',
    },
    deadlineStrip: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 18,
        borderRadius: 18,
        padding: 12,
    },
    deadlineIcon: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    deadlineContent: {
        flex: 1,
    },
    deadlineTitle: {
        fontSize: 9,
        letterSpacing: 1.1,
        textTransform: 'uppercase',
        fontFamily: 'Lexend_400Regular',
    },
    deadlineDate: {
        marginTop: 3,
        fontSize: 14,
        fontWeight: '700',
        fontFamily: 'Lexend',
    },
    deadlineCountdown: {
        borderRadius: 14,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    deadlineCountdownText: {
        fontSize: 12,
        fontWeight: '700',
        fontFamily: 'Lexend',
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1.5,
        fontFamily: 'Lexend_400Regular',
    },
    goalChipsRow: {
        paddingBottom: 2,
        gap: 10,
    },
    goalChip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        borderWidth: 1,
        paddingVertical: 10,
        paddingHorizontal: 12,
        maxWidth: 170,
    },
    goalChipIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    goalChipText: {
        flexShrink: 1,
        fontSize: 12,
        fontFamily: 'Lexend_400Regular',
    },
    monthCard: {
        borderRadius: 22,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: -4,
    },
    monthNavBtn: {
        width: 42,
        height: 42,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    monthCenter: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    monthLabel: {
        fontSize: 16,
        fontWeight: '700',
        fontFamily: 'Lexend',
    },
    monthSubLabel: {
        marginTop: 3,
        fontSize: 10,
        fontFamily: 'Lexend_400Regular',
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 10,
    },
    statCard: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 10,
        borderRadius: 20,
    },
    statValue: {
        fontSize: 22,
        lineHeight: 24,
        fontWeight: '800',
        fontFamily: 'Lexend',
    },
    statLabel: {
        marginTop: 6,
        fontSize: 10,
        letterSpacing: 1,
        textTransform: 'uppercase',
        fontFamily: 'Lexend_400Regular',
    },
    calendarCard: {
        borderRadius: 24,
        padding: 16,
    },
    calendarHeader: {
        marginBottom: 14,
    },
    calendarTitle: {
        fontSize: 16,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontFamily: 'Lexend',
    },
    calendarCaption: {
        marginTop: 4,
        fontSize: 12,
        lineHeight: 18,
        fontFamily: 'Lexend_400Regular',
    },
    legendRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 12,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    legendSwatch: {
        width: 12,
        height: 12,
        borderRadius: 4,
        marginRight: 6,
    },
    legendText: {
        fontSize: 11,
        fontFamily: 'Lexend_400Regular',
    },
    weekdayRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    weekdayLabel: {
        width: 40,
        textAlign: 'center',
        fontSize: 10,
        letterSpacing: 1,
        fontFamily: 'Lexend_400Regular',
    },
    calendarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    emptyHeatCell: {
        width: 40,
        height: 40,
    },
    heatCell: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    heatCellText: {
        fontSize: 11,
        fontWeight: '700',
        fontFamily: 'Lexend_400Regular',
    },
    deadlineCell: {
        borderWidth: 1.5,
        borderColor: '#EF4444',
    },
    todayDot: {
        position: 'absolute',
        bottom: 5,
        width: 4,
        height: 4,
        borderRadius: 2,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 36,
        paddingHorizontal: 24,
        borderRadius: 24,
    },
    emptyStateTitle: {
        marginTop: 12,
        fontSize: 18,
        fontWeight: '700',
        fontFamily: 'Lexend',
    },
    emptyStateText: {
        marginTop: 8,
        textAlign: 'center',
        fontSize: 13,
        lineHeight: 20,
        fontFamily: 'Lexend_400Regular',
    },
});
