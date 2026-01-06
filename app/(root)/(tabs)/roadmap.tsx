import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, LayoutAnimation, Platform, UIManager, InteractionManager, DeviceEventEmitter } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useAnimatedScrollHandler,
    useSharedValue,
    SlideInDown,
    SlideOutDown,
    runOnJS,
    FadeIn,
    FadeOut
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
import { useAppSettings } from '@/constants/AppSettingsContext';
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
    const { cardSize } = useAppSettings();

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

        // Listen for updates from other screens (Home, Detail)
        const sub = DeviceEventEmitter.addListener('habit_completion_updated', ({ habitId, date, completed }) => {
            const now = selectedDate;
            const currentDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            // Only update if the event matches the currently viewed date
            if (date === currentDateStr) {
                setCompletions(prev => ({
                    ...prev,
                    [habitId]: completed
                }));
            }
        });

        return () => sub.remove();
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

    const handleHabitPress = async (habit: Habit) => {
        // Prevent double-tap
        if (isNavigating.current) return;
        isNavigating.current = true;

        // TOGGLE COMPLETION LOGIC for Roadmap
        const now = selectedDate;
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        // 1. Optimistic Update
        const isCompleted = !completions[habit.id];
        setCompletions(prev => ({ ...prev, [habit.id]: isCompleted }));

        // 2. Feedback
        if (isCompleted) {
            playComplete();
            selectionFeedback(); // Stronger feedback for complete
        } else {
            lightFeedback();
        }

        // 3. Persist
        try {
            await toggleCompletion(habit.id, dateStr);
        } catch (e) {
            // Revert on error
            setCompletions(prev => ({ ...prev, [habit.id]: !isCompleted }));
            console.error(e);
        }

        setTimeout(() => { isNavigating.current = false; }, 300);
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
                                                            size={cardSize}
                                                            isExpanded={!!isExpanded}
                                                            linkedHabitsCount={linkedHabits.length}
                                                            onToggleExpand={() => toggleGoalExpansion(goal.id)}
                                                            onPress={() => router.push({ pathname: '/goal-detail', params: { goalId: goal.id } })}
                                                        />
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
                                                                        size={cardSize}
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

                            {/* HABITS ONLY SECTION */}
                            {isHabitFilter && (
                                <View style={{ marginTop: 0, marginBottom: 16 }}>
                                    <Text style={{ fontSize: 11, color: colors.textTertiary, fontFamily: 'Lexend_400Regular', letterSpacing: 2, marginBottom: 10 }}>
                                        ALL HABITS
                                    </Text>

                                    {habits.filter(h => !h.isArchived && !h.isGoal).length > 0 ? (
                                        habits.filter(h => !h.isArchived && !h.isGoal).map(habit => (
                                            <SwipeableHabitItem
                                                key={habit.id}
                                                habit={habit}
                                                onPress={(h) => {
                                                    selectionFeedback();
                                                    toggleCompletion(h.id, selectedDate.toISOString().split('T')[0]);
                                                    setCompletions(prev => ({ ...prev, [h.id]: !prev[h.id] }));
                                                }}
                                                onEdit={(h) => router.push({ pathname: '/create', params: { id: h.id } })}
                                                onDelete={(h) => { handleDelete(h); }}
                                                onShare={(h) => { setHabitToShare(h); setShareModalVisible(true); }}
                                                size={cardSize}
                                            />
                                        ))
                                    ) : (
                                        <VoidCard style={{ alignItems: 'center', justifyContent: 'center', padding: 24, borderStyle: 'dashed' }}>
                                            <Text style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Lexend_400Regular' }}>NO HABITS</Text>
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
                            animationType="fade"
                            onRequestClose={() => setShowFilter(false)}
                            statusBarTranslucent
                        >
                            <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
                                <TouchableOpacity
                                    style={StyleSheet.absoluteFill}
                                    activeOpacity={1}
                                    onPress={() => setShowFilter(false)}
                                />

                                <Animated.View
                                    entering={SlideInDown.springify().damping(18).stiffness(120)}
                                    exiting={SlideOutDown.duration(200)}
                                    style={{
                                        borderTopLeftRadius: 32,
                                        borderTopRightRadius: 32,
                                        overflow: 'hidden',
                                        backgroundColor: '#0f1218',
                                        maxHeight: '80%'
                                    }}>
                                    <View style={{ borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(139, 92, 246, 0.2)', pointerEvents: 'none', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

                                    {/* Handle Bar */}
                                    <View style={{ alignItems: 'center', paddingTop: 12 }}>
                                        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                                    </View>

                                    <View style={{ padding: 24, paddingBottom: 40 }}>
                                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.5, fontFamily: 'Lexend', textAlign: 'center', marginBottom: 24 }}>
                                            Filter & Sort
                                        </Text>

                                        <View style={{ gap: 20 }}>
                                            <View>
                                                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: 'bold', marginBottom: 12, letterSpacing: 1 }}>FILTER ORGANIZE</Text>
                                                <View style={{ gap: 8 }}>
                                                    <TouchableOpacity
                                                        onPress={() => { selectionFeedback(); setActiveFilter('all'); }}
                                                        style={[
                                                            styles.filterOption,
                                                            activeFilter === 'all' && { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: colors.primary }
                                                        ]}
                                                    >
                                                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: activeFilter === 'all' ? colors.primary : 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                                                            <Ionicons name="layers" size={16} color={activeFilter === 'all' ? '#fff' : 'rgba(255,255,255,0.5)'} />
                                                        </View>
                                                        <Text style={[styles.filterText, activeFilter === 'all' && { color: '#fff' }]}>All Items</Text>
                                                        {activeFilter === 'all' && <Ionicons name="checkmark" size={18} color={colors.primary} style={{ marginLeft: 'auto' }} />}
                                                    </TouchableOpacity>

                                                    <TouchableOpacity
                                                        onPress={() => { selectionFeedback(); setActiveFilter('goals_only'); }}
                                                        style={[
                                                            styles.filterOption,
                                                            activeFilter === 'goals_only' && { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: colors.primary }
                                                        ]}
                                                    >
                                                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: activeFilter === 'goals_only' ? colors.primary : 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                                                            <Ionicons name="flag" size={16} color={activeFilter === 'goals_only' ? '#fff' : 'rgba(255,255,255,0.5)'} />
                                                        </View>
                                                        <Text style={[styles.filterText, activeFilter === 'goals_only' && { color: '#fff' }]}>Goals & Linked Habits</Text>
                                                        {activeFilter === 'goals_only' && <Ionicons name="checkmark" size={18} color={colors.primary} style={{ marginLeft: 'auto' }} />}
                                                    </TouchableOpacity>

                                                    <TouchableOpacity
                                                        onPress={() => { selectionFeedback(); setActiveFilter('habits_only'); }}
                                                        style={[
                                                            styles.filterOption,
                                                            activeFilter === 'habits_only' && { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: colors.primary }
                                                        ]}
                                                    >
                                                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: activeFilter === 'habits_only' ? colors.primary : 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                                                            <Ionicons name="checkbox" size={16} color={activeFilter === 'habits_only' ? '#fff' : 'rgba(255,255,255,0.5)'} />
                                                        </View>
                                                        <Text style={[styles.filterText, activeFilter === 'habits_only' && { color: '#fff' }]}>Habits Only</Text>
                                                        {activeFilter === 'habits_only' && <Ionicons name="checkmark" size={18} color={colors.primary} style={{ marginLeft: 'auto' }} />}
                                                    </TouchableOpacity>
                                                </View>
                                            </View>

                                            <View>
                                                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: 'bold', marginBottom: 12, letterSpacing: 1 }}>SORT ORDER</Text>
                                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                                    {['default', 'name', 'progress'].map((sort) => (
                                                        <TouchableOpacity
                                                            key={sort}
                                                            onPress={() => { selectionFeedback(); setActiveSort(sort as any); }}
                                                            style={[
                                                                styles.sortChip,
                                                                activeSort === sort && { backgroundColor: colors.primary, borderColor: colors.primary }
                                                            ]}
                                                        >
                                                            <Text style={[styles.sortText, activeSort === sort && { color: 'white' }]}>
                                                                {sort.charAt(0).toUpperCase() + sort.slice(1)}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
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
