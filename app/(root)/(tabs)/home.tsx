import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, DeviceEventEmitter } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { CalendarStrip } from '@/components/Home/CalendarStrip';
import { SwipeableHabitItem } from '@/components/Home/SwipeableHabitItem';
import { getHabits as loadHabits, subscribeToHabits, getCompletions, toggleCompletion, removeHabitEverywhere, Habit as StoreHabit } from '@/lib/habits';
import { Ionicons } from '@expo/vector-icons';
import { useHaptics } from '@/hooks/useHaptics';
import { useRouter, useFocusEffect } from 'expo-router';
import { Alert } from 'react-native';

interface Habit extends StoreHabit {
  streak?: number;
  completed?: boolean;
}

const Home = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { lightFeedback } = useHaptics();

  const [habitsStore, setHabitsStore] = useState<StoreHabit[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<Record<string, boolean>>({});
  const [selectedDate, setSelectedDate] = useState(new Date());
  
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

  const handleDateSelect = (date: Date) => {
    lightFeedback();
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
    lightFeedback();
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

  return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ flex: 1, position: 'relative' }}>
          
          {/* Layer 1 (Top): Calendar Strip (Fixed) */}
          <View style={{zIndex: 10 }}>
            <CalendarStrip selectedDate={selectedDate} onSelectDate={handleDateSelect} />
          </View>

          {/* Layer 2 (Background): Habits List */}
          <View style={{ flex: 1, paddingHorizontal: 20 }}>
             <ScrollView contentContainerStyle={{ paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
                <View className="flex-row justify-end items-center mb-4 mt-2">
                    <TouchableOpacity onPress={() => router.push('/roadmap')}>
                        <Text className="text-sm font-semibold" style={{ color: colors.primary }}>View Roadmap</Text>
                    </TouchableOpacity>
                </View>

                {habits.length > 0 ? (
                    habits.map((habit) => (
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
                    <View className="items-center justify-center py-10">
                        <Text className="text-gray-400">No habits for this day</Text>
                    </View>
                )}
             </ScrollView>
          </View>

          {/* Footer Navigation Bar */}
          <View 
            className="absolute bottom-0 left-0 right-0 px-6 py-4 flex-row justify-between items-center border-t"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
             <TouchableOpacity 
                className="w-12 h-12 rounded-full items-center justify-center"
                style={{ backgroundColor: colors.surfaceSecondary }}
                onPress={() => router.push('/settings')}
             >
                 <Ionicons name="settings-outline" size={24} color={colors.textSecondary} />
             </TouchableOpacity>

             <TouchableOpacity 
                className="flex-1 mx-4 h-12 rounded-full flex-row items-center justify-center shadow-sm"
                style={{ backgroundColor: colors.primary }}
                onPress={() => router.push({ pathname: '/statistics', params: { date: selectedDate.toISOString().split('T')[0] } })}
             >
                 <Ionicons name="stats-chart" size={20} color="white" style={{ marginRight: 8 }} />
                 <Text className="text-white font-bold text-lg">Show Performance</Text>
             </TouchableOpacity>

             <TouchableOpacity 
                className="w-12 h-12 rounded-full items-center justify-center shadow-sm"
                style={{ backgroundColor: colors.surfaceSecondary }}
                onPress={() => router.push('/create')}
             >
                 <Ionicons name="add" size={28} color={colors.primary} />
             </TouchableOpacity>
          </View>

        </View>
      </SafeAreaView>
  );
};

export default Home;
