import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, DeviceEventEmitter } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { CalendarStrip } from '@/components/Home/CalendarStrip';
import { AnalyticsModal } from '@/components/Home/AnalyticsModal';
import { getHabits as loadHabits, getCompletions, toggleCompletion, Habit as StoreHabit } from '@/lib/habits';
import { Ionicons } from '@expo/vector-icons';
import { useHaptics } from '@/hooks/useHaptics';
import { useRouter } from 'expo-router';

import { HabitDetailModal } from '@/components/HabitDetailModal';

interface Habit extends StoreHabit {
  streak?: number;
  completed?: boolean;
}

const Home = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { lightFeedback } = useHaptics();

  const [habits, setHabits] = useState<Habit[]>([]);
  const [completedHabits, setCompletedHabits] = useState(0);
  const [totalHabits, setTotalHabits] = useState(0);
  
  // Detail Modal State
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [habitDetailVisible, setHabitDetailVisible] = useState(false);

  // Load Data
  const loadData = useCallback(async () => {
    const h = await loadHabits();
    const c = await getCompletions();
    const mapped: Habit[] = h.map(item => ({ ...item, completed: !!c[item.id], streak: 0 }));
    setHabits(mapped);
    setTotalHabits(mapped.length);
    setCompletedHabits(Object.values(c).filter(Boolean).length);
  }, []);

  useEffect(() => {
    loadData();
    const sub = DeviceEventEmitter.addListener('habit_created', loadData);
    return () => sub.remove();
  }, [loadData]);

  const handleHabitPress = (habit: Habit) => {
    lightFeedback();
    setSelectedHabit(habit);
    setHabitDetailVisible(true);
  };

  const toggleHabit = async (habitId: string) => {
    lightFeedback();
    const next = await toggleCompletion(habitId);
    setHabits(prev => prev.map(h => ({ ...h, completed: !!next[h.id] })));
    setCompletedHabits(Object.values(next).filter(Boolean).length);
  };

  return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, position: 'relative' }}>
          
          {/* Layer 1 (Top): Calendar Strip (Fixed) */}
          <View style={{ height: '25%', zIndex: 10 }}>
            <CalendarStrip />
          </View>

          {/* Layer 2 (Background): Habits List */}
          <View style={{ flex: 1, marginTop: -20, paddingHorizontal: 20 }}>
             <ScrollView contentContainerStyle={{ paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
                <View className="flex-row justify-between items-center mb-4 mt-2">
                    <Text className="text-xl font-bold" style={{ color: colors.textPrimary }}>Today's Tasks</Text>
                    <TouchableOpacity onPress={() => router.push('/roadmap')}>
                        <Text className="text-sm font-semibold" style={{ color: colors.primary }}>View Roadmap</Text>
                    </TouchableOpacity>
                </View>

                {habits.length > 0 ? (
                    habits.map((habit) => (
                        <TouchableOpacity 
                            key={habit.id}
                            onPress={() => handleHabitPress(habit)}
                            className="flex-row items-center p-4 mb-3 rounded-2xl bg-white border border-gray-100 shadow-sm"
                        >
                            <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${habit.completed ? 'bg-green-100' : 'bg-gray-100'}`}>
                                <Ionicons 
                                    name={habit.completed ? "checkmark" : "ellipse-outline"} 
                                    size={24} 
                                    color={habit.completed ? colors.success : colors.textSecondary} 
                                />
                            </View>
                            <View className="flex-1">
                                <Text className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                                    {habit.name}
                                </Text>
                                <Text className="text-sm text-gray-500">
                                    {habit.durationMinutes} mins • {habit.streak} day streak
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ))
                ) : (
                    <View className="items-center justify-center py-10">
                        <Text className="text-gray-400">No habits for today</Text>
                    </View>
                )}
             </ScrollView>
          </View>

          {/* Layer 3 (Overlay): Analytics Modal */}
          <AnalyticsModal 
             completedHabitsCount={completedHabits}
             totalHabitsCount={totalHabits}
          />

        </View>
        
        {/* Habit Detail Modal */}
        <HabitDetailModal
            visible={habitDetailVisible}
            onClose={() => setHabitDetailVisible(false)}
            habit={selectedHabit}
            onToggleCompletion={toggleHabit}
            isCompleted={selectedHabit?.completed}
        />

      </SafeAreaView>
  );
};

export default Home;
