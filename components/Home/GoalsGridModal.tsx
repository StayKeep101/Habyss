import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { Habit } from '@/lib/habitsSQLite';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { VoidCard } from '@/components/Layout/VoidCard';
import { VoidModal } from '@/components/Layout/VoidModal';
import { ShareStatsModal } from '@/components/Social/ShareStatsModal';
import { useAccentGradient } from '@/constants/AccentContext';
import { HalfCircleProgress } from '@/components/Common/HalfCircleProgress';

const { width } = Dimensions.get('window');

interface GoalsGridModalProps {
    visible: boolean;
    onClose: () => void;
    goals: Habit[];
    goalProgress: Record<string, number>;
}

export const GoalsGridModal: React.FC<GoalsGridModalProps> = ({ visible, onClose, goals, goalProgress }) => {
    const router = useRouter();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary: accentColor } = useAccentGradient();
    const [showShare, setShowShare] = useState(false);

    const handleGoalPress = (goalId: string) => {
        onClose();
        setTimeout(() => router.push({ pathname: '/goal-detail', params: { goalId } }), 350);
    };

    const avgProgress = goals.length > 0 ? Math.round(goals.reduce((sum, g) => sum + (goalProgress[g.id] || 0), 0) / goals.length) : 0;

    return (
        <VoidModal visible={visible} onClose={onClose} heightPercentage={0.75}>
            <View style={{ flex: 1 }}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={onClose} style={[styles.iconButton, { backgroundColor: colors.surfaceSecondary }]}>
                        <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 16 }}>
                        <Text style={[styles.title, { color: colors.text }]}>GOAL PROGRESS</Text>
                        <Text style={[styles.subtitle, { color: accentColor }]}>OVERVIEW</Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowShare(true)} style={[styles.iconButton, { backgroundColor: accentColor + '20' }]}>
                        <Ionicons name="share-social" size={20} color={accentColor} />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {/* Stats Row */}
                    <View style={styles.statsRow}>
                        <VoidCard glass style={styles.statCard}>
                            <View style={[styles.statIcon, { backgroundColor: accentColor + '20' }]}>
                                <Ionicons name="planet" size={22} color={accentColor} />
                            </View>
                            <Text style={[styles.statValue, { color: colors.text }]}>{goals.length}</Text>
                            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>GOALS</Text>
                        </VoidCard>
                        <VoidCard glass style={styles.statCard}>
                            <View style={[styles.statIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                                <Ionicons name="trending-up" size={22} color="#10B981" />
                            </View>
                            <Text style={[styles.statValue, { color: colors.text }]}>{avgProgress}%</Text>
                            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>AVG PROGRESS</Text>
                        </VoidCard>
                    </View>

                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ALL GOALS</Text>
                    <View style={styles.grid}>
                        {goals.length > 0 ? goals.map(goal => {
                            const progress = goalProgress[goal.id] || 0;
                            return (
                                <TouchableOpacity key={goal.id} onPress={() => handleGoalPress(goal.id)} activeOpacity={0.7}>
                                    <VoidCard glass style={styles.goalCard}>
                                        <View style={[styles.goalIcon, { backgroundColor: accentColor + '20' }]}>
                                            <Ionicons name={(goal.icon as any) || 'flag'} size={24} color={accentColor} />
                                        </View>
                                        <Text style={[styles.goalName, { color: colors.text }]} numberOfLines={2}>{goal.name}</Text>
                                        <View style={{ marginVertical: 8 }}>
                                            <HalfCircleProgress
                                                progress={progress}
                                                size={80}
                                                strokeWidth={6}
                                                color={accentColor}
                                                backgroundColor={theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}
                                                textColor={colors.text}
                                                fontSize={14}
                                                showPercentage={true}
                                            />
                                        </View>
                                    </VoidCard>
                                </TouchableOpacity>
                            );
                        }) : (
                            <VoidCard glass style={styles.emptyCard}>
                                <Ionicons name="planet-outline" size={40} color={colors.textTertiary} />
                                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No goals yet</Text>
                            </VoidCard>
                        )}
                    </View>
                </ScrollView>
            </View>
            <ShareStatsModal
                visible={showShare}
                onClose={() => setShowShare(false)}
                stats={{
                    title: "GOAL PROGRESS",
                    value: `${avgProgress}%`,
                    subtitle: `${goals.length} Active Goals`,
                    type: 'growth'
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
    statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    statCard: { flex: 1, alignItems: 'center', padding: 16 },
    statIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    statValue: { fontSize: 24, fontWeight: 'bold', fontFamily: 'Lexend' },
    statLabel: { fontSize: 9, marginTop: 4, fontFamily: 'Lexend_400Regular', letterSpacing: 1 },
    sectionTitle: { fontSize: 10, fontWeight: '600', letterSpacing: 1.5, marginBottom: 14, fontFamily: 'Lexend_400Regular' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    goalCard: { width: (width - 50) / 2, padding: 14, alignItems: 'center' },
    goalIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    goalName: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 10, height: 34, fontFamily: 'Lexend' },
    emptyCard: { width: '100%', alignItems: 'center', padding: 40 },
    emptyText: { marginTop: 12, fontSize: 14 },
});
