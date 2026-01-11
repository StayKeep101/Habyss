import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Habit } from '@/lib/habitsSQLite';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { VoidCard } from '@/components/Layout/VoidCard';
import { VoidModal } from '@/components/Layout/VoidModal';
import { ShareStatsModal } from '@/components/Social/ShareStatsModal';
import { useAccentGradient } from '@/constants/AccentContext';

interface StreakModalProps {
    visible: boolean;
    onClose: () => void;
    goals: Habit[];
    completedDays: Record<string, string[]>;
    streak: number;
}

const getDeadlineDateStr = (goal: Habit | undefined): string | null => {
    if (!goal?.targetDate) return null;
    return new Date(goal.targetDate).toISOString().split('T')[0];
};

export const StreakModal: React.FC<StreakModalProps> = ({ visible, onClose, goals, completedDays, streak }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary: accentColor } = useAccentGradient();
    const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
    const [filter, setFilter] = useState<'month'>('month');
    const [monthOffset, setMonthOffset] = useState(0);
    const [showShare, setShowShare] = useState(false);

    const selectedGoal = goals.find(g => g.id === selectedGoalId) || goals[0];
    const goalCompletedDays = selectedGoal ? (completedDays[selectedGoal.id] || []) : [];

    const calendarData = useMemo(() => {
        const now = new Date();
        if (filter === 'month' && monthOffset !== 0) {
            now.setMonth(now.getMonth() + monthOffset);
            now.setDate(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
        }

        let dayCount = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const days = [];
        const anchorDate = new Date(now);

        if (filter === 'month') {
            anchorDate.setDate(1);
            dayCount = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0).getDate();
            for (let i = 1; i <= dayCount; i++) {
                const d = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), i);
                days.push({
                    date: d,
                    dateStr: d.toISOString().split('T')[0],
                    completed: goalCompletedDays.includes(d.toISOString().split('T')[0]),
                    dayOfWeek: d.getDay()
                });
            }
        } else {
            for (let i = dayCount - 1; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                days.push({ date: d, dateStr: d.toISOString().split('T')[0], completed: goalCompletedDays.includes(d.toISOString().split('T')[0]), dayOfWeek: d.getDay() });
            }
        }
        return days;
    }, [selectedGoal, goalCompletedDays, filter, monthOffset]);

    const completedCount = calendarData.filter(d => d.completed).length;
    const rate = calendarData.length > 0 ? Math.round((completedCount / calendarData.length) * 100) : 0;

    const currentMonthLabel = useMemo(() => {
        const d = new Date();
        d.setMonth(d.getMonth() + monthOffset);
        return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }, [monthOffset]);

    return (
        <VoidModal visible={visible} onClose={onClose} heightPercentage={0.75}>
            <View style={{ flex: 1 }}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={onClose} style={[styles.iconButton, { backgroundColor: colors.surfaceSecondary }]}>
                        <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 16 }}>
                        <Text style={[styles.title, { color: colors.text }]}>STREAK</Text>
                        <Text style={[styles.subtitle, { color: accentColor }]}>HISTORY & METRICS</Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowShare(true)} style={[styles.iconButton, { backgroundColor: accentColor + '20' }]}>
                        <Ionicons name="share-social" size={20} color={accentColor} />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <VoidCard glass style={styles.mainCard}>
                        <View style={[styles.streakIcon, { backgroundColor: accentColor + '15' }]}>
                            <Ionicons name="flame" size={36} color={accentColor} />
                        </View>
                        <Text style={[styles.streakValue, { color: accentColor }]}>{streak}</Text>
                        <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>DAY STREAK</Text>

                        {selectedGoal?.targetDate && (
                            <View style={[styles.deadlineBadge, { backgroundColor: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' }]}>
                                <View style={[styles.deadlineIconContainer, { backgroundColor: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' }]}>
                                    <Ionicons name="flag" size={14} color={accentColor} />
                                </View>
                                <View style={styles.deadlineTextContainer}>
                                    <Text style={[styles.deadlineLabel, { color: colors.textTertiary }]}>DEADLINE</Text>
                                    <Text style={[styles.deadlineDate, { color: colors.text }]}>
                                        {new Date(selectedGoal.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </Text>
                                </View>
                                {new Date(selectedGoal.targetDate) > new Date() && (
                                    <View style={[styles.daysLeftBadge, { backgroundColor: accentColor + '20' }]}>
                                        <Text style={[styles.daysLeftText, { color: accentColor }]}>
                                            {Math.ceil((new Date(selectedGoal.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))}d
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </VoidCard>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            {goals.map(goal => (
                                <TouchableOpacity
                                    key={goal.id}
                                    onPress={() => setSelectedGoalId(goal.id)}
                                    style={[
                                        styles.goalChip,
                                        {
                                            borderColor: selectedGoal?.id === goal.id ? accentColor : colors.border,
                                            backgroundColor: selectedGoal?.id === goal.id ? accentColor + '20' : colors.surfaceSecondary
                                        }
                                    ]}
                                >
                                    <Ionicons name={(goal.icon as any) || 'flag'} size={14} color={selectedGoal?.id === goal.id ? accentColor : colors.textSecondary} />
                                    <Text style={[styles.goalChipText, { color: selectedGoal?.id === goal.id ? accentColor : colors.textSecondary }]} numberOfLines={1}>{goal.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>

                    <View style={styles.monthNavContainer}>
                        <TouchableOpacity onPress={() => setMonthOffset(monthOffset - 1)} style={[styles.monthNavBtn, { backgroundColor: colors.surfaceSecondary }]}>
                            <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
                        </TouchableOpacity>

                        <View style={styles.monthLabelContainer}>
                            <Ionicons name="calendar-outline" size={14} color={accentColor} style={{ marginRight: 8 }} />
                            <Text style={[styles.monthLabel, { color: colors.text }]}>{currentMonthLabel}</Text>
                        </View>

                        <TouchableOpacity
                            onPress={() => setMonthOffset(Math.min(0, monthOffset + 1))}
                            style={[styles.monthNavBtn, { backgroundColor: colors.surfaceSecondary, opacity: monthOffset === 0 ? 0.5 : 1 }]}
                            disabled={monthOffset === 0}
                        >
                            <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PERFORMANCE</Text>
                    <View style={styles.statsRow}>
                        <VoidCard glass style={styles.statCard}>
                            <Text style={[styles.statValue, { color: colors.text }]}>{completedCount}</Text>
                            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>COMPLETED</Text>
                        </VoidCard>
                        <VoidCard glass style={styles.statCard}>
                            <Text style={[styles.statValue, { color: '#22C55E' }]}>{rate}%</Text>
                            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>RATE</Text>
                        </VoidCard>
                        <VoidCard glass style={styles.statCard}>
                            <Text style={[styles.statValue, { color: colors.text }]}>{calendarData.length}</Text>
                            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>DAYS</Text>
                        </VoidCard>
                    </View>

                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ACTIVITY LOG</Text>
                    <VoidCard glass style={styles.heatmapCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4 }}>
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                                <Text key={i} style={{ color: colors.textTertiary, fontSize: 10, width: 28, textAlign: 'center' }}>{d}</Text>
                            ))}
                        </View>

                        <View style={styles.heatmap}>
                            {calendarData.length > 0 && Array.from({ length: calendarData[0].date.getDay() }).map((_, i) => (
                                <View key={`empty-${i}`} style={[styles.heatCell, { backgroundColor: 'transparent' }]} />
                            ))}

                            {calendarData.map((day, i) => {
                                const deadlineStr = getDeadlineDateStr(selectedGoal);
                                const isDeadline = deadlineStr === day.dateStr;
                                return (
                                    <View
                                        key={i}
                                        style={[
                                            styles.heatCell,
                                            day.completed ? { backgroundColor: accentColor } : { backgroundColor: theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' },
                                            isDeadline && styles.deadlineCell
                                        ]}
                                    >
                                        <Text style={{ fontSize: 8, color: day.completed ? '#fff' : colors.textTertiary }}>{day.date.getDate()}</Text>
                                        {isDeadline && (
                                            <View style={[styles.deadlineDot, { backgroundColor: '#EF4444' }]} />
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    </VoidCard>
                </ScrollView>
            </View>
            <ShareStatsModal
                visible={showShare}
                onClose={() => setShowShare(false)}
                stats={{
                    title: "STREAK MASTER",
                    value: `${streak} FIRE`,
                    subtitle: `Consistency Rate: ${rate}%`,
                    type: 'streak'
                }}
            />
        </VoidModal>
    );
};

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1 },
    iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 18, fontWeight: '900', letterSpacing: 1, fontFamily: 'Lexend' },
    subtitle: { fontSize: 10, fontWeight: '600', letterSpacing: 1.5, fontFamily: 'Lexend_400Regular', marginTop: 2 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
    mainCard: { alignItems: 'center', padding: 24, marginBottom: 20 },
    streakIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    streakValue: { fontSize: 40, fontWeight: '900', fontFamily: 'Lexend' },
    streakLabel: { fontSize: 11, fontFamily: 'Lexend_400Regular', letterSpacing: 1.5, marginTop: 4 },
    goalChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
    goalChipText: { fontSize: 12, maxWidth: 80 },
    sectionTitle: { fontSize: 10, fontWeight: '600', letterSpacing: 1.5, marginBottom: 12, fontFamily: 'Lexend_400Regular' },
    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    statCard: { flex: 1, alignItems: 'center', padding: 14 },
    statValue: { fontSize: 18, fontWeight: 'bold', fontFamily: 'Lexend' },
    statLabel: { fontSize: 9, marginTop: 4, fontFamily: 'Lexend_400Regular', letterSpacing: 0.5 },
    heatmapCard: { padding: 14 },
    heatmap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-start' },
    heatCell: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    deadlineCell: { borderWidth: 2, borderColor: '#EF4444' },
    deadlineDot: { position: 'absolute', bottom: 2, width: 4, height: 4, borderRadius: 2 },
    deadlineBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, gap: 12 },
    deadlineIconContainer: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    deadlineTextContainer: { flex: 1 },
    deadlineLabel: { fontSize: 9, fontWeight: '600', letterSpacing: 1, fontFamily: 'Lexend_400Regular' },
    deadlineDate: { fontSize: 14, fontWeight: '700', fontFamily: 'Lexend', marginTop: 2 },
    daysLeftBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
    daysLeftText: { fontSize: 12, fontWeight: '700', fontFamily: 'Lexend' },
    monthNavContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingHorizontal: 4 },
    monthNavBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    monthLabelContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flex: 1 },
    monthLabel: { fontSize: 15, fontWeight: '700', fontFamily: 'Lexend' },
});
