import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Habit } from '@/lib/habitsSQLite';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { VoidCard } from '@/components/Layout/VoidCard';
import { MiniGoalGraph } from '@/components/Home/MiniGoalGraph';
import { ShareStatsModal } from '@/components/Social/ShareStatsModal';
import { useAccentGradient } from '@/constants/AccentContext';
import { VoidModal } from '@/components/Layout/VoidModal';
import { ModalHeader } from '@/components/Layout/ModalHeader';

interface ConsistencyModalProps {
    visible: boolean;
    onClose: () => void;
    goals: Habit[];
    habits: Habit[];
    goalConsistency: Record<string, number>;
    avgConsistency: number;
}

const getColor = (score: number) => {
    if (score >= 80) return '#22C55E';
    if (score >= 60) return '#84CC16';
    if (score >= 40) return '#FBBF24';
    if (score >= 20) return '#F97316';
    return '#EF4444';
};

const getRating = (score: number) => {
    if (score >= 85) return 'Locked In';
    if (score >= 70) return 'Strong';
    if (score >= 50) return 'Building';
    return 'Unstable';
};

export const ConsistencyModal: React.FC<ConsistencyModalProps> = ({
    visible,
    onClose,
    goals,
    habits,
    goalConsistency,
    avgConsistency
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { colors: accentGradient, primary: accentColor } = useAccentGradient();
    const [showShare, setShowShare] = useState(false);
    const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

    const avgColor = getColor(avgConsistency);
    const rating = getRating(avgConsistency);
    const sortedGoals = useMemo(
        () => [...goals].sort((a, b) => (goalConsistency[b.id] || 0) - (goalConsistency[a.id] || 0)),
        [goals, goalConsistency]
    );
    const selectedGoal = sortedGoals.find((goal) => goal.id === selectedGoalId) || sortedGoals[0];
    const selectedGoalIndex = selectedGoal ? sortedGoals.findIndex((goal) => goal.id === selectedGoal.id) : -1;
    const selectedScore = selectedGoal ? goalConsistency[selectedGoal.id] || 0 : avgConsistency;
    const topGoal = sortedGoals[0];
    const weakestGoal = sortedGoals[sortedGoals.length - 1];
    const onTrackGoals = sortedGoals.filter((goal) => (goalConsistency[goal.id] || 0) >= 70).length;
    const slippingGoals = sortedGoals.filter((goal) => (goalConsistency[goal.id] || 0) < 40).length;

    const insight = useMemo(() => {
        if (sortedGoals.length === 0) return 'Create a mission first and this report will turn into a live consistency readout.';
        if (avgConsistency >= 80) return 'Your system is holding. Most of your missions are repeating with very little drag.';
        if (avgConsistency >= 60) return 'You have real rhythm. Tighten the weak spots and this becomes elite.';
        if (avgConsistency >= 40) return 'Momentum exists, but it breaks too often. Simplify and repeat.';
        return 'Your habits are not sticking yet. Reduce friction and focus on fewer promises.';
    }, [sortedGoals.length, avgConsistency]);

    const selectedGoalInsight = useMemo(() => {
        if (!selectedGoal) return 'No mission selected.';
        if (selectedScore >= 80) return `${selectedGoal.name} is one of your most stable missions right now.`;
        if (selectedScore >= 60) return `${selectedGoal.name} has good rhythm, but it still has room to tighten up.`;
        if (selectedScore >= 40) return `${selectedGoal.name} is inconsistent. It needs a simpler trigger or lower friction.`;
        return `${selectedGoal.name} is slipping hard. Rebuild it around the smallest repeatable action.`;
    }, [selectedGoal, selectedScore]);

    const switchGoal = (direction: 1 | -1) => {
        if (sortedGoals.length <= 1 || selectedGoalIndex < 0) return;
        const nextIndex = selectedGoalIndex + direction;
        if (nextIndex < 0 || nextIndex >= sortedGoals.length) return;
        setSelectedGoalId(sortedGoals[nextIndex].id);
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
                <ModalHeader title="CONSISTENCY" subtitle="SYSTEM HEALTH" onBack={onClose} onAction={() => setShowShare(true)} />

                <GestureDetector gesture={goalSwipeGesture}>
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <LinearGradient
                        colors={[accentGradient[0] + '24', accentGradient[1] + '12', isLight ? 'rgba(255,255,255,0.94)' : 'rgba(12,16,24,0.94)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.heroCard, { borderColor: colors.border }]}
                    >
                        <View style={styles.heroTopRow}>
                            <View style={[styles.heroOrb, { backgroundColor: avgColor + '16', borderColor: avgColor + '40' }]}>
                                <Ionicons name="pulse" size={30} color={avgColor} />
                            </View>
                            <View style={styles.heroMetricGroup}>
                                <Text style={[styles.heroValue, { color: colors.textPrimary }]}>{Math.round(avgConsistency)}%</Text>
                                <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>overall consistency</Text>
                            </View>
                            <View style={[styles.heroBadge, { backgroundColor: avgColor + '16' }]}>
                                <Text style={[styles.heroBadgeValue, { color: avgColor }]}>{rating}</Text>
                                <Text style={[styles.heroBadgeLabel, { color: colors.textTertiary }]}>status</Text>
                            </View>
                        </View>

                        <Text style={[styles.heroHeadline, { color: colors.textPrimary }]}>Performance report</Text>
                        <Text style={[styles.heroDescription, { color: colors.textSecondary }]}>{insight}</Text>

                        <View style={styles.heroStatsRow}>
                            <View style={[styles.heroStatCard, { backgroundColor: isLight ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.04)' }]}>
                                <Text style={[styles.heroStatValue, { color: colors.textPrimary }]}>{sortedGoals.length}</Text>
                                <Text style={[styles.heroStatLabel, { color: colors.textTertiary }]}>missions</Text>
                            </View>
                            <View style={[styles.heroStatCard, { backgroundColor: isLight ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.04)' }]}>
                                <Text style={[styles.heroStatValue, { color: '#22C55E' }]}>{onTrackGoals}</Text>
                                <Text style={[styles.heroStatLabel, { color: colors.textTertiary }]}>on track</Text>
                            </View>
                            <View style={[styles.heroStatCard, { backgroundColor: isLight ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.04)' }]}>
                                <Text style={[styles.heroStatValue, { color: '#EF4444' }]}>{slippingGoals}</Text>
                                <Text style={[styles.heroStatLabel, { color: colors.textTertiary }]}>slipping</Text>
                            </View>
                        </View>

                        {sortedGoals.length > 0 ? (
                            <View style={[styles.heroStrip, { backgroundColor: isLight ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.05)' }]}>
                                <View style={styles.heroStripColumn}>
                                    <Text style={[styles.heroStripLabel, { color: colors.textTertiary }]}>top mission</Text>
                                    <Text style={[styles.heroStripValue, { color: colors.textPrimary }]} numberOfLines={1}>
                                        {topGoal?.name || 'None'}
                                    </Text>
                                </View>
                                <View style={styles.heroStripDivider} />
                                <View style={styles.heroStripColumn}>
                                    <Text style={[styles.heroStripLabel, { color: colors.textTertiary }]}>needs help</Text>
                                    <Text style={[styles.heroStripValue, { color: colors.textPrimary }]} numberOfLines={1}>
                                        {weakestGoal?.name || 'None'}
                                    </Text>
                                </View>
                            </View>
                        ) : null}
                    </LinearGradient>

                    {sortedGoals.length > 0 ? (
                        <>
                            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>MISSION BREAKDOWN</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.goalChipsRow}>
                                {sortedGoals.map((goal) => {
                                    const selected = selectedGoal?.id === goal.id;
                                    const score = goalConsistency[goal.id] || 0;
                                    const scoreColor = getColor(score);
                                    return (
                                        <TouchableOpacity
                                            key={goal.id}
                                            onPress={() => setSelectedGoalId(goal.id)}
                                            style={[
                                                styles.goalChip,
                                                {
                                                    borderColor: selected ? scoreColor : colors.border,
                                                    backgroundColor: selected ? scoreColor + '16' : colors.surfaceSecondary,
                                                }
                                            ]}
                                        >
                                            <View style={[styles.goalChipIcon, { backgroundColor: (goal.color || accentColor) + '16' }]}>
                                                <Ionicons
                                                    name={(goal.icon as keyof typeof Ionicons.glyphMap) || 'flag'}
                                                    size={14}
                                                    color={goal.color || accentColor}
                                                />
                                            </View>
                                            <View style={styles.goalChipCopy}>
                                                <Text style={[styles.goalChipTitle, { color: selected ? colors.textPrimary : colors.textSecondary }]} numberOfLines={1}>
                                                    {goal.name}
                                                </Text>
                                                <Text style={[styles.goalChipMeta, { color: scoreColor }]}>
                                                    {Math.round(score)}%
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>

                            {selectedGoal ? (
                                <VoidCard glass style={[styles.focusCard, { backgroundColor: isLight ? colors.surfaceSecondary : undefined }]}>
                                    <View style={styles.focusHeader}>
                                        <View>
                                            <Text style={[styles.focusTitle, { color: colors.textPrimary }]}>{selectedGoal.name}</Text>
                                            <Text style={[styles.focusSubtitle, { color: colors.textSecondary }]}>{selectedGoalInsight}</Text>
                                        </View>
                                        <View style={[styles.focusScoreBadge, { backgroundColor: getColor(selectedScore) + '18' }]}>
                                            <Text style={[styles.focusScoreText, { color: getColor(selectedScore) }]}>{Math.round(selectedScore)}%</Text>
                                        </View>
                                    </View>

                                    <View style={styles.focusMetaRow}>
                                        <View style={styles.focusMetaItem}>
                                            <Text style={[styles.focusMetaLabel, { color: colors.textTertiary }]}>rating</Text>
                                            <Text style={[styles.focusMetaValue, { color: colors.textPrimary }]}>{getRating(selectedScore)}</Text>
                                        </View>
                                        <View style={styles.focusMetaItem}>
                                            <Text style={[styles.focusMetaLabel, { color: colors.textTertiary }]}>linked habits</Text>
                                            <Text style={[styles.focusMetaValue, { color: colors.textPrimary }]}>
                                                {habits.filter((habit) => habit.goalId === selectedGoal.id).length}
                                            </Text>
                                        </View>
                                    </View>

                                    <Text style={[styles.swipeHint, { color: colors.textTertiary }]}>
                                        Swipe left or right to inspect the next mission.
                                    </Text>

                                    <View style={styles.graphShell}>
                                        <MiniGoalGraph goal={selectedGoal} habits={habits} color={selectedGoal.color || accentColor} />
                                    </View>
                                </VoidCard>
                            ) : null}

                            <View style={[styles.infoBox, { backgroundColor: colors.surfaceSecondary }]}>
                                <Ionicons name="information-circle" size={14} color={colors.textTertiary} />
                                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                                    Consistency reflects how often each mission gets completed across its active days.
                                </Text>
                            </View>
                        </>
                    ) : (
                        <VoidCard glass style={styles.emptyState}>
                            <Ionicons name="analytics-outline" size={34} color={colors.textTertiary} />
                            <Text style={[styles.emptyStateTitle, { color: colors.textPrimary }]}>No consistency data yet</Text>
                            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                                Start tracking a few missions and this screen will become your stability dashboard.
                            </Text>
                        </VoidCard>
                    )}
                    </ScrollView>
                </GestureDetector>

                <ShareStatsModal
                    visible={showShare}
                    onClose={() => setShowShare(false)}
                    stats={{
                        title: 'CONSISTENCY',
                        value: `${Math.round(avgConsistency)}%`,
                        subtitle: 'All Time Performance',
                        type: 'consistency'
                    }}
                />
            </View>
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
    heroOrb: {
        width: 66,
        height: 66,
        borderRadius: 33,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    heroMetricGroup: {
        flex: 1,
        marginLeft: 14,
    },
    heroValue: {
        fontSize: 40,
        lineHeight: 40,
        fontWeight: '900',
        fontFamily: 'Lexend',
    },
    heroLabel: {
        marginTop: 6,
        fontSize: 11,
        letterSpacing: 1.3,
        textTransform: 'uppercase',
        fontFamily: 'Lexend_400Regular',
    },
    heroBadge: {
        minWidth: 84,
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingVertical: 10,
        alignItems: 'center',
    },
    heroBadgeValue: {
        fontSize: 16,
        fontWeight: '800',
        fontFamily: 'Lexend',
    },
    heroBadgeLabel: {
        marginTop: 2,
        fontSize: 9,
        textTransform: 'uppercase',
        letterSpacing: 1,
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
    heroStatsRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 18,
    },
    heroStatCard: {
        flex: 1,
        borderRadius: 18,
        paddingVertical: 14,
        paddingHorizontal: 12,
    },
    heroStatValue: {
        fontSize: 20,
        lineHeight: 22,
        fontWeight: '800',
        textAlign: 'center',
        fontFamily: 'Lexend',
    },
    heroStatLabel: {
        marginTop: 6,
        fontSize: 10,
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontFamily: 'Lexend_400Regular',
    },
    heroStrip: {
        marginTop: 18,
        borderRadius: 18,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
    },
    heroStripColumn: {
        flex: 1,
    },
    heroStripDivider: {
        width: 1,
        alignSelf: 'stretch',
        backgroundColor: 'rgba(255,255,255,0.08)',
        marginHorizontal: 14,
    },
    heroStripLabel: {
        fontSize: 9,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontFamily: 'Lexend_400Regular',
    },
    heroStripValue: {
        marginTop: 4,
        fontSize: 14,
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
        gap: 10,
        paddingBottom: 2,
    },
    goalChip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
        minWidth: 150,
        maxWidth: 180,
    },
    goalChipIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    goalChipCopy: {
        flex: 1,
    },
    goalChipTitle: {
        fontSize: 12,
        fontFamily: 'Lexend_400Regular',
    },
    goalChipMeta: {
        marginTop: 2,
        fontSize: 11,
        fontWeight: '700',
        fontFamily: 'Lexend',
    },
    focusCard: {
        borderRadius: 24,
        padding: 16,
    },
    focusHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    focusTitle: {
        fontSize: 20,
        lineHeight: 22,
        fontWeight: '800',
        fontFamily: 'Lexend',
        marginRight: 12,
    },
    focusSubtitle: {
        marginTop: 6,
        fontSize: 12,
        lineHeight: 18,
        maxWidth: 230,
        fontFamily: 'Lexend_400Regular',
    },
    focusScoreBadge: {
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    focusScoreText: {
        fontSize: 15,
        fontWeight: '800',
        fontFamily: 'Lexend',
    },
    focusMetaRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    focusMetaItem: {
        flex: 1,
    },
    focusMetaLabel: {
        fontSize: 9,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontFamily: 'Lexend_400Regular',
    },
    focusMetaValue: {
        marginTop: 4,
        fontSize: 14,
        fontWeight: '700',
        fontFamily: 'Lexend',
    },
    graphShell: {
        marginTop: 4,
    },
    swipeHint: {
        marginBottom: 12,
        fontSize: 11,
        letterSpacing: 0.4,
        fontFamily: 'Lexend_400Regular',
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 14,
        borderRadius: 16,
    },
    infoText: {
        flex: 1,
        fontSize: 11,
        lineHeight: 16,
        fontFamily: 'Lexend_400Regular',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 38,
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
