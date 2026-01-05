import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, LayoutAnimation, Platform, UIManager, InteractionManager } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useAnimatedScrollHandler,
    useSharedValue,
    SlideInDown,
    SlideOutDown,
    runOnJS
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { CalendarStrip } from '@/components/Home/CalendarStrip';
import { SwipeableHabitItem } from '@/components/Home/SwipeableHabitItem';
import { GoalCard } from '@/components/Home/GoalCard';
import { GoalCreationWizard } from '@/components/GoalCreationWizard';
import { ShareHabitModal } from '@/components/ShareHabitModal';
import { subscribeToHabits, getCompletions, toggleCompletion, removeHabitEverywhere, calculateGoalProgress, Habit as StoreHabit } from '@/lib/habits';
import { Ionicons } from '@expo/vector-icons';
import { useHaptics } from '@/hooks/useHaptics';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

interface Habit extends StoreHabit {
    streak?: number;
    completed?: boolean;
}

type FilterType = 'all' | 'goals_only' | 'habits_only';
type SortType = 'default' | 'name' | 'progress';

const CalendarScreen = () => {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const { lightFeedback, selectionFeedback } = useHaptics();

    // Data State
    const [habitsStore, setHabitsStore] = useState<StoreHabit[]>([]);
    const [habits, setHabits] = useState<Habit[]>([]);
    const [completions, setCompletions] = useState<Record<string, boolean>>({});
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [goalProgress, setGoalProgress] = useState<Record<string, number>>({});

    // UI State
    const [isWizardVisible, setIsWizardVisible] = useState(false);
    const [showFilter, setShowFilter] = useState(false);
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
    const [activeSort, setActiveSort] = useState<SortType>('default');
    const [expandedGoals, setExpandedGoals] = useState<Record<string, boolean>>({});
    const [weeklyCompletions, setWeeklyCompletions] = useState<Record<string, { completed: number; total: number }>>({});
    const [shareModalVisible, setShareModalVisible] = useState(false);
    const [habitToShare, setHabitToShare] = useState<Habit | null>(null);

    // Pull-to-Filter Logic
    const scrollY = useSharedValue(0);
    const filterTriggered = useSharedValue(false);
    const wasAtTop = useSharedValue(true); // Track if user was at top before pulling

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            const currentY = event.contentOffset.y;
            scrollY.value = currentY;

            // Track if user is at the top of the content
            if (currentY <= 0) {
                wasAtTop.value = true;
            } else if (currentY > 50) {
                // Only reset once scrolled down enough
                wasAtTop.value = false;
            }

            // Only trigger filter if: pulling down (-80), was already at top, and not already triggered
            if (currentY < -80 && wasAtTop.value && !filterTriggered.value) {
                filterTriggered.value = true;
                runOnJS(lightFeedback)();
                runOnJS(setShowFilter)(true);
            }
        },
        onEndDrag: () => {
            filterTriggered.value = false;
        }
    });

    // --- Subscriptions & Effects ---

    useEffect(() => {
        const unsubPromise = subscribeToHabits((newHabits) => {
            setHabitsStore(newHabits);
        });
        return () => { unsubPromise.then(unsub => unsub()); };
    }, []);

    useEffect(() => {
        const loadCompletions = async () => {
            // Use local date format (not UTC)
            const now = selectedDate;
            const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const c = await getCompletions(dateStr);
            setCompletions(c);
        };
        loadCompletions();
    }, [selectedDate]);

    // Map habits with completion status - OPTIMIZED separate effect
    useEffect(() => {
        const mapped: Habit[] = habitsStore.map(item => ({
            ...item,
            completed: !!completions[item.id],
            streak: 0
        }));
        setHabits(mapped);
    }, [habitsStore, completions]);

    // Load strict goal progress
    useEffect(() => {
        const loadProgress = async () => {
            const goals = habitsStore.filter(h => h.isGoal);
            const progressMap: Record<string, number> = {};

            await Promise.all(goals.map(async (g) => {
                // Async calculate strict progress
                const p = await calculateGoalProgress(g);
                progressMap[g.id] = p;
            }));

            setGoalProgress(progressMap);
        };

        if (habitsStore.length > 0) {
            InteractionManager.runAfterInteractions(() => {
                loadProgress();
            });
        }
    }, [habitsStore]);

    // Weekly Calcs - OPTIMIZED: only run on mount to prevent JS thread hammering
    useEffect(() => {
        const calcWeeklyCompletions = async () => {
            const today = new Date();
            const dates: string[] = [];

            // Generate date strings (14 days only for performance)
            for (let i = -7; i <= 7; i++) {
                const date = new Date(today);
                date.setDate(today.getDate() + i);
                const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                dates.push(dateStr);
            }

            // Load all completions in PARALLEL
            const completionsArray = await Promise.all(dates.map(d => getCompletions(d)));

            // Build result map
            const totalHabits = habitsStore.filter(h => !h.isGoal).length;
            const result: Record<string, { completed: number; total: number }> = {};
            dates.forEach((dateStr, i) => {
                const completedCount = Object.values(completionsArray[i]).filter(Boolean).length;
                result[dateStr] = { completed: completedCount, total: totalHabits };
            });

            setWeeklyCompletions(result);
        };

        if (habitsStore.length > 0) {
            // Defer heavy calculation until after navigation animation
            const task = InteractionManager.runAfterInteractions(() => {
                calcWeeklyCompletions();
            });
            return () => task.cancel();
        }
    }, [habitsStore]); // Only depend on habitsStore, not completions

    const { playComplete, playClick } = useSoundEffects();

    const handleDateSelect = (date: Date) => {
        lightFeedback();
        playClick();
        setSelectedDate(date);
    };

    // Debounce ref to prevent double-tap
    const isNavigating = useRef(false);

    const handleHabitPress = (habit: Habit) => {
        // Prevent double-tap navigation
        if (isNavigating.current) return;
        isNavigating.current = true;

        lightFeedback();
        const now = selectedDate;
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        router.push({
            pathname: '/habit-detail',
            params: {
                habitId: habit.id,
                date: dateStr,
                initialName: habit.name,
                initialCategory: habit.category,
                initialIcon: habit.icon,
                initialDuration: habit.durationMinutes ? String(habit.durationMinutes) : '',
                initialCompleted: habit.completed ? 'true' : 'false'
            }
        });

        // Reset after a short delay
        setTimeout(() => { isNavigating.current = false; }, 500);
    };

    const handleDelete = (habit: Habit) => {
        Alert.alert(
            habit.isGoal ? "Delete Goal" : "Delete Habit",
            "Are you sure? This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        await removeHabitEverywhere(habit.id);
                    }
                }
            ]
        );
    };

    const handleEdit = (habit: Habit) => {
        router.push({
            pathname: '/create',
            params: {
                id: habit.id,
                name: habit.name,
                category: habit.category,
                icon: habit.icon,
                duration: habit.durationMinutes ? String(habit.durationMinutes) : '',
                startAt: habit.startTime,
                endAt: habit.endTime,
                isGoal: habit.isGoal ? 'true' : 'false',
                targetDate: habit.targetDate
            }
        });
    };

    const toggleGoalExpansion = (goalId: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedGoals(prev => ({
            ...prev,
            [goalId]: !prev[goalId]
        }));
        selectionFeedback();
    };

    // --- Grouping Logic ---
    const goals = habits.filter(h => h.isGoal);
    const allHabits = habits.filter(h => !h.isGoal);

    // Group habits by their goalId
    const habitsByGoal: Record<string, Habit[]> = {};
    const looseHabits: Habit[] = [];

    allHabits.forEach(h => {
        if (h.goalId && goals.some(g => g.id === h.goalId)) {
            if (!habitsByGoal[h.goalId]) habitsByGoal[h.goalId] = [];
            habitsByGoal[h.goalId].push(h);
        } else {
            looseHabits.push(h);
        }
    });

    const isGoalFilter = activeFilter === 'goals_only';
    const isHabitFilter = activeFilter === 'habits_only';

    // Sorting Logic
    const sortedGoals = [...goals].sort((a, b) => {
        if (activeSort === 'name') return a.name.localeCompare(b.name);
        if (activeSort === 'progress') {
            return (goalProgress[b.id] || 0) - (goalProgress[a.id] || 0);
        }
        return 0; // Default (Creation order usually)
    });

    return (
        <VoidShell>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                <View style={{ flex: 1, position: 'relative' }}>

                    {/* Layer 1: Calendar Strip */}
                    <View style={{ zIndex: 10 }}>
                        <CalendarStrip
                            selectedDate={selectedDate}
                            onSelectDate={handleDateSelect}
                            completionData={weeklyCompletions}
                        />
                    </View>

                    <View style={{ flex: 1, backgroundColor: colors.background }}>
                        <Animated.ScrollView
                            onScroll={scrollHandler}
                            scrollEventThrottle={16}
                            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150, paddingTop: 40 }}
                            showsVerticalScrollIndicator={false}
                            bounces={true}
                            alwaysBounceVertical={true}
                            style={{ backgroundColor: colors.background }}
                        >
                            {/* Pull-to-Filter Hint */}
                            <View style={{ alignItems: 'center', marginTop: -20, marginBottom: 16 }}>
                                {/* Pull hint removed for cleaner UI */}
                            </View>

                            {/* Filter Indicator - Explicitly spaced below pull hint area */}
                            {activeFilter !== 'all' && (
                                <View style={{ alignItems: 'center', marginTop: 20, marginBottom: 10 }}>
                                    <TouchableOpacity
                                        onPress={() => {
                                            lightFeedback();
                                            setShowFilter(true);
                                        }}
                                        style={{
                                            backgroundColor: colors.primary,
                                            paddingHorizontal: 16,
                                            paddingVertical: 8,
                                            borderRadius: 20,
                                            shadowColor: colors.primary,
                                            shadowOffset: { width: 0, height: 4 },
                                            shadowOpacity: 0.3,
                                            shadowRadius: 8,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 6
                                        }}>
                                        <Ionicons name="filter" size={12} color="white" />
                                        <Text style={{ color: 'white', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>
                                            GOALS FILTER ACTIVE
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* GOALS SECTION */}
                            {!isHabitFilter && (
                                <View style={{ marginTop: 0, marginBottom: 16 }}>
                                    <Text style={{ fontSize: 11, color: colors.textTertiary, fontFamily: 'Lexend_400Regular', letterSpacing: 2, marginBottom: 10 }}>
                                        GOALS
                                    </Text>

                                    {sortedGoals.length > 0 ? (
                                        sortedGoals.map(goal => {
                                            const linkedHabits = habitsByGoal[goal.id] || [];
                                            const isExpanded = expandedGoals[goal.id];

                                            // Progress Calculation - USE STRICT PROGRESS
                                            const progress = goalProgress[goal.id] || 0;

                                            return (
                                                <View key={goal.id} style={{ marginBottom: 16 }}>
                                                    {/* Goal Header / Card */}
                                                    <View style={{ position: 'relative' }}>
                                                        <GoalCard
                                                            goal={goal}
                                                            progress={progress}
                                                            onPress={() => router.push({ pathname: '/goal-detail', params: { goalId: goal.id } })}
                                                        />
                                                        {/* Expansion Trigger */}
                                                        <TouchableOpacity
                                                            onPress={() => toggleGoalExpansion(goal.id)}
                                                            style={{
                                                                position: 'absolute',
                                                                right: 12,
                                                                top: 12, // Moved to top to avoid blocking progress
                                                                zIndex: 10,
                                                                backgroundColor: 'rgba(0,0,0,0.3)',
                                                                paddingHorizontal: 8,
                                                                paddingVertical: 4,
                                                                borderRadius: 12,
                                                                flexDirection: 'row',
                                                                alignItems: 'center',
                                                                gap: 4,
                                                                borderWidth: 1,
                                                                borderColor: 'rgba(255,255,255,0.05)'
                                                            }}
                                                        >
                                                            <Text style={{ color: 'white', fontSize: 10, fontWeight: '700', fontFamily: 'Lexend' }}>{linkedHabits.length}</Text>
                                                            <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={12} color="white" />
                                                        </TouchableOpacity>
                                                    </View>

                                                    {/* Linked Habits Accordion */}
                                                    {isExpanded && (
                                                        <View style={{
                                                            marginTop: 8,
                                                            marginLeft: 16,
                                                            paddingLeft: 16,
                                                            borderLeftWidth: 2,
                                                            borderLeftColor: 'rgba(255,255,255,0.1)'
                                                        }}>
                                                            {linkedHabits.length > 0 ? (
                                                                linkedHabits.map(habit => (
                                                                    <SwipeableHabitItem
                                                                        key={habit.id}
                                                                        habit={habit}
                                                                        onPress={() => handleHabitPress(habit)}
                                                                        onEdit={handleEdit}
                                                                        onDelete={handleDelete}
                                                                        onShare={(h) => { setHabitToShare(h); setShareModalVisible(true); }}
                                                                    />
                                                                ))
                                                            ) : (
                                                                <Text style={{ color: colors.textSecondary, fontSize: 12, fontStyle: 'italic', paddingVertical: 8 }}>
                                                                    No linked habits yet.
                                                                </Text>
                                                            )}
                                                        </View>
                                                    )}
                                                </View>
                                            );
                                        })
                                    ) : (
                                        <VoidCard style={{ alignItems: 'center', justifyContent: 'center', padding: 24, borderStyle: 'dashed' }}>
                                            <Text style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Lexend_400Regular' }}>NO ACTIVE GOALS</Text>
                                        </VoidCard>
                                    )}
                                </View>
                            )}

                            {/* Habits section removed - all habits must be linked to goals */}

                        </Animated.ScrollView>
                    </View>

                    <GoalCreationWizard
                        visible={isWizardVisible}
                        onClose={() => setIsWizardVisible(false)}
                        onSuccess={() => {/* refresh */ }}
                    />

                    {/* Filter Modal */}
                    {showFilter && (
                        <Modal
                            visible={true}
                            transparent
                            animationType="none"
                            onRequestClose={() => setShowFilter(false)}
                            statusBarTranslucent
                        >
                            <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                                <TouchableOpacity
                                    style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)' }]}
                                    activeOpacity={1}
                                    onPress={() => setShowFilter(false)}
                                />

                                <Animated.View
                                    entering={SlideInDown.springify().damping(20).stiffness(300)}
                                    exiting={SlideOutDown}
                                    style={{
                                        height: 'auto', // Use auto height
                                        minHeight: '50%',
                                        maxHeight: '80%',
                                        borderTopLeftRadius: 24,
                                        borderTopRightRadius: 24,
                                        overflow: 'hidden',
                                        paddingBottom: 40 // Add padding at bottom
                                    }}>
                                    <LinearGradient colors={['#0f1218', '#080a0e']} style={StyleSheet.absoluteFill} />
                                    <View style={[StyleSheet.absoluteFill, { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(139, 92, 246, 0.15)', pointerEvents: 'none' }]} />

                                    <View style={{ padding: 24 }}>
                                        <Text style={{ fontSize: 14, fontWeight: '900', color: '#fff', letterSpacing: 1, fontFamily: 'Lexend', textAlign: 'center', marginBottom: 4 }}>FILTER</Text>
                                        <Text style={{ fontSize: 10, color: colors.primary, letterSpacing: 1.5, fontFamily: 'Lexend_400Regular', textAlign: 'center', marginBottom: 24 }}>VIEW OPTIONS</Text>

                                        <View style={{ gap: 10 }}>
                                            <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 'bold', marginBottom: 4, marginTop: 4 }}>FILTER BY TYPE</Text>
                                            <TouchableOpacity
                                                onPress={() => { selectionFeedback(); setActiveFilter('all'); }}
                                                style={[styles.filterOption, activeFilter === 'all' && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
                                            >
                                                <Ionicons name="list" size={18} color={activeFilter === 'all' ? colors.primary : 'rgba(255,255,255,0.5)'} />
                                                <Text style={[styles.filterText, activeFilter === 'all' && { color: colors.primary }]}>All Items</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                onPress={() => { selectionFeedback(); setActiveFilter('goals_only'); }}
                                                style={[styles.filterOption, activeFilter === 'goals_only' && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
                                            >
                                                <Ionicons name="flag" size={18} color={activeFilter === 'goals_only' ? colors.primary : 'rgba(255,255,255,0.5)'} />
                                                <Text style={[styles.filterText, activeFilter === 'goals_only' && { color: colors.primary }]}>Goals & Linked Habits</Text>
                                            </TouchableOpacity>

                                            {/* Independent Habits option removed as requested */}

                                            <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 'bold', marginBottom: 4, marginTop: 16 }}>SORT BY</Text>
                                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                                                <TouchableOpacity
                                                    onPress={() => { selectionFeedback(); setActiveSort('default'); }}
                                                    style={[styles.sortChip, activeSort === 'default' && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                                                >
                                                    <Text style={[styles.sortText, activeSort === 'default' && { color: 'white' }]}>Default</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => { selectionFeedback(); setActiveSort('name'); }}
                                                    style={[styles.sortChip, activeSort === 'name' && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                                                >
                                                    <Text style={[styles.sortText, activeSort === 'name' && { color: 'white' }]}>Name</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => { selectionFeedback(); setActiveSort('progress'); }}
                                                    style={[styles.sortChip, activeSort === 'progress' && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                                                >
                                                    <Text style={[styles.sortText, activeSort === 'progress' && { color: 'white' }]}>Progress</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                </Animated.View>
                            </View>
                        </Modal>
                    )}
                </View>
            </SafeAreaView>

            {/* Share Habit Modal */}
            {habitToShare && (
                <ShareHabitModal
                    visible={shareModalVisible}
                    habitId={habitToShare.id}
                    habitName={habitToShare.name}
                    onClose={() => { setShareModalVisible(false); setHabitToShare(null); }}
                />
            )}
        </VoidShell>
    );
};

const styles = StyleSheet.create({
    filterOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255,255,255,0.05)',
        gap: 12
    },
    filterText: {
        fontSize: 16,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.7)',
        fontFamily: 'Lexend_400Regular'
    },
    sortChip: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    sortText: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.5)',
        fontFamily: 'Lexend_400Regular'
    }
});

export default CalendarScreen;
