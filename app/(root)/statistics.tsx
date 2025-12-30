import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRouter, useGlobalSearchParams } from 'expo-router';
import { getHabits, getCompletions, getStreakData, getHeatmapData, getLastNDaysCompletions, Habit, HabitCategory } from '@/lib/habits';
import { LifeAreaChart } from '@/components/Statistics/LifeAreaChart';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';
import { DashboardView } from '@/components/Dashboard/DashboardView';
import { DashboardData, Goal, Habit as DashboardHabit } from '@/components/Dashboard/Dashboard.types';

const { width } = Dimensions.get('window');

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
  const params = useGlobalSearchParams();
  const dateStr = params.date as string || new Date().toISOString().split('T')[0];
  
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  
  const [loading, setLoading] = useState(true);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completionMap, setCompletionMap] = useState<Record<string, boolean>>({});
  const [selectedCategory, setSelectedCategory] = useState<HabitCategory | null>(null);
  
  // New Stats State
  const [streakData, setStreakData] = useState({ currentStreak: 0, bestStreak: 0, perfectDays: 0, totalCompleted: 0 });
  const [heatmapData, setHeatmapData] = useState<{ date: string; count: number }[]>([]);
  const [weeklyData, setWeeklyData] = useState<{ date: string; completedIds: string[] }[]>([]);

  const loadData = useCallback(async () => {
    try {
      const h = await getHabits();
      const c = await getCompletions(dateStr);
      const s = await getStreakData();
      const hm = await getHeatmapData();
      const w = await getLastNDaysCompletions(7);

      setHabits(h);
      setCompletionMap(c);
      setStreakData(s);
      setHeatmapData(hm);
      setWeeklyData(w);
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
    (Object.keys(CATEGORY_CONFIG) as HabitCategory[]).forEach(cat => counts[cat] = 0);

    habits.forEach(h => {
        if (counts[h.category] !== undefined) {
            counts[h.category]++;
        } else {
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
        .filter(d => d.count > 0);
  }, [habits]);

  // Map real data to DashboardData
  const dashboardData: DashboardData = useMemo(() => {
    const mappedHabits: DashboardHabit[] = habits.map(h => ({
        id: h.id,
        title: h.name,
        icon: h.icon || '⭐',
        streak: 0, // Need to implement streak per habit if available
        weeklyCompletionRate: 0, // Need to calculate
        color: CATEGORY_CONFIG[h.category]?.color || '#9CA3AF'
    }));

    const mappedGoals: Goal[] = habits.filter(h => h.isGoal).map(h => ({
        id: h.id,
        title: h.name,
        icon: h.icon || '🎯',
        targetDate: h.targetDate || '',
        progress: 0, // Need actual progress logic
        habits: [], // Need to link habits to goals if schema supports it
        milestones: [],
        projectedCompletionDate: '',
        status: 'on_track'
    }));

    return {
        currentStreak: streakData.currentStreak,
        bestStreak: streakData.bestStreak,
        percentAboveBest: 0, // Calculate this
        percentile: 0,
        goalsProgress: mappedGoals.length > 0 ? 45 : 0, // Placeholder
        weeklyCompletionRate: consistency,
        weeklyData: weeklyData.map(d => ({
            day: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
            completionRate: habits.length > 0 ? (d.completedIds.length / habits.length) * 100 : 0,
            date: d.date
        })),
        goals: mappedGoals,
        heatmapData: heatmapData.map(d => ({
            date: d.date,
            count: d.count,
            intensity: Math.min(Math.floor(d.count / 2), 4)
        }))
    };
  }, [habits, streakData, consistency, weeklyData, heatmapData]);

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
          className="w-10 h-10 rounded-full items-center justify-center border"
          style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}
        >
          <Ionicons name="close" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 50 }} showsVerticalScrollIndicator={false}>
        <View className="px-6">
            <DashboardView data={dashboardData} />
        </View>

        {/* Life Areas Section (Existing but Styled) */}
        <View className="px-6 mt-8 mb-8">
            <View className="p-5 rounded-3xl border" style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}>
                <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>Life Areas Breakdown</Text>
                </View>
                
                <LifeAreaChart 
                    data={chartData} 
                    selectedCategory={selectedCategory}
                    onSelectCategory={setSelectedCategory}
                />
            </View>
        </View>

        {/* Details Section (Keep logic but styled cleaner) */}
        {selectedCategory && (
            <View className="px-6 mb-10">
                <View className="flex-row items-center mb-4">
                    <View className="w-1 h-6 rounded-full mr-3" style={{ backgroundColor: CATEGORY_CONFIG[selectedCategory].color }} />
                    <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                        {CATEGORY_CONFIG[selectedCategory].label} Details
                    </Text>
                </View>

                {/* Habits in this category */}
                <View>
                    <Text className="text-sm font-bold uppercase tracking-wider mb-3 opacity-70" style={{ color: colors.textSecondary }}>Active Habits</Text>
                    {habits.filter(h => h.category === selectedCategory).length > 0 ? (
                        habits.filter(h => h.category === selectedCategory).map(habit => (
                            <View 
                                key={habit.id} 
                                className="flex-row items-center justify-between p-4 rounded-2xl mb-3 border bg-black/5"
                                style={{ borderColor: colors.border }}
                            >
                                <View className="flex-row items-center flex-1">
                                    <View className="w-10 h-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: CATEGORY_CONFIG[selectedCategory].color + '20' }}>
                                        <Ionicons name={(habit.icon as any) || 'star'} size={20} color={CATEGORY_CONFIG[selectedCategory].color} />
                                    </View>
                                    <View>
                                        <Text className="font-bold text-base" style={{ color: colors.textPrimary }}>{habit.name}</Text>
                                        <Text className="text-xs" style={{ color: colors.textSecondary }}>
                                            {habit.durationMinutes ? `${habit.durationMinutes} min` : 'Any duration'}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ))
                    ) : (
                        <Text className="text-center py-4 italic" style={{ color: colors.textSecondary }}>No regular habits.</Text>
                    )}
                </View>
            </View>
        )}
      </ScrollView>
    </View>
  );
}
