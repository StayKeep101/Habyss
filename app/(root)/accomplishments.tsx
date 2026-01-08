
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity, ImageBackground } from 'react-native';
import { useTheme } from '@/constants/themeContext';
import { Colors } from '@/constants/Colors';
import { Habit, calculateGoalProgress, getHabits } from '@/lib/habitsSQLite';
import { VoidShell } from '@/components/Layout/VoidShell';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { GoalCard } from '@/components/Home/GoalCard'; // Reuse GoalCard
import { VoidCard } from '@/components/Layout/VoidCard';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const AccomplishmentsScreen = () => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const router = useRouter();

    const [completedGoals, setCompletedGoals] = useState<{ goal: Habit, progress: number }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadAccomplishments = async () => {
            const allHabits = await getHabits();
            const goals = allHabits.filter(h => h.isGoal && !h.isArchived); // Should we include archived? "Accomplishments" usually persist.
            // If we really want "Accomplishments", maybe we should fetch archived ones too? user said "succeeded goals".
            // Let's assume archived goals are also candidates if they were completed.
            // But getHabits() might filter archived by default? In lib/habits, getHabits usually fetches all.
            // Actually `useHabits` filters. `getHabits` is raw supabase?
            // Checking lib/habits.ts: getHabits() does `select *`. It doesn't filter archived unless specified.
            // Let's filter manually: h.isGoal.

            const candidates = allHabits.filter(h => h.isGoal);

            const results = await Promise.all(candidates.map(async (g) => {
                const p = await calculateGoalProgress(g);
                return { goal: g, progress: p };
            }));

            // Filter those with 100% progress
            const succeeded = results.filter(r => r.progress >= 100);
            succeeded.sort((a, b) => new Date(b.goal.targetDate || b.goal.createdAt).getTime() - new Date(a.goal.targetDate || a.goal.createdAt).getTime());

            setCompletedGoals(succeeded);
            setLoading(false);
        };
        loadAccomplishments();
    }, []);

    return (
        <VoidShell>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>HALL OF FAME</Text>
                <View style={{ width: 40 }} />
            </View>

            <FlatList
                data={completedGoals}
                keyExtractor={(item) => item.goal.id}
                contentContainerStyle={{ padding: 20, paddingTop: 10 }}
                ListHeaderComponent={
                    <View style={{ marginBottom: 24, alignItems: 'center' }}>
                        <View style={styles.trophyContainer}>
                            <LinearGradient colors={['#F59E0B', '#B45309']} style={StyleSheet.absoluteFill} />
                            <Ionicons name="trophy" size={32} color="white" />
                        </View>
                        <Text style={styles.subtitle}>{completedGoals.length} MISSIONS ACCOMPLISHED</Text>
                    </View>
                }
                renderItem={({ item, index }) => (
                    <Animated.View entering={FadeInUp.delay(index * 100).springify()}>
                        <TouchableOpacity
                            onPress={() => router.push({ pathname: '/goal-detail', params: { goalId: item.goal.id } })}
                            style={styles.cardContainer}
                        >
                            <VoidCard glass style={styles.card}>
                                <View style={styles.cardContent}>
                                    <View style={[styles.iconBox, { backgroundColor: (item.goal.color || '#F59E0B') + '20' }]}>
                                        <Ionicons name={(item.goal.icon as any) || 'trophy'} size={24} color={item.goal.color || '#F59E0B'} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.goalName}>{item.goal.name}</Text>
                                        <Text style={styles.dateText}>
                                            Completed {item.goal.targetDate ? new Date(item.goal.targetDate).toLocaleDateString() : 'Success'}
                                        </Text>
                                    </View>
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>100%</Text>
                                    </View>
                                </View>
                            </VoidCard>
                        </TouchableOpacity>
                    </Animated.View>
                )}
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="ribbon-outline" size={48} color="rgba(255,255,255,0.2)" />
                            <Text style={styles.emptyText}>No victories yet.</Text>
                            <Text style={styles.emptySub}>Complete all habits in a goal to earn your place here.</Text>
                        </View>
                    ) : null
                }
            />
        </VoidShell>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
    },
    backButton: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center', justifyContent: 'center'
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: 'white',
        letterSpacing: 2,
        fontFamily: 'Lexend',
    },
    trophyContainer: {
        width: 64, height: 64, borderRadius: 32,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#FCD34D'
    },
    subtitle: {
        color: '#FCD34D',
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 1,
        fontFamily: 'Lexend_400Regular'
    },
    cardContainer: {
        marginBottom: 12
    },
    card: {
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.3)' // Gold tint
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16
    },
    iconBox: {
        width: 48, height: 48, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center'
    },
    goalName: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
        fontFamily: 'Lexend',
        marginBottom: 4
    },
    dateText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        fontFamily: 'Lexend_400Regular'
    },
    badge: {
        backgroundColor: '#F59E0B',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8
    },
    badgeText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 12
    },
    emptyState: {
        alignItems: 'center',
        paddingTop: 60,
        opacity: 0.7
    },
    emptyText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 16,
        fontFamily: 'Lexend'
    },
    emptySub: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        marginTop: 8,
        textAlign: 'center',
        maxWidth: 200,
        fontFamily: 'Lexend_400Regular'
    }
});

export default AccomplishmentsScreen;
