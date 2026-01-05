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
import { subscribeToHabits, getCompletions, toggleCompletion, removeHabitEverywhere, Habit as StoreHabit } from '@/lib/habits';
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

    // UI State
    const [isWizardVisible, setIsWizardVisible] = useState(false);
    const [showFilter, setShowFilter] = useState(false);
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
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
                                    <Text style={{ fontSize: 11, color: colors.textTertiary, fontFamily: 'SpaceMono-Regular', letterSpacing: 2, marginBottom: 10 }}>
                                        GOALS
                                    </Text>

                                    {goals.length > 0 ? (
                                        goals.map(goal => {
                                            const linkedHabits = habitsByGoal[goal.id] || [];
                                            const isExpanded = expandedGoals[goal.id];

                                            // Progress Calculation
                                            const linkedCount = linkedHabits.length;
                                            const completedCount = linkedHabits.filter(h => h.completed).length;
                                            const progress = linkedCount > 0 ? Math.round((completedCount / linkedCount) * 100) : 0;

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
                                                                bottom: 12,
                                                                zIndex: 10,
                                                                backgroundColor: 'rgba(0,0,0,0.3)',
                                                                padding: 6,
                                                                borderRadius: 20,
                                                                flexDirection: 'row',
                                                                alignItems: 'center',
                                                                gap: 4
                                                            }}
                                                        >
                                                            <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>{linkedHabits.length}</Text>
                                                            <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color="white" />
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
                                                                        onFocus={handleHabitPress}
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
                                            <Text style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'SpaceMono-Regular' }}>NO ACTIVE GOALS</Text>
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
                        >
                            <TouchableOpacity
                                style={{ flex: 1, justifyContent: 'flex-end' }}
                                activeOpacity={1}
                                onPress={() => setShowFilter(false)}
                            >
                                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />

                                <Animated.View
                                    entering={SlideInDown.springify().damping(15)}
                                    exiting={SlideOutDown}
                                    style={{
                                        borderTopLeftRadius: 32,
                                        borderTopRightRadius: 32,
                                        overflow: 'hidden',
                                        width: '100%',
                                        maxHeight: '45%',
                                        backgroundColor: 'transparent',
                                        paddingBottom: 40,
                                        // Removed border from here, moving to overlay view
                                    }}>

                                    {/* Glass Background */}
                                    <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill}>
                                        <LinearGradient
                                            colors={['rgba(30, 41, 59, 0.7)', 'rgba(15, 23, 42, 0.8)']}
                                            style={StyleSheet.absoluteFill}
                                        />
                                    </BlurView>

                                    {/* Border & Gloss */}
                                    <View style={[StyleSheet.absoluteFill, {
                                        borderWidth: 1,
                                        borderColor: 'rgba(255,255,255,0.1)',
                                        borderTopWidth: 1,
                                        borderTopColor: 'rgba(255,255,255,0.2)',
                                        borderRadius: 32,
                                        pointerEvents: 'none'
                                    }]} />

                                    <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
                                        <View style={{ alignItems: 'center', marginBottom: 20 }}>
                                            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                                        </View>

                                        <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.textPrimary, fontFamily: 'SpaceGrotesk-Bold', marginBottom: 24, textAlign: 'center' }}>
                                            View Options
                                        </Text>

                                        <View style={{ gap: 12, marginBottom: 32 }}>
                                            <TouchableOpacity
                                                onPress={() => { selectionFeedback(); setActiveFilter('all'); setShowFilter(false); }}
                                                style={[
                                                    styles.filterOption,
                                                    activeFilter === 'all' && { backgroundColor: colors.primary, borderColor: colors.primary }
                                                ]}
                                            >
                                                <Ionicons name="list" size={20} color={activeFilter === 'all' ? 'white' : colors.textSecondary} />
                                                <Text style={[styles.filterText, activeFilter === 'all' && { color: 'white' }]}>All Items</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                onPress={() => { selectionFeedback(); setActiveFilter('goals_only'); setShowFilter(false); }}
                                                style={[
                                                    styles.filterOption,
                                                    activeFilter === 'goals_only' && { backgroundColor: colors.primary, borderColor: colors.primary }
                                                ]}
                                            >
                                                <Ionicons name="flag" size={20} color={activeFilter === 'goals_only' ? 'white' : colors.textSecondary} />
                                                <Text style={[styles.filterText, activeFilter === 'goals_only' && { color: 'white' }]}>Goals & Linked Habits Only</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                onPress={() => { selectionFeedback(); setActiveFilter('habits_only'); setShowFilter(false); }}
                                                style={[
                                                    styles.filterOption,
                                                    activeFilter === 'habits_only' && { backgroundColor: colors.primary, borderColor: colors.primary }
                                                ]}
                                            >
                                                <Ionicons name="layers" size={20} color={activeFilter === 'habits_only' ? 'white' : colors.textSecondary} />
                                                <Text style={[styles.filterText, activeFilter === 'habits_only' && { color: 'white' }]}>Independent Habits Only</Text>
                                            </TouchableOpacity>
                                        </View>

                                        <TouchableOpacity onPress={() => setShowFilter(false)} style={{ alignItems: 'center', paddingVertical: 12 }}>
                                            <Text style={{ fontSize: 16, fontFamily: 'SpaceGrotesk-Bold', color: colors.textSecondary }}>Close</Text>
                                        </TouchableOpacity>
                                    </View>
                                </Animated.View>
                            </TouchableOpacity>
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
        fontFamily: 'SpaceMono-Regular'
    }
});

export default CalendarScreen;
