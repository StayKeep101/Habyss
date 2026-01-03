import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import Animated, {
    useAnimatedScrollHandler,
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    runOnJS,
    SlideInDown,
    SlideOutDown,
    FadeIn,
    withTiming
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { CalendarStrip } from '@/components/Home/CalendarStrip';
import { SwipeableHabitItem } from '@/components/Home/SwipeableHabitItem';
import { GoalCard } from '@/components/Home/GoalCard';
import { GoalCreationWizard } from '@/components/GoalCreationWizard';
import { subscribeToHabits, getCompletions, toggleCompletion, removeHabitEverywhere, Habit as StoreHabit } from '@/lib/habits';
import { Ionicons } from '@expo/vector-icons';
import { useHaptics } from '@/hooks/useHaptics';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { VoidShell } from '@/components/Layout/VoidShell';

import { VoidCard } from '@/components/Layout/VoidCard';

interface Habit extends StoreHabit {
    streak?: number;
    completed?: boolean;
}

const CalendarScreen = () => {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const { lightFeedback } = useHaptics();

    const [habitsStore, setHabitsStore] = useState<StoreHabit[]>([]);
    const [habits, setHabits] = useState<Habit[]>([]);
    const [completions, setCompletions] = useState<Record<string, boolean>>({});
    const [selectedDate, setSelectedDate] = useState(new Date());

    const [isWizardVisible, setIsWizardVisible] = useState(false);
    const [showFilter, setShowFilter] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [weeklyCompletions, setWeeklyCompletions] = useState<Record<string, { completed: number; total: number }>>({});

    // Subscribe to habits list (real-time & cached)
    useEffect(() => {
        const unsubPromise = subscribeToHabits((newHabits) => {
            setHabitsStore(newHabits);
        });
        return () => { unsubPromise.then(unsub => unsub()); };
    }, []);

    // Load Completions when date changes
    useEffect(() => {
        const loadCompletions = async () => {
            const dateStr = selectedDate.toISOString().split('T')[0];
            const c = await getCompletions(dateStr);
            setCompletions(c);
        };
        loadCompletions();
    }, [selectedDate]);

    // Merge Habits + Completions
    useEffect(() => {
        const mapped: Habit[] = habitsStore.map(item => ({
            ...item,
            completed: !!completions[item.id],
            streak: 0
        }));
        setHabits(mapped);

        // Calculate weekly completions for CalendarStrip
        const calcWeeklyCompletions = async () => {
            const result: Record<string, { completed: number; total: number }> = {};
            const today = new Date();
            for (let i = -30; i <= 7; i++) {
                const date = new Date(today);
                date.setDate(today.getDate() + i);
                const dateStr = date.toISOString().split('T')[0];
                const dayCompletions = await getCompletions(dateStr);
                const totalHabits = habitsStore.filter(h => !h.isGoal).length;
                const completedCount = Object.values(dayCompletions).filter(Boolean).length;
                result[dateStr] = { completed: completedCount, total: totalHabits };
            }
            setWeeklyCompletions(result);
        };
        calcWeeklyCompletions();
    }, [habitsStore, completions]);

    const { playComplete, playClick } = useSoundEffects();

    const handleDateSelect = (date: Date) => {
        lightFeedback();
        playClick();
        setSelectedDate(date);
    };

    // Pull-to-Filter Logic
    const scrollY = useSharedValue(0);
    const filterTriggered = useSharedValue(false);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
            if (event.contentOffset.y < -80 && !filterTriggered.value) {
                filterTriggered.value = true; // Lock
                runOnJS(lightFeedback)();
                runOnJS(setShowFilter)(true);
            }
        },
        onEndDrag: () => {
            filterTriggered.value = false; // Reset lock on release
        }
    });

    const categories = ['All', 'Health', 'Fitness', 'Mindfulness', 'Work', 'Personal'];

    const handleHabitPress = (habit: Habit) => {
        lightFeedback();
        const dateStr = selectedDate.toISOString().split('T')[0];
        router.push({
            pathname: '/habit-detail',
            params: {
                habitId: habit.id,
                date: dateStr,
                // Pass initial data to avoid "morphing" / loading on next screen
                initialName: habit.name,
                initialCategory: habit.category,
                initialIcon: habit.icon,
                initialDuration: habit.durationMinutes ? String(habit.durationMinutes) : '',
                initialCompleted: habit.completed ? 'true' : 'false'
            }
        });
    };

    const toggleHabit = async (habitId: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selected = new Date(selectedDate);
        selected.setHours(0, 0, 0, 0);

        // Only allow completing habits for today
        if (selected.getTime() !== today.getTime()) {
            Alert.alert(
                "Today Only",
                selected > today
                    ? "You can only complete habits for today. Come back when the day arrives!"
                    : "You can only complete habits for today. Past days cannot be modified."
            );
            return;
        }

        if (!completions[habitId]) {
            // If completing, play sound
            playComplete();
        } else {
            lightFeedback();
        }

        // Optimistic Update
        setCompletions(prev => ({ ...prev, [habitId]: !prev[habitId] }));

        const dateStr = selectedDate.toISOString().split('T')[0];
        try {
            await toggleCompletion(habitId, dateStr);
        } catch (e) {
            // Revert on error
            setCompletions(prev => ({ ...prev, [habitId]: !prev[habitId] }));
        }
    };

    const handleDelete = (habit: Habit) => {
        Alert.alert(
            "Delete Habit",
            "Are you sure you want to delete this habit? This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        await removeHabitEverywhere(habit.id);
                        // No need to reload, subscription handles it
                    }
                }
            ]
        );
    };

    const handleEdit = (habit: Habit) => {
        // Navigate to create screen with params to edit
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

    const handleFocus = (habit: Habit) => {
        handleHabitPress(habit);
    };

    const goals = habitsStore.filter(h => h.isGoal);


    return (
        <VoidShell>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                <View style={{ flex: 1, position: 'relative' }}>

                    {/* Layer 1 (Top): Calendar Strip (Fixed) */}
                    <View style={{ zIndex: 10 }}>
                        <CalendarStrip
                            selectedDate={selectedDate}
                            onSelectDate={handleDateSelect}
                            completionData={weeklyCompletions}
                        />
                    </View>


                    <View style={{ flex: 1 }}>
                        <Animated.ScrollView
                            onScroll={scrollHandler}
                            scrollEventThrottle={16}
                            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150, paddingTop: 10 }}
                            showsVerticalScrollIndicator={false}
                        >
                            {/* Pull Hint */}
                            <Animated.View style={{ height: 0, overflow: 'visible', alignItems: 'center', justifyContent: 'flex-end', marginTop: -50 }}>
                                <View style={{ alignItems: 'center', opacity: 0.5, paddingBottom: 20 }}>
                                    <Ionicons name="filter" size={20} color={colors.textSecondary} />
                                    <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 4 }}>PULL TO FILTER</Text>
                                </View>
                            </Animated.View>



                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 8 }}>
                                <Text style={{ fontSize: 20, color: colors.textPrimary, fontFamily: 'SpaceGrotesk-Bold', letterSpacing: 1 }}>TARGETS</Text>
                            </View>

                            {/* Goals Section */}
                            <View style={{ marginBottom: 32 }}>
                                {goals.length > 0 ? (
                                    goals.map((goal) => {
                                        const associatedHabits = habitsStore.filter(h => h.goalId === goal.id);
                                        // Simple progress calculation: 65% for now if has habits, else 0
                                        const progress = associatedHabits.length > 0 ? 65 : 0;
                                        return (
                                            <GoalCard
                                                key={goal.id}
                                                goal={goal}
                                                progress={progress}
                                                onPress={() => router.push({ pathname: '/goal-detail', params: { goalId: goal.id } })}
                                            />
                                        );
                                    })
                                ) : (
                                    <VoidCard style={{ alignItems: 'center', justifyContent: 'center', padding: 24, borderStyle: 'dashed' }}>
                                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'SpaceMono-Regular' }}>NO ACTIVE TARGETS</Text>
                                    </VoidCard>
                                )}
                            </View>

                            <Text style={{ fontSize: 20, color: colors.textPrimary, fontFamily: 'SpaceGrotesk-Bold', letterSpacing: 1, marginBottom: 12 }}>TODAY'S OPERATIONS</Text>
                            {habits.filter(h => !h.isGoal).length > 0 ? (
                                habits.filter(h => !h.isGoal).map((habit) => (
                                    <SwipeableHabitItem
                                        key={habit.id}
                                        habit={habit}
                                        onPress={() => handleHabitPress(habit)}
                                        onEdit={handleEdit}
                                        onDelete={handleDelete}
                                        onFocus={handleFocus}
                                    />
                                ))
                            ) : (
                                <VoidCard style={{ alignItems: 'center', justifyContent: 'center', padding: 24, borderStyle: 'dashed' }}>
                                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'SpaceMono-Regular' }}>NO OPERATIONS SCHEDULED</Text>
                                </VoidCard>
                            )}
                        </Animated.ScrollView>
                    </View>

                    <GoalCreationWizard
                        visible={isWizardVisible}
                        onClose={() => setIsWizardVisible(false)}
                        onSuccess={() => {
                            // Refresh logic if needed
                        }}
                    />

                    {/* Custom Filter Modal (Bottom Sheet Style) */}
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
                                        backgroundColor: colors.surface,
                                        borderTopLeftRadius: 32,
                                        borderTopRightRadius: 32,
                                        padding: 24,
                                        borderWidth: 1,
                                        borderColor: 'rgba(255,255,255,0.1)',
                                        shadowColor: "#000",
                                        shadowOffset: { width: 0, height: -4 },
                                        shadowOpacity: 0.3,
                                        shadowRadius: 10,
                                        paddingBottom: 40
                                    }}>

                                    <View style={{ alignItems: 'center', marginBottom: 24 }}>
                                        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                                    </View>

                                    <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.textPrimary, fontFamily: 'SpaceGrotesk-Bold', marginBottom: 8 }}>
                                        Filter View
                                    </Text>
                                    <Text style={{ color: colors.textSecondary, marginBottom: 24, fontSize: 14 }}>
                                        Show only specific habits
                                    </Text>

                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 }}>
                                        {categories.map((cat) => (
                                            <TouchableOpacity
                                                key={cat}
                                                activeOpacity={0.8}
                                                onPress={() => {
                                                    lightFeedback();
                                                    setSelectedCategory(cat === 'All' ? null : cat.toLowerCase());
                                                }}
                                                style={{
                                                    paddingHorizontal: 16,
                                                    paddingVertical: 12,
                                                    borderRadius: 16,
                                                    backgroundColor: (selectedCategory === cat.toLowerCase() || (cat === 'All' && !selectedCategory))
                                                        ? colors.primary
                                                        : 'rgba(255,255,255,0.05)',
                                                    borderWidth: 1,
                                                    borderColor: (selectedCategory === cat.toLowerCase() || (cat === 'All' && !selectedCategory))
                                                        ? colors.primary
                                                        : 'rgba(255,255,255,0.1)',
                                                }}
                                            >
                                                <Text style={{
                                                    color: (selectedCategory === cat.toLowerCase() || (cat === 'All' && !selectedCategory)) ? '#fff' : colors.textSecondary,
                                                    fontWeight: '600',
                                                    fontSize: 14,
                                                    fontFamily: 'SpaceMono-Regular'
                                                }}>
                                                    {cat}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <TouchableOpacity
                                        onPress={() => setShowFilter(false)}
                                        style={{
                                            backgroundColor: colors.surfaceSecondary,
                                            paddingVertical: 16,
                                            borderRadius: 20,
                                            alignItems: 'center',
                                            borderWidth: 1,
                                            borderColor: 'rgba(255,255,255,0.1)'
                                        }}
                                    >
                                        <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 16, fontFamily: 'SpaceGrotesk-Bold' }}>
                                            Done
                                        </Text>
                                    </TouchableOpacity>
                                </Animated.View>
                            </TouchableOpacity>
                        </Modal>
                    )}


                </View>
            </SafeAreaView>
        </VoidShell>
    );
};

export default CalendarScreen;
