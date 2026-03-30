import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { subscribeToHabits, Habit, getCompletions, getLastNDaysCompletions, isHabitScheduledForDate } from '@/lib/habitsSQLite';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import { ShareStatsModal } from '@/components/Social/ShareStatsModal';
import { useAccentGradient } from '@/constants/AccentContext';
import { HalfCircleProgress } from '@/components/Common/HalfCircleProgress';
import { GoalProgressGraph } from '@/components/Goal/GoalProgressGraph';
import { GoalStats } from '@/components/Goal/GoalStats';

const { width } = Dimensions.get('window');

const GoalsOverview = () => {
    const router = useRouter();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary: accentColor } = useAccentGradient();
    const [showShare, setShowShare] = useState(false);
    const [allHabits, setAllHabits] = useState<Habit[]>([]);
    const [completions, setCompletions] = useState<Record<string, boolean>>({});
    const [historyData, setHistoryData] = useState<{ date: string; completedIds: string[] }[]>([]);
    const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

    // Subscribe to habits
    useEffect(() => {
        const unsubPromise = subscribeToHabits(setAllHabits);
        return () => { unsubPromise.then(unsub => unsub()); };
    }, []);

    // Load completions & history
    useEffect(() => {
        const load = async () => {
            const now = new Date();
            const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const [c, h] = await Promise.all([
                getCompletions(today),
                getLastNDaysCompletions(90),
            ]);
            setCompletions(c);
            setHistoryData(h);
        };
        load();
    }, []);

    const goals = useMemo(() => allHabits.filter(h => h.isGoal), [allHabits]);
    const habits = useMemo(() => allHabits.filter(h => !h.isGoal), [allHabits]);
    const selectedGoal = useMemo(
        () => goals.find((goal) => goal.id === selectedGoalId) || goals[0] || null,
        [goals, selectedGoalId]
    );
    const selectedGoalHabits = useMemo(
        () => habits.filter((habit) => habit.goalId === selectedGoal?.id),
        [habits, selectedGoal?.id]
    );

    useEffect(() => {
        if (!goals.length) {
            setSelectedGoalId(null);
            return;
        }

        if (!selectedGoalId || !goals.some((goal) => goal.id === selectedGoalId)) {
            setSelectedGoalId(goals[0].id);
        }
    }, [goals, selectedGoalId]);

    // Calculate goal progress (same logic as home.tsx)
    const goalProgress = useMemo(() => {
        const map: Record<string, number> = {};
        const todayStr = new Date().toISOString().split('T')[0];

        goals.forEach(goal => {
            const linked = habits.filter(h => h.goalId === goal.id && !h.isArchived);
            if (linked.length === 0) { map[goal.id] = 0; return; }

            const startDate = new Date(goal.startDate || goal.createdAt);
            const targetDate = goal.targetDate ? new Date(goal.targetDate) : new Date();
            if (startDate > targetDate) { map[goal.id] = 0; return; }

            let totalExpected = 0;
            let totalCompleted = 0;
            const current = new Date(startDate);

            while (current <= targetDate) {
                const dateStr = current.toISOString().split('T')[0];
                const dayName = current.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();

                linked.forEach(habit => {
                    const createdStr = new Date(habit.createdAt).toISOString().split('T')[0];
                    if (dateStr >= createdStr && habit.taskDays?.includes(dayName)) {
                        totalExpected++;
                        if (dateStr === todayStr) {
                            if (completions[habit.id]) totalCompleted++;
                        } else {
                            const historyDay = historyData.find(d => d.date === dateStr);
                            if (historyDay?.completedIds?.includes(habit.id)) totalCompleted++;
                        }
                    }
                });
                current.setDate(current.getDate() + 1);
            }

            map[goal.id] = totalExpected === 0 ? 0 : Math.round((totalCompleted / totalExpected) * 100);
        });

        return map;
    }, [goals, habits, historyData, completions]);

    const avgProgress = goals.length > 0 ? Math.round(goals.reduce((sum, g) => sum + (goalProgress[g.id] || 0), 0) / goals.length) : 0;

    const handleGoalPress = (goalId: string) => {
        router.push({ pathname: '/goal-detail', params: { goalId } });
    };

    return (
        <VoidShell>
            <StatusBar barStyle={theme === 'light' ? 'dark-content' : 'light-content'} />
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={() => router.back()} style={[styles.iconButton, { backgroundColor: colors.surfaceSecondary }]}>
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
                    <Animated.View entering={FadeInDown.duration(400)} style={styles.statsRow}>
                        <VoidCard glass style={styles.statCard}>
                            <View style={[styles.statIcon, { backgroundColor: accentColor + '20' }]}>
                                <Ionicons name="planet" size={22} color={accentColor} />
                            </View>
                            <Text style={[styles.statValue, { color: colors.text }]}>{goals.length}</Text>
                            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>GOALS</Text>
                        </VoidCard>
                        <VoidCard glass style={[styles.statCard, { padding: 0, overflow: 'hidden' }]}>
                            {/* Background Graph */}
                            <View style={StyleSheet.absoluteFill}>
                                <GoalProgressGraph
                                    height={100}
                                    width={(width - 50) / 2}
                                    color="#10B981"
                                />
                            </View>

                            {/* Overlay Content */}
                            <View style={{ padding: 16, alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                                <Text style={[styles.statValue, { color: colors.text, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 }]}>{avgProgress}%</Text>
                                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>AVG PROGRESS</Text>
                            </View>
                        </VoidCard>
                    </Animated.View>

                    {selectedGoal && (
                        <>
                            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>MISSION CONTROL</Text>
                            <VoidCard glass style={[styles.featuredGoalCard, { backgroundColor: theme === 'light' ? colors.surfaceSecondary : undefined }]}>
                                <View style={styles.featuredGoalHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.featuredGoalEyebrow, { color: colors.textTertiary }]}>ACTIVE GOAL</Text>
                                        <Text style={[styles.featuredGoalTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                                            {selectedGoal.name}
                                        </Text>
                                        <Text style={[styles.featuredGoalMeta, { color: colors.textSecondary }]}>
                                            {selectedGoalHabits.length} linked habits
                                            {selectedGoal.targetDate ? ` • due ${new Date(selectedGoal.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => handleGoalPress(selectedGoal.id)}
                                        style={[styles.openButton, { backgroundColor: accentColor + '18' }]}
                                    >
                                        <Ionicons name="open-outline" size={18} color={accentColor} />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.goalChipRow}
                                >
                                    {goals.map((goal) => {
                                        const isActive = goal.id === selectedGoal.id;
                                        return (
                                            <TouchableOpacity
                                                key={goal.id}
                                                onPress={() => setSelectedGoalId(goal.id)}
                                                style={[
                                                    styles.goalChip,
                                                    {
                                                        backgroundColor: isActive ? accentColor + '18' : (theme === 'light' ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.04)'),
                                                        borderColor: isActive ? accentColor + '55' : colors.border,
                                                    }
                                                ]}
                                            >
                                                <Ionicons
                                                    name={(goal.icon as any) || 'flag'}
                                                    size={13}
                                                    color={isActive ? accentColor : colors.textTertiary}
                                                />
                                                <Text
                                                    style={[
                                                        styles.goalChipText,
                                                        { color: isActive ? accentColor : colors.textSecondary }
                                                    ]}
                                                    numberOfLines={1}
                                                >
                                                    {goal.name}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>

                                <GoalStats goal={selectedGoal} habits={selectedGoalHabits} />
                            </VoidCard>
                        </>
                    )}

                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ALL GOALS</Text>
                    <View style={styles.grid}>
                        {goals.length > 0 ? goals.map((goal, index) => {
                            const progress = goalProgress[goal.id] || 0;
                            return (
                                <Animated.View key={goal.id} entering={FadeInDown.delay(100 + index * 60).duration(400)}>
                                    <TouchableOpacity onPress={() => handleGoalPress(goal.id)} activeOpacity={0.7}>
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
                                </Animated.View>
                            );
                        }) : (
                            <VoidCard glass style={styles.emptyCard}>
                                <Ionicons name="planet-outline" size={40} color={colors.textTertiary} />
                                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No goals yet</Text>
                            </VoidCard>
                        )}
                    </View>
                </ScrollView>
            </SafeAreaView>
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
        </VoidShell>
    );
};

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
    iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 18, fontWeight: '900', letterSpacing: 1, fontFamily: 'Lexend' },
    subtitle: { fontSize: 10, fontWeight: '600', letterSpacing: 1.5, fontFamily: 'Lexend_400Regular', marginTop: 2 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 },
    statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    statCard: { flex: 1, alignItems: 'center', padding: 16 },
    statIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    statValue: { fontSize: 24, fontWeight: 'bold', fontFamily: 'Lexend' },
    statLabel: { fontSize: 9, marginTop: 4, fontFamily: 'Lexend_400Regular', letterSpacing: 1 },
    sectionTitle: { fontSize: 10, fontWeight: '600', letterSpacing: 1.5, marginBottom: 14, fontFamily: 'Lexend_400Regular' },
    featuredGoalCard: {
        padding: 18,
        marginBottom: 24,
    },
    featuredGoalHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 14,
    },
    featuredGoalEyebrow: {
        fontSize: 10,
        letterSpacing: 1.4,
        fontFamily: 'Lexend_500Medium',
    },
    featuredGoalTitle: {
        marginTop: 6,
        fontSize: 24,
        lineHeight: 28,
        fontFamily: 'Lexend_700Bold',
    },
    featuredGoalMeta: {
        marginTop: 8,
        fontSize: 13,
        fontFamily: 'Lexend_400Regular',
    },
    openButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
    },
    goalChipRow: {
        gap: 10,
        paddingBottom: 14,
    },
    goalChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1,
        maxWidth: 180,
    },
    goalChipText: {
        fontSize: 12,
        fontFamily: 'Lexend_500Medium',
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    goalCard: { width: (width - 50) / 2, padding: 14, alignItems: 'center' },
    goalIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    goalName: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 10, height: 34, fontFamily: 'Lexend' },
    emptyCard: { width: '100%', alignItems: 'center', padding: 40 },
    emptyText: { marginTop: 12, fontSize: 14 },
});

export default GoalsOverview;
