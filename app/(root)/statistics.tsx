import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getHabits, getCompletions, getStreakData, getHeatmapData, getLastNDaysCompletions, Habit, HabitCategory } from '@/lib/habits';
import { LifeAreaChart } from '@/components/Statistics/LifeAreaChart';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';

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
  const params = useLocalSearchParams();
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

  // Helper for Stat Card
  const StatCard = ({ title, value, icon, color, subtitle }: { title: string, value: string | number, icon: any, color: string, subtitle?: string }) => (
    <View className="flex-1 p-4 rounded-2xl border min-w-[45%]" style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}>
        <View className="flex-row justify-between items-start mb-2">
            <View className="p-2 rounded-xl" style={{ backgroundColor: color + '20' }}>
                <Ionicons name={icon} size={20} color={color} />
            </View>
            {/* Sparkline placeholder could go here */}
        </View>
        <Text className="text-3xl font-bold mb-1" style={{ color: colors.textPrimary }}>{value}</Text>
        <Text className="text-xs font-medium" style={{ color: colors.textSecondary }}>{title}</Text>
        {subtitle && <Text className="text-[10px] mt-1 opacity-70" style={{ color: colors.textTertiary }}>{subtitle}</Text>}
    </View>
  );

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
        
        {/* Hero Section: Performance Score */}
        <View className="px-6 mb-8">
            <View className="p-6 rounded-3xl overflow-hidden relative" style={{ backgroundColor: colors.primary }}>
                <View className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/10 -mr-10 -mt-10" />
                <View className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-black/10 -ml-10 -mb-10" />
                
                <Text className="text-white/80 font-medium text-sm mb-1">Daily Performance Score</Text>
                <View className="flex-row items-end">
                    <Text className="text-6xl font-extrabold text-white mr-2">{consistency}</Text>
                    <Text className="text-xl text-white/80 font-bold mb-3">/ 100</Text>
                </View>
                <View className="mt-4 bg-black/20 h-1.5 rounded-full overflow-hidden w-full">
                    <View className="h-full bg-white rounded-full" style={{ width: `${consistency}%` }} />
                </View>
                <Text className="text-white/70 text-xs mt-3">
                    {consistency >= 80 ? "Outstanding! You're crushing it." : consistency >= 50 ? "Good job, keep the momentum." : "Let's get back on track!"}
                </Text>
            </View>
        </View>

        {/* Bento Grid Stats */}
        <View className="px-6 flex-row flex-wrap gap-3 mb-8">
            <StatCard 
                title="Current Streak" 
                value={streakData.currentStreak} 
                icon="flame" 
                color="#F97316" // Orange
                subtitle="Days in a row"
            />
            <StatCard 
                title="Total Habits" 
                value={streakData.totalCompleted} 
                icon="checkmark-circle" 
                color="#10B981" // Emerald
                subtitle="All time completions"
            />
            <StatCard 
                title="Perfect Days" 
                value={streakData.perfectDays} 
                icon="star" 
                color="#FACC15" // Yellow
                subtitle="100% completion"
            />
            <StatCard 
                title="Best Streak" 
                value={streakData.bestStreak} 
                icon="trophy" 
                color="#8B5CF6" // Violet
                subtitle="Personal record"
            />
        </View>

        {/* Weekly Trend Chart */}
        <View className="px-6 mb-8">
            <View className="p-5 rounded-3xl border" style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}>
                <View className="flex-row justify-between items-center mb-6">
                    <View>
                        <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>Weekly Trend</Text>
                        <Text className="text-xs" style={{ color: colors.textSecondary }}>Last 7 Days Activity</Text>
                    </View>
                    <Ionicons name="bar-chart" size={20} color={colors.primary} />
                </View>
                
                <View className="h-40 flex-row items-end justify-between px-2">
                    {weeklyData.map((day, index) => {
                        const count = day.completedIds.length;
                        const max = Math.max(...weeklyData.map(d => d.completedIds.length), 1); // Avoid div/0
                        const heightPct = (count / max) * 100;
                        const dayLabel = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }).charAt(0);
                        const isToday = index === 6;

                        return (
                            <View key={day.date} className="items-center w-8">
                                <View 
                                    className="w-full rounded-t-lg relative"
                                    style={{ 
                                        height: `${Math.max(heightPct, 4)}%`, 
                                        backgroundColor: isToday ? colors.primary : colors.surfaceTertiary,
                                        opacity: isToday ? 1 : 0.7
                                    }}
                                >
                                    {count > 0 && (
                                        <Text className="absolute -top-5 w-full text-center text-[10px] font-bold" style={{ color: colors.textSecondary }}>
                                            {count}
                                        </Text>
                                    )}
                                </View>
                                <Text className="text-xs mt-2 font-medium" style={{ color: isToday ? colors.primary : colors.textTertiary }}>
                                    {dayLabel}
                                </Text>
                            </View>
                        )
                    })}
                </View>
            </View>
        </View>

        {/* Heatmap Contribution Graph */}
        <View className="px-6 mb-8">
            <View className="p-5 rounded-3xl border" style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}>
                <View className="flex-row justify-between items-center mb-4">
                     <View>
                        <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>Activity Map</Text>
                        <Text className="text-xs" style={{ color: colors.textSecondary }}>Last 3 Months</Text>
                    </View>
                    <Ionicons name="grid" size={20} color={colors.textTertiary} />
                </View>
                
                <View className="flex-row flex-wrap gap-1 justify-between">
                    {heatmapData.map((day, i) => {
                        // Simple 3-level color scale
                        let bg = colors.surfaceTertiary;
                        if (day.count > 0) bg = colors.primary + '40'; // Low
                        if (day.count > 2) bg = colors.primary + '80'; // Med
                        if (day.count > 4) bg = colors.primary;        // High
                        
                        return (
                            <View 
                                key={day.date} 
                                style={{ 
                                    width: (width - 40 - 48) / 14, // Approx fit
                                    aspectRatio: 1, 
                                    backgroundColor: bg,
                                    borderRadius: 4
                                }} 
                            />
                        )
                    })}
                </View>
            </View>
        </View>

        {/* Life Areas Section (Existing but Styled) */}
        <View className="px-6 mb-8">
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

                {/* Goals */}
                {goals.length > 0 && (
                    <View className="mb-6">
                        <Text className="text-sm font-bold uppercase tracking-wider mb-3 opacity-70" style={{ color: colors.textSecondary }}>Active Goals</Text>
                        {goals.map(goal => (
                            <View 
                                key={goal.id} 
                                className="p-4 rounded-2xl mb-3 border bg-black/5"
                                style={{ borderColor: colors.border }}
                            >
                                <View className="flex-row justify-between items-center">
                                    <Text className="font-bold text-lg" style={{ color: colors.textPrimary }}>{goal.name}</Text>
                                    <Ionicons name="trophy" size={16} color={CATEGORY_CONFIG[selectedCategory].color} />
                                </View>
                                {goal.targetDate && (
                                    <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                                        Target: {new Date(goal.targetDate).toLocaleDateString()}
                                    </Text>
                                )}
                            </View>
                        ))}
                    </View>
                )}

                {/* Habits */}
                <View>
                    <Text className="text-sm font-bold uppercase tracking-wider mb-3 opacity-70" style={{ color: colors.textSecondary }}>Active Habits</Text>
                    {regularHabits.length > 0 ? (
                        regularHabits.map(habit => (
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
