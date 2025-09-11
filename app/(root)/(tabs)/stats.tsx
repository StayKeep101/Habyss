import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';
import { getHabits, getLastNDaysCompletions } from '@/lib/habits';

const Stats = () => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { lightFeedback, mediumFeedback } = useHaptics();

  const [selectedPeriod, setSelectedPeriod] = useState('week');

  const periods = [
    { id: 'week', label: 'Week', icon: 'calendar' },
    { id: 'month', label: 'Month', icon: 'calendar-outline' },
    { id: 'year', label: 'Year', icon: 'calendar-clear' },
  ];

  const stats = [
    { title: 'Total Habits', value: '24', icon: 'list', color: colors.primary },
    { title: 'Completed Today', value: '18', icon: 'checkmark-circle', color: colors.success },
    { title: 'Current Streak', value: '12 days', icon: 'flame', color: colors.warning },
    { title: 'Focus Time', value: '6.5h', icon: 'timer', color: colors.secondary },
  ];

  const handlePeriodChange = (period: string) => {
    lightFeedback();
    setSelectedPeriod(period);
  };

  const handleExportData = () => {
    lightFeedback();
    Alert.alert(
      'Export Data',
      'Your data will be exported and sent to your email address. This includes all your habits, progress, and statistics.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Export', onPress: () => {
          Alert.alert('Export Started', 'Your data export has been initiated. You\'ll receive an email with your data within 24 hours.');
        }}
      ]
    );
  };

  const handleShareStats = () => {
    lightFeedback();
    Alert.alert(
      'Share Stats',
      'Share your progress with friends and family! You can share your achievements, streaks, and overall progress.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Share', onPress: () => {
          Alert.alert('Shared!', 'Your statistics have been shared successfully. Your friends can see your amazing progress!');
        }}
      ]
    );
  };

  const handleViewDetailedStats = () => {
    lightFeedback();
    Alert.alert(
      'Detailed Statistics',
      'Detailed analytics and insights coming soon! You\'ll be able to see trends, patterns, and detailed breakdowns of your progress.',
      [{ text: 'OK' }]
    );
  };

  const handleViewProgressCharts = () => {
    lightFeedback();
    Alert.alert(
      'Progress Charts',
      'Interactive charts and graphs coming soon! Visualize your progress with beautiful charts and analytics.',
      [{ text: 'OK' }]
    );
  };

  const [days, setDays] = useState<{ date: string; done: boolean }[]>([]);
  const [habitCount, setHabitCount] = useState(0);

  useEffect(() => {
    (async () => {
      const [hist, habits] = await Promise.all([
        getLastNDaysCompletions(30),
        getHabits(),
      ]);
      setHabitCount(habits.length);
      const mapped = hist.map(h => ({ date: h.date, done: h.completedIds.length > 0 }));
      setDays(mapped);
    })();
  }, []);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="px-6 pt-4 pb-6">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
            Statistics
          </Text>
          <View className="flex-row space-x-2">
            <TouchableOpacity 
              className="w-12 h-12 rounded-2xl items-center justify-center"
              style={{ backgroundColor: colors.surfaceSecondary }}
              onPress={handleExportData}
            >
              <Ionicons name="download" size={22} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity 
              className="w-12 h-12 rounded-2xl items-center justify-center"
              style={{ backgroundColor: colors.surfaceSecondary }}
              onPress={handleShareStats}
            >
              <Ionicons name="share" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        {/* Period Selector */}
        <View className="mb-6">
          <Text className="text-xl font-bold mb-4" style={{ color: colors.textPrimary }}>
            Time Period
          </Text>
          <View className="flex-row space-x-3">
            {periods.map((period) => (
              <TouchableOpacity
                key={period.id}
                className={`flex-1 p-4 rounded-2xl items-center ${
                  selectedPeriod === period.id ? 'border-2' : ''
                }`}
                style={{
                  backgroundColor: selectedPeriod === period.id 
                    ? colors.primary + '20' 
                    : colors.surfaceSecondary,
                  borderColor: selectedPeriod === period.id ? colors.primary : 'transparent'
                }}
                onPress={() => handlePeriodChange(period.id)}
              >
                <Ionicons 
                  name={period.icon as any} 
                  size={24} 
                  color={selectedPeriod === period.id ? colors.primary : colors.textSecondary} 
                />
                <Text 
                  className="text-sm font-bold mt-2"
                  style={{ 
                    color: selectedPeriod === period.id ? colors.primary : colors.textSecondary 
                  }}
                >
                  {period.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Stats Grid */}
        <View className="mb-6">
          <Text className="text-xl font-bold mb-4" style={{ color: colors.textPrimary }}>
            Overview
          </Text>
          <View className="flex-row flex-wrap justify-between">
            {stats.map((stat, index) => (
              <View
                key={index}
                className="w-[48%] p-5 rounded-2xl mb-4"
                style={{ backgroundColor: colors.surfaceSecondary }}
              >
                <View className="flex-row items-center mb-3">
                  <View 
                    className="w-12 h-12 rounded-2xl items-center justify-center mr-3"
                    style={{ backgroundColor: stat.color + '20' }}
                  >
                    <Ionicons name={stat.icon as any} size={24} color={stat.color} />
                  </View>
                  <Text className="text-sm font-medium" style={{ color: colors.textSecondary }}>
                    {stat.title}
                  </Text>
                </View>
                <Text className="text-3xl font-bold" style={{ color: colors.textPrimary }}>
                  {stat.value}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Per-day Habit Completion Heatmap */}
        <View className="mb-6">
          <Text className="text-xl font-bold mb-4" style={{ color: colors.textPrimary }}>
            Last 30 Days
          </Text>
          <View
            className="p-4 rounded-2xl"
            style={{ backgroundColor: colors.surfaceSecondary }}
          >
            <View className="flex-row flex-wrap" style={{ rowGap: 8 }}>
              {days.map((d, idx) => (
                <View key={d.date} className="items-center" style={{ width: `${100/7}%` }}>
                  <View
                    className="w-8 h-8 rounded-md"
                    style={{ backgroundColor: d.done ? colors.success : colors.surfaceTertiary }}
                  />
                  {idx >= 23 && (
                    <Text className="text-[10px] mt-1" style={{ color: colors.textTertiary }}>
                      {new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Text>
                  )}
                </View>
              ))}
            </View>
            <View className="flex-row justify-end mt-3 items-center">
              <Text className="text-xs mr-2" style={{ color: colors.textSecondary }}>
                Completion
              </Text>
              <View className="w-4 h-4 rounded-sm mr-1" style={{ backgroundColor: colors.surfaceTertiary }} />
              <Text className="text-[10px] mr-2" style={{ color: colors.textTertiary }}>Missed</Text>
              <View className="w-4 h-4 rounded-sm mr-1" style={{ backgroundColor: colors.success }} />
              <Text className="text-[10px]" style={{ color: colors.textTertiary }}>Done</Text>
            </View>
          </View>
        </View>

        {/* Top Habits */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-xl font-bold" style={{ color: colors.textPrimary }}>
              Top Performing Habits
            </Text>
            <TouchableOpacity onPress={handleViewDetailedStats}>
              <Text className="text-sm font-medium" style={{ color: colors.primary }}>
                View All
              </Text>
            </TouchableOpacity>
          </View>
          <View 
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: colors.surfaceSecondary }}
          >
            {[
              { name: 'Morning Exercise', completion: 95, streak: 12 },
              { name: 'Read 30 min', completion: 87, streak: 8 },
              { name: 'Drink Water', completion: 92, streak: 15 },
              { name: 'Meditate', completion: 78, streak: 6 },
            ].map((habit, index) => (
              <View key={index}>
                <TouchableOpacity 
                  className="flex-row items-center p-4"
                  onPress={() => {
                    lightFeedback();
                    Alert.alert(
                      `${habit.name} Details`,
                      `Completion Rate: ${habit.completion}%\nCurrent Streak: ${habit.streak} days\n\nDetailed analytics coming soon!`,
                      [{ text: 'OK' }]
                    );
                  }}
                >
                  <View className="w-12 h-12 rounded-2xl items-center justify-center mr-4"
                        style={{ backgroundColor: colors.primary + '20' }}>
                    <Text className="text-base font-bold" style={{ color: colors.primary }}>
                      {index + 1}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-base" style={{ color: colors.textPrimary }}>
                      {habit.name}
                    </Text>
                    <Text className="text-sm" style={{ color: colors.textSecondary }}>
                      {habit.streak} day streak
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-2xl font-bold" style={{ color: colors.success }}>
                      {habit.completion}%
                    </Text>
                    <Text className="text-xs" style={{ color: colors.textSecondary }}>
                      Completion
                    </Text>
                  </View>
                </TouchableOpacity>
                {index < 3 && (
                  <View 
                    className="h-[0.5px] mx-4"
                    style={{ backgroundColor: colors.border }}
                  />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Insights */}
        <View className="mb-6">
          <Text className="text-xl font-bold mb-4" style={{ color: colors.textPrimary }}>
            Insights
          </Text>
          <View 
            className="p-5 rounded-2xl"
            style={{ backgroundColor: colors.success + '20' }}
          >
            <View className="flex-row items-center mb-3">
              <Ionicons name="trending-up" size={24} color={colors.success} />
              <Text className="ml-3 text-lg font-bold" style={{ color: colors.success }}>
                Great Progress!
              </Text>
            </View>
            <Text className="text-base" style={{ color: colors.textSecondary }}>
              You've improved your productivity by 23% this week compared to last week. 
              Keep up the excellent work!
            </Text>
          </View>
        </View>

        {/* Bottom Spacing */}
        <View className="h-20" />
      </ScrollView>
    </SafeAreaView>
  );
};

export default Stats;
