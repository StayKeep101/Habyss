import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getHabits, getCompletions, Habit, HabitCategory } from '@/lib/habits';
import { LifeAreaChart } from '@/components/Statistics/LifeAreaChart';
import { ProgressWidget } from '@/components/Home/ProgressWidget';

const CATEGORY_CONFIG: Record<HabitCategory, { label: string; color: string }> = {
  health: { label: 'Health', color: '#34D399' },
  fitness: { label: 'Fitness', color: '#FBBF24' },
  work: { label: 'Work', color: '#60A5FA' },
  personal: { label: 'Personal', color: '#F472B6' },
  mindfulness: { label: 'Mindfulness', color: '#A78BFA' },
  misc: { label: 'Misc', color: '#9CA3AF' },
};

export default function StatisticsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const dateStr = params.date as string || new Date().toISOString().split('T')[0];
  
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  
  const [loading, setLoading] = useState(true);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completionMap, setCompletionMap] = useState<Record<string, boolean>>({});
  const [selectedCategory, setSelectedCategory] = useState<HabitCategory | null>(null);

  const loadData = useCallback(async () => {
    try {
      const h = await getHabits();
      const c = await getCompletions(dateStr);
      setHabits(h);
      setCompletionMap(c);
    } finally {
      setLoading(false);
    }
  }, [dateStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculate Consistency (Percentage of habits completed today)
  const consistency = useMemo(() => {
    if (habits.length === 0) return 0;
    const completedCount = habits.filter(h => completionMap[h.id]).length;
    return Math.round((completedCount / habits.length) * 100);
  }, [habits, completionMap]);

  // Chart Data: Group habits by category
  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    
    // Initialize
    (Object.keys(CATEGORY_CONFIG) as HabitCategory[]).forEach(cat => counts[cat] = 0);

    habits.forEach(h => {
        if (counts[h.category] !== undefined) {
            counts[h.category]++;
        } else {
            // Fallback for old categories
            counts['misc'] = (counts['misc'] || 0) + 1;
        }
    });

    return (Object.keys(CATEGORY_CONFIG) as HabitCategory[])
        .map(cat => ({
            category: cat,
            count: counts[cat],
            label: CATEGORY_CONFIG[cat].label,
            color: CATEGORY_CONFIG[cat].color
        }))
        .filter(d => d.count > 0); // Only show categories with data
  }, [habits]);

  // Filtered List
  const filteredHabits = useMemo(() => {
    if (!selectedCategory) return [];
    return habits.filter(h => h.category === selectedCategory);
  }, [habits, selectedCategory]);

  const goals = filteredHabits.filter(h => h.isGoal);
  const regularHabits = filteredHabits.filter(h => !h.isGoal);

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
        <Text className="text-3xl font-bold" style={{ color: colors.textPrimary }}>Performance</Text>
        <TouchableOpacity 
          onPress={() => router.back()} 
          className="w-10 h-10 rounded-full items-center justify-center"
          style={{ backgroundColor: colors.surfaceSecondary }}
        >
          <Ionicons name="close" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 50 }} showsVerticalScrollIndicator={false}>
        
        {/* Consistency Section */}
        <View className="px-6 mt-4">
             <Text className="text-xl font-bold mb-4" style={{ color: colors.textPrimary }}>Consistency</Text>
             <View className="p-6 rounded-3xl items-center" style={{ backgroundColor: colors.surfaceSecondary }}>
                <ProgressWidget percentage={consistency} compact={false} title="Today's Consistency" />
                <Text className="mt-4 text-center text-sm" style={{ color: colors.textSecondary }}>
                    You have completed {Math.round((consistency / 100) * habits.length)} out of {habits.length} habits today.
                </Text>
             </View>
        </View>

        {/* Life Areas Section */}
        <View className="mt-8">
            <View className="px-6 mb-2">
                <Text className="text-xl font-bold" style={{ color: colors.textPrimary }}>Life Areas</Text>
            </View>
            
            {/* Chart Section */}
            <LifeAreaChart 
                data={chartData} 
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
            />
        </View>

        {/* Details Section */}
        {selectedCategory && (
            <View className="px-6 mt-6">
                <Text className="text-2xl font-bold mb-6" style={{ color: CATEGORY_CONFIG[selectedCategory].color }}>
                    {CATEGORY_CONFIG[selectedCategory].label}
                </Text>

                {/* Goals */}
                {goals.length > 0 && (
                    <View className="mb-8">
                        <View className="flex-row items-center mb-4">
                            <Ionicons name="trophy" size={20} color={colors.textSecondary} />
                            <Text className="text-lg font-bold ml-2" style={{ color: colors.textPrimary }}>Goals</Text>
                        </View>
                        {goals.map(goal => (
                            <View 
                                key={goal.id} 
                                className="p-4 rounded-2xl mb-3 border"
                                style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}
                            >
                                <View className="flex-row justify-between items-center mb-2">
                                    <Text className="font-bold text-lg" style={{ color: colors.textPrimary }}>{goal.name}</Text>
                                    {goal.targetDate && (
                                        <View className="px-2 py-1 rounded-md" style={{ backgroundColor: colors.surfaceTertiary }}>
                                            <Text className="text-xs font-medium" style={{ color: colors.textSecondary }}>
                                                Target: {new Date(goal.targetDate).toLocaleDateString()}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                {/* Progress Bar Placeholder - Since we don't have detailed tracking yet */}
                                <View className="h-2 rounded-full w-full overflow-hidden mt-2" style={{ backgroundColor: colors.surfaceTertiary }}>
                                    <View className="h-full w-[45%]" style={{ backgroundColor: CATEGORY_CONFIG[selectedCategory].color }} />
                                </View>
                                <Text className="text-xs mt-2 text-right" style={{ color: colors.textSecondary }}>45% Consistency</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Habits */}
                <View>
                    <View className="flex-row items-center mb-4">
                        <Ionicons name="repeat" size={20} color={colors.textSecondary} />
                        <Text className="text-lg font-bold ml-2" style={{ color: colors.textPrimary }}>Habits</Text>
                    </View>
                    
                    {regularHabits.length > 0 ? (
                        regularHabits.map(habit => (
                            <View 
                                key={habit.id} 
                                className="flex-row items-center justify-between p-4 rounded-2xl mb-3 border"
                                style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}
                            >
                                <View className="flex-row items-center flex-1">
                                    <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: CATEGORY_CONFIG[selectedCategory].color + '20' }}>
                                        <Ionicons name={(habit.icon as any) || 'star'} size={20} color={CATEGORY_CONFIG[selectedCategory].color} />
                                    </View>
                                    <View>
                                        <Text className="font-bold text-base" style={{ color: colors.textPrimary }}>{habit.name}</Text>
                                        <Text className="text-xs" style={{ color: colors.textSecondary }}>
                                            {habit.durationMinutes ? `${habit.durationMinutes} min/session` : 'No duration set'}
                                        </Text>
                                    </View>
                                </View>
                                <View className="items-end">
                                    <Text className="text-xl font-bold" style={{ color: colors.textPrimary }}>0</Text>
                                    <Text className="text-xs" style={{ color: colors.textSecondary }}>Streak</Text>
                                </View>
                            </View>
                        ))
                    ) : (
                        <Text className="text-center py-4" style={{ color: colors.textSecondary }}>No regular habits in this category yet.</Text>
                    )}
                </View>
            </View>
        )}

        {!selectedCategory && chartData.length > 0 && (
            <View className="items-center justify-center mt-10">
                <Text className="text-lg" style={{ color: colors.textSecondary }}>Select a category above to view details</Text>
            </View>
        )}
        
        {!selectedCategory && chartData.length === 0 && (
            <View className="items-center justify-center mt-10 px-6">
                <Text className="text-lg text-center mb-4" style={{ color: colors.textSecondary }}>No habits created yet.</Text>
                <TouchableOpacity 
                    onPress={() => router.push('/create')}
                    className="px-6 py-3 rounded-full"
                    style={{ backgroundColor: colors.primary }}
                >
                    <Text className="text-white font-bold">Create your first habit</Text>
                </TouchableOpacity>
            </View>
        )}

      </ScrollView>
    </View>
  );
}
