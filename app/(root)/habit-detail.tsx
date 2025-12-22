import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Habit, getHabits, toggleCompletion, getCompletions } from '@/lib/habits';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function HabitDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const habitId = params.habitId as string;
  const dateStr = params.date as string || new Date().toISOString().split('T')[0];
  
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [habit, setHabit] = useState<Habit | null>(null);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0); // Mock streak for now

  useEffect(() => {
    loadHabitDetails();
  }, [habitId, dateStr]);

  const loadHabitDetails = async () => {
    try {
      const habits = await getHabits();
      const found = habits.find(h => h.id === habitId);
      if (found) {
        setHabit(found);
        // Check completion status for the specific date
        const completions = await getCompletions(dateStr);
        setCompleted(!!completions[habitId]);
        // Ideally calculate real streak here
        setStreak(0); 
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    if (!habit) return;
    const next = await toggleCompletion(habit.id, dateStr);
    setCompleted(!!next[habit.id]);
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!habit) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text>Habit not found</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
            <Text style={{ color: colors.primary }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View className="px-6 pt-4 pb-2 border-b flex-row justify-between items-center" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
         <TouchableOpacity 
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full items-center justify-center"
          style={{ backgroundColor: colors.surfaceSecondary }}
        >
          <Ionicons name="arrow-down" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View className="flex-row items-center">
             <View className="w-8 h-8 rounded-full items-center justify-center mr-2" style={{ backgroundColor: completed ? colors.success + '20' : colors.surfaceSecondary }}>
                <Ionicons 
                    name={(habit.icon as any) || 'star'} 
                    size={16} 
                    color={completed ? colors.success : colors.textSecondary} 
                />
            </View>
            <Text className="text-xl font-bold" style={{ color: colors.textPrimary }}>
            Habit Details
            </Text>
        </View>
        <TouchableOpacity 
          onPress={() => Alert.alert('Options', 'Edit or Delete functionality to be implemented')}
          className="w-10 h-10 rounded-full items-center justify-center"
          style={{ backgroundColor: colors.surfaceSecondary }}
        >
          <Ionicons name="ellipsis-horizontal" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 100 }}>
         {/* Main Info Card */}
         <View className="p-6 rounded-3xl shadow-sm mb-6 items-center" style={{ backgroundColor: colors.surfaceSecondary }}>
            <View className="w-20 h-20 rounded-full items-center justify-center mb-4" style={{ backgroundColor: completed ? colors.success + '20' : colors.surfaceTertiary }}>
                <Ionicons 
                    name={(habit.icon as any) || 'star'} 
                    size={40} 
                    color={completed ? colors.success : colors.textSecondary} 
                />
            </View>
            <Text className="text-2xl font-bold mb-1 text-center" style={{ color: colors.textPrimary }}>
                {habit.name}
            </Text>
            <Text className="mb-4 text-center" style={{ color: colors.textSecondary }}>
                {habit.category.charAt(0).toUpperCase() + habit.category.slice(1)} • {habit.durationMinutes ? `${habit.durationMinutes} mins` : 'No duration'}
            </Text>

            <TouchableOpacity 
                onPress={handleToggle}
                className="px-8 py-3 rounded-full flex-row items-center"
                style={{ backgroundColor: completed ? colors.success : colors.primaryDark }}
            >
                <Ionicons name={completed ? "checkmark-circle" : "ellipse-outline"} size={20} color="white" style={{ marginRight: 8 }} />
                <Text className="text-white font-bold text-lg">
                    {completed ? 'Completed' : 'Mark Complete'}
                </Text>
            </TouchableOpacity>
         </View>

         {/* Stats Grid */}
         <Text className="text-lg font-bold mb-4" style={{ color: colors.textPrimary }}>
            Current Progress
         </Text>
         <View className="flex-row flex-wrap justify-between">
             <View className="w-[48%] p-4 rounded-2xl shadow-sm mb-4" style={{ backgroundColor: colors.surfaceSecondary }}>
                 <View className="flex-row items-center mb-2">
                     <Ionicons name="flame" size={20} color="#F97316" />
                     <Text className="ml-2 font-medium" style={{ color: colors.textSecondary }}>Current Streak</Text>
                 </View>
                 <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{streak} Days</Text>
             </View>

             <View className="w-[48%] p-4 rounded-2xl shadow-sm mb-4" style={{ backgroundColor: colors.surfaceSecondary }}>
                 <View className="flex-row items-center mb-2">
                     <Ionicons name="trophy" size={20} color="#EAB308" />
                     <Text className="ml-2 font-medium" style={{ color: colors.textSecondary }}>Best Streak</Text>
                 </View>
                 <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{streak} Days</Text>
             </View>

             <View className="w-[48%] p-4 rounded-2xl shadow-sm mb-4" style={{ backgroundColor: colors.surfaceSecondary }}>
                 <View className="flex-row items-center mb-2">
                     <Ionicons name="time" size={20} color="#3B82F6" />
                     <Text className="ml-2 font-medium" style={{ color: colors.textSecondary }}>Total Time</Text>
                 </View>
                 <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                    {habit.durationMinutes ? `${habit.durationMinutes * streak}` : '0'} mins
                 </Text>
             </View>

             <View className="w-[48%] p-4 rounded-2xl shadow-sm mb-4" style={{ backgroundColor: colors.surfaceSecondary }}>
                 <View className="flex-row items-center mb-2">
                     <Ionicons name="calendar" size={20} color="#8B5CF6" />
                     <Text className="ml-2 font-medium" style={{ color: colors.textSecondary }}>Frequency</Text>
                 </View>
                 <Text className="text-xl font-bold" style={{ color: colors.textPrimary }}>Daily</Text>
             </View>
         </View>

         {/* Description / Notes */}
         <View className="p-5 rounded-2xl shadow-sm mb-6" style={{ backgroundColor: colors.surfaceSecondary }}>
            <Text className="font-bold mb-2" style={{ color: colors.textPrimary }}>About this habit</Text>
            <Text className="leading-5" style={{ color: colors.textSecondary }}>
                Consistency is key! You've set this habit to improve your {habit.category}. 
                Keep up the good work and try to maintain your streak.
            </Text>
         </View>
      </ScrollView>
    </View>
  );
}
