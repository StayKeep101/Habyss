import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ProgressWidget } from '@/components/Home/ProgressWidget';
import { HealthData, KcalChart, TimeChart, DistanceChart, WorkoutChart } from '@/components/Home/Statistics';
import { loadHabits, getCompletions, Habit } from '@/lib/habits';

export default function StatisticsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const dateStr = params.date as string || new Date().toISOString().split('T')[0];
  const selectedDate = new Date(dateStr);
  
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    completed: 0,
    total: 0
  });

  const loadData = useCallback(async () => {
    try {
      const habits = await loadHabits();
      const completions = await getCompletions(dateStr);
      const total = habits.length;
      const completed = habits.filter(h => completions[h.id]).length;
      setStats({ completed, total });
    } finally {
      setLoading(false);
    }
  }, [dateStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const dateLabel = selectedDate.toDateString() === new Date().toDateString() 
    ? 'Today' 
    : selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  if (loading) {
    return (
        <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
            <ActivityIndicator size="large" color={colors.primary} />
        </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View className="px-6 pt-6 pb-4 flex-row justify-between items-center" style={{ backgroundColor: colors.background }}>
        <Text className="text-3xl font-bold" style={{ color: colors.textPrimary }}>Statistics</Text>
        <TouchableOpacity 
          onPress={() => router.back()} 
          className="w-10 h-10 rounded-full items-center justify-center"
          style={{ backgroundColor: colors.surfaceSecondary }}
        >
          <Ionicons name="close" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 50 }} showsVerticalScrollIndicator={false}>
        
        {/* Gauge Section */}
        <View className="items-center mb-8 mt-4">
             <ProgressWidget compact={false} />
             <Text className="mt-4 text-sm font-medium" style={{ color: colors.textSecondary }}>
                {dateLabel} • {stats.completed} of {stats.total} completed
             </Text>
        </View>

        <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>Health Overview</Text>
            <TouchableOpacity>
                <Text className="text-sm font-semibold" style={{ color: colors.primary }}>See all</Text>
            </TouchableOpacity>
        </View>

        <HealthData />

        <View className="flex-row mb-4">
            <KcalChart />
            <View className="flex-1 justify-between">
                 <TimeChart />
                 <DistanceChart />
            </View>
        </View>

        <WorkoutChart />

      </ScrollView>
    </View>
  );
}
