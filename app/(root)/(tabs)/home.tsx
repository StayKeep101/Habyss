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
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Detail Modal State
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [habitDetailVisible, setHabitDetailVisible] = useState(false);

  // Load Data
  const loadData = useCallback(async () => {
    const h = await loadHabits();
    // Use selectedDate for completions
    const dateStr = selectedDate.toISOString().split('T')[0];
    const c = await getCompletions(dateStr);
    
    const mapped: Habit[] = h.map(item => ({ ...item, completed: !!c[item.id], streak: 0 }));
    setHabits(mapped);
    setTotalHabits(mapped.length);
    setCompletedHabits(Object.values(c).filter(Boolean).length);
  }, [selectedDate]);

  useEffect(() => {
    loadData();
    const sub = DeviceEventEmitter.addListener('habit_created', loadData);
    return () => sub.remove();
  }, [loadData]);

  const handleDateSelect = (date: Date) => {
    lightFeedback();
    setSelectedDate(date);
  };

  const handleHabitPress = (habit: Habit) => {
    lightFeedback();
    const dateStr = selectedDate.toISOString().split('T')[0];
    router.push({
        pathname: '/habit-detail',
        params: { habitId: habit.id, date: dateStr }
    });
  };

  const toggleHabit = async (habitId: string) => {
    lightFeedback();
    const dateStr = selectedDate.toISOString().split('T')[0];
    const next = await toggleCompletion(habitId, dateStr);
    setHabits(prev => prev.map(h => ({ ...h, completed: !!next[h.id] })));
    setCompletedHabits(Object.values(next).filter(Boolean).length);
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
                        <TouchableOpacity 
                            key={habit.id}
                            onPress={() => handleHabitPress(habit)}
                            className="flex-row items-center p-4 mb-3 rounded-2xl bg-white shadow-sm"
                            style={{ backgroundColor: colors.surfaceSecondary }}
                        >
                            <View className="w-12 h-12 rounded-full items-center justify-center mr-4" style={{ backgroundColor: habit.completed ? colors.success + '20' : colors.surfaceTertiary }}>
                                <Ionicons 
                                    name={habit.completed ? "checkmark" : "ellipse-outline"} 
                                    size={24} 
                                    color={habit.completed ? colors.success : colors.textTertiary} 
                                />
                            </View>
                            <View className="flex-1">
                                <Text className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                                    {habit.name}
                                </Text>
                                <Text className="text-sm" style={{ color: colors.textSecondary }}>
                                    {habit.durationMinutes} mins • {habit.streak} day streak
                                </Text>
                            </View>
                        </TouchableOpacity>
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
