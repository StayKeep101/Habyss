import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Habit } from '@/lib/habitsSQLite';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { VoidCard } from '@/components/Layout/VoidCard';
import { MiniGoalGraph } from '@/components/Home/MiniGoalGraph';
import { ShareStatsModal } from '@/components/Social/ShareStatsModal';
import { useAccentGradient } from '@/constants/AccentContext';
import { VoidModal } from '@/components/Layout/VoidModal';

interface ConsistencyModalProps {
    visible: boolean;
    onClose: () => void;
    goals: Habit[];
    habits: Habit[];
    goalConsistency: Record<string, number>;
    avgConsistency: number;
}

export const ConsistencyModal: React.FC<ConsistencyModalProps> = ({ visible, onClose, goals, habits, goalConsistency, avgConsistency }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary: accentColor } = useAccentGradient();
    const [showShare, setShowShare] = useState(false);

    const getColor = (score: number) => {
        if (score >= 80) return '#22C55E';
        if (score >= 60) return '#84CC16';
        if (score >= 40) return '#FBBF24';
        if (score >= 20) return '#F97316';
        return '#EF4444';
    };

    const avgColor = getColor(avgConsistency);
    const rating = avgConsistency >= 80 ? 'Excellent' : avgConsistency >= 60 ? 'Good' : avgConsistency >= 40 ? 'Fair' : 'Needs Work';

    return (
        <VoidModal visible={visible} onClose={onClose} heightPercentage={0.75}>
            <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
                <TouchableOpacity onPress={onClose} style={[styles.iconButton, { backgroundColor: colors.surfaceSecondary }]}>
                    <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 16 }}>
                    <Text style={[styles.title, { color: colors.text }]}>CONSISTENCY</Text>
                    <Text style={[styles.subtitle, { color: accentColor }]}>PERFORMANCE REPORT</Text>
                </View>
                <TouchableOpacity onPress={() => setShowShare(true)} style={[styles.iconButton, { backgroundColor: accentColor + '20' }]}>
                    <Ionicons name="share-social" size={20} color={accentColor} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <VoidCard glass style={styles.mainCard}>
                    <View style={[styles.scoreCircle, { borderColor: avgColor }]}>
                        <Text style={[styles.scoreValue, { color: avgColor }]}>{Math.round(avgConsistency)}%</Text>
                    </View>
                    <Text style={[styles.scoreName, { color: colors.textSecondary }]}>Overall Consistency</Text>
                    <View style={[styles.ratingBadge, { backgroundColor: avgColor + '20' }]}>
                        <Text style={[styles.ratingText, { color: avgColor }]}>{rating}</Text>
                    </View>
                </VoidCard>

                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PER GOAL ACTIVITY</Text>

                <View style={styles.gridContainer}>
                    {goals.length > 0 ? goals.map(goal => {
                        const score = goalConsistency[goal.id] || 0;
                        const color = getColor(score);
                        return (
                            <VoidCard key={goal.id} glass style={styles.gridCard}>
                                <View style={styles.cardHeader}>
                                    <View style={[styles.goalIcon, { backgroundColor: (goal.color || '#8B5CF6') + '15' }]}>
                                        <Ionicons name={(goal.icon as any) || 'flag'} size={14} color={goal.color || '#8B5CF6'} />
                                    </View>
                                    <View style={[styles.miniScoreBadge, { backgroundColor: color + '15' }]}>
                                        <Text style={[styles.miniScoreText, { color }]}>{Math.round(score)}%</Text>
                                    </View>
                                </View>

                                <Text style={[styles.gridGoalName, { color: colors.text }]} numberOfLines={1}>{goal.name}</Text>

                                <View style={{ marginTop: 12 }}>
                                    <MiniGoalGraph goal={goal} habits={habits} color={goal.color || accentColor} />
                                </View>
                            </VoidCard>
                        );
                    }) : (
                        <View style={{ width: '100%' }}>
                            <VoidCard glass style={styles.emptyCard}>
                                <Ionicons name="analytics-outline" size={36} color={colors.textTertiary} />
                                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No data</Text>
                            </VoidCard>
                        </View>
                    )}
                </View>

                <View style={[styles.infoBox, { backgroundColor: colors.surfaceSecondary }]}>
                    <Ionicons name="information-circle" size={14} color={colors.textTertiary} />
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>Score = days completed ÷ total days</Text>
                </View>
            </ScrollView>

            <ShareStatsModal
                visible={showShare}
                onClose={() => setShowShare(false)}
                stats={{
                    title: "CONSISTENCY",
                    value: `${Math.round(avgConsistency)}%`,
                    subtitle: "All Time Performance",
                    type: 'consistency'
                }}
            />
        </VoidModal>
    );
};

const styles = StyleSheet.create({
    // container: { flex: 1, justifyContent: 'flex-end' }, // Removed
    // sheet: { height: SHEET_HEIGHT, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }, // Removed (handled by VoidModal)
    // sheetBorder: ... // Removed
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: 1, fontFamily: 'Lexend' },
    subtitle: { fontSize: 10, fontWeight: '600', letterSpacing: 1.5, fontFamily: 'Lexend_400Regular', marginTop: 2 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
    mainCard: { alignItems: 'center', padding: 24, marginBottom: 24 },
    scoreCircle: { width: 100, height: 100, borderRadius: 50, borderWidth: 5, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    scoreValue: { fontSize: 26, fontWeight: 'bold', fontFamily: 'Lexend' },
    scoreName: { fontSize: 13, marginBottom: 10, color: 'rgba(255,255,255,0.6)' },
    ratingBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14 },
    ratingText: { fontSize: 12, fontWeight: '700' },
    sectionTitle: { fontSize: 10, fontWeight: '600', letterSpacing: 1.5, marginBottom: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'Lexend_400Regular' },
    gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    gridCard: { width: '48%', padding: 12, marginBottom: 8, borderRadius: 16 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    goalIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    miniScoreBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    miniScoreText: { fontSize: 10, fontWeight: '800' },
    gridGoalName: { fontSize: 12, fontWeight: '700', color: '#fff', fontFamily: 'Lexend' },
    emptyCard: { alignItems: 'center', padding: 36, width: '100%' },
    emptyText: { marginTop: 12, color: 'rgba(255,255,255,0.4)', fontSize: 14 },
    infoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)' },
    infoText: { fontSize: 11, flex: 1, color: 'rgba(255,255,255,0.5)', fontFamily: 'Lexend_400Regular' },
});
