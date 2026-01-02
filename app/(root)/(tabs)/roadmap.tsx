import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native';
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
    }, [habitsStore, completions]);

    const { playComplete, playClick } = useSoundEffects();

    const handleDateSelect = (date: Date) => {
        lightFeedback();
        playClick();
        setSelectedDate(date);
        // Optimistically clear completions while loading new ones to avoid confusion
        // Or keep them until new ones load? Keeping them is better for perceived speed if IDs match, 
        // but clearing is safer for correctness. Let's keep for now as effect runs fast.
    };

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

        if (selected > today) {
            Alert.alert("Cannot complete habits in the future", "Please wait until the day arrives!");
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
                        <CalendarStrip selectedDate={selectedDate} onSelectDate={handleDateSelect} />
                    </View>


                    {/* Layer 2 (Background): Goals & Habits List */}
                    <View style={{ flex: 1, paddingHorizontal: 20 }}>
                        <ScrollView contentContainerStyle={{ paddingBottom: 150, paddingTop: 10 }} showsVerticalScrollIndicator={false}>



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
                        </ScrollView>
                    </View>

                    <GoalCreationWizard
                        visible={isWizardVisible}
                        onClose={() => setIsWizardVisible(false)}
                        onSuccess={() => {
                            // Refresh logic if needed
                        }}
                    />

                </View>
            </SafeAreaView>
        </VoidShell>
    );
};

export default CalendarScreen;
