import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { 
  getHabits as loadHabits, 
  getCompletions, 
  getWeeklyCompletionData,
  getMonthlyCompletionData,
  getYearlyCompletionData,
  getHabitCompletionByCategory
} from '@/lib/habits';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LineChartComponent, BarChartComponent, PieChartComponent, ProgressRing } from '@/components/ui/chart';
import { cn } from '@/lib/utils';

const { width } = Dimensions.get('window');

type TimePeriod = 'week' | 'month' | 'year';

const Stats = () => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  
  const [habits, setHabits] = useState<any[]>([]);
  const [completions, setCompletions] = useState<Record<string, boolean>>({});
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [yearlyData, setYearlyData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('week');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [h, c, weekly, monthly, yearly, category] = await Promise.all([
        loadHabits(),
        getCompletions(),
        getWeeklyCompletionData(),
        getMonthlyCompletionData(),
        getYearlyCompletionData(),
        getHabitCompletionByCategory()
      ]);
      
      setHabits(h);
      setCompletions(c);
      setWeeklyData(weekly);
      setMonthlyData(monthly);
      setYearlyData(yearly);
      setCategoryData(category);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const totalHabits = habits.length;
  const completedToday = Object.values(completions).filter(Boolean).length;
  const completionRate = totalHabits > 0 ? (completedToday / totalHabits) * 100 : 0;

  const getCurrentData = () => {
    switch (selectedPeriod) {
      case 'week':
        return weeklyData;
      case 'month':
        return monthlyData;
      case 'year':
        return yearlyData;
      default:
        return weeklyData;
    }
  };

  const formatChartData = () => {
    const data = getCurrentData();
    if (data.length === 0) return { labels: [], datasets: [{ data: [] }] };

    const labels = data.map(item => {
      if (selectedPeriod === 'year') {
        return item.month;
      } else {
        const date = new Date(item.date);
        return selectedPeriod === 'week' 
          ? date.toLocaleDateString('en-US', { weekday: 'short' })
          : date.getDate().toString();
      }
    });

    const completionRates = data.map(item => Math.round(item.completionRate));

    return {
      labels,
      datasets: [{
        data: completionRates,
        color: (opacity = 1) => `rgba(126, 160, 216, ${opacity})`,
        strokeWidth: 3,
      }]
    };
  };

  const getAverageCompletionRate = () => {
    const data = getCurrentData();
    if (data.length === 0) return 0;
    const total = data.reduce((sum, item) => sum + item.completionRate, 0);
    return total / data.length;
  };

  const getTotalCompletions = () => {
    const data = getCurrentData();
    return data.reduce((sum, item) => sum + item.completedHabits, 0);
  };

  const formatPieData = () => {
    return categoryData.map((item, index) => ({
      name: item.category,
      population: item.completionRate,
      color: ['#7EA0D8', '#4A70B8', '#3B82F6', '#60A5FA'][index % 4],
      legendFontColor: colors.textSecondary,
      legendFontSize: 12,
    }));
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
        <View className="flex-1 justify-center items-center">
          <View className="w-16 h-16 rounded-full items-center justify-center mb-4" style={{ backgroundColor: colors.primary }}>
            <Ionicons name="stats-chart" size={32} color="white" />
          </View>
          <Text className="text-lg font-semibold" style={{ color: colors.textPrimary }}>Loading stats...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View className="px-6 pt-6">
          {/* Header */}
          <View className="mb-6">
            <Text className="text-3xl font-bold mb-2" style={{ color: colors.textPrimary }}>
              Statistics
            </Text>
            <Text className="text-base" style={{ color: colors.textSecondary }}>
              Track your progress and achievements
            </Text>
          </View>

          {/* Time Period Selector */}
          <View className="mb-6">
            <Card className="rounded-2xl">
              <CardContent className="p-4">
                <View className="flex-row space-x-2">
                  {(['week', 'month', 'year'] as TimePeriod[]).map((period) => (
                    <Button
                      key={period}
                      label={period.charAt(0).toUpperCase() + period.slice(1)}
                      variant={selectedPeriod === period ? "default" : "outline"}
                      size="sm"
                      onPress={() => setSelectedPeriod(period)}
                      className="flex-1"
                    />
                  ))}
                </View>
              </CardContent>
            </Card>
          </View>

          {/* Today's Overview */}
          <View className="mb-6">
            <Card className="rounded-3xl">
              <CardHeader>
                <CardTitle className="flex-row items-center justify-between">
                  <Text style={{ color: colors.textPrimary }}>Today's Progress</Text>
                  <Badge variant="outline" className="rounded-full">
                    <Ionicons name="today" size={16} color={colors.primary} />
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <View className="flex-row items-center justify-between">
                  <ProgressRing
                    progress={completionRate}
                    size={100}
                    strokeWidth={8}
                    title={`${completedToday}/${totalHabits}`}
                    subtitle="habits completed"
                  />
                  <View className="space-y-2">
                    <View className="items-end">
                      <Text className="text-2xl font-bold" style={{ color: colors.primary }}>
                        {Math.round(completionRate)}%
                      </Text>
                      <Text className="text-sm" style={{ color: colors.textSecondary }}>
                        completion rate
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                        {getTotalCompletions()}
                      </Text>
                      <Text className="text-sm" style={{ color: colors.textSecondary }}>
                        total completions
                      </Text>
                    </View>
                  </View>
                </View>
              </CardContent>
            </Card>
          </View>

          {/* Completion Trend Chart */}
          <View className="mb-6">
            <LineChartComponent
              data={formatChartData()}
              title={`${selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)}ly Trend`}
              subtitle={`Average: ${Math.round(getAverageCompletionRate())}% completion rate`}
              height={250}
            />
          </View>

          {/* Category Breakdown */}
          {categoryData.length > 0 && (
            <View className="mb-6">
              <PieChartComponent
                data={formatPieData()}
                title="Completion by Category"
                subtitle="Today's progress breakdown"
              />
            </View>
          )}

          {/* Habit Details */}
          <View className="mb-6">
            <Card className="rounded-3xl">
              <CardHeader>
                <CardTitle>Habit Details</CardTitle>
              </CardHeader>
              <CardContent>
                <View className="space-y-3">
                  {habits.map((habit) => {
                    const isCompleted = completions[habit.id];
                    return (
                      <View
                        key={habit.id}
                        className="flex-row items-center p-4 rounded-2xl"
                        style={{ backgroundColor: colors.surfaceSecondary }}
                      >
                        <View 
                          className="w-12 h-12 rounded-2xl items-center justify-center mr-4"
                          style={{ backgroundColor: colors.primary + '20' }}
                        >
                          <Ionicons name={habit.icon || 'star'} size={24} color={colors.primary} />
                        </View>
                        <View className="flex-1">
                          <Text className="font-bold text-base" style={{ color: colors.textPrimary }}>
                            {habit.name}
                          </Text>
                          <Text className="text-sm" style={{ color: colors.textSecondary }}>
                            {habit.category.charAt(0).toUpperCase() + habit.category.slice(1)}
                          </Text>
                        </View>
                        <View 
                          className="w-10 h-10 rounded-2xl items-center justify-center"
                          style={{ backgroundColor: isCompleted ? colors.success : colors.surfaceTertiary }}
                        >
                          <Ionicons 
                            name={isCompleted ? "checkmark" : "time"} 
                            size={20} 
                            color={isCompleted ? "white" : colors.textTertiary} 
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </CardContent>
            </Card>
          </View>

          {/* Quick Stats */}
          <View className="mb-6">
            <Card className="rounded-3xl">
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <View className="flex-row justify-between">
                  <View className="items-center">
                    <Text className="text-2xl font-bold" style={{ color: colors.primary }}>
                      {totalHabits}
                    </Text>
                    <Text className="text-sm" style={{ color: colors.textSecondary }}>
                      Total Habits
                    </Text>
                  </View>
                  <View className="items-center">
                    <Text className="text-2xl font-bold" style={{ color: colors.primary }}>
                      {completedToday}
                    </Text>
                    <Text className="text-sm" style={{ color: colors.textSecondary }}>
                      Completed Today
                    </Text>
                  </View>
                  <View className="items-center">
                    <Text className="text-2xl font-bold" style={{ color: colors.primary }}>
                      {Math.round(getAverageCompletionRate())}%
                    </Text>
                    <Text className="text-sm" style={{ color: colors.textSecondary }}>
                      Avg. Rate
                    </Text>
                  </View>
                </View>
              </CardContent>
            </Card>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Stats;