import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, DeviceEventEmitter } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { RoadmapView } from '@/components/Home/RoadmapView';
import { getHabits as loadHabits, getCompletions, Habit as StoreHabit } from '@/lib/habits';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface Habit extends StoreHabit {
  streak?: number;
  completed?: boolean;
}

export default function RoadmapScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completedHabits, setCompletedHabits] = useState(0);
  const [totalHabits, setTotalHabits] = useState(0);

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

  // Handler for day press - maybe show a simple alert or modal in future
  const handleDayPress = (day: any) => {
    // For now, just logging or simple feedback
    console.log('Day pressed:', day);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View className="flex-row items-center px-6 py-4 border-b" style={{ backgroundColor: colors.background, borderColor: colors.border }}>
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2 rounded-full" style={{ backgroundColor: colors.surfaceSecondary }}>
             <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text className="text-xl font-bold" style={{ color: colors.textPrimary }}>My Journey</Text>
      </View>
      
      <View style={{ flex: 1 }}>
         <RoadmapView 
            onDayPress={handleDayPress} 
            habits={habits}
            completedHabitsCount={completedHabits}
            totalHabitsCount={totalHabits}
         />
      </View>
    </SafeAreaView>
  );
}
