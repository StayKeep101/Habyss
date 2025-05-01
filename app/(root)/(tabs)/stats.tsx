import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LineChart, BarChart } from "react-native-chart-kit";
import { useColorScheme } from '@/hooks/useColorScheme';

const screenWidth = Dimensions.get("window").width;

interface ChartData {
  labels: string[];
  datasets: {
    data: number[];
    color?: (opacity: number) => string;
    strokeWidth?: number;
  }[];
}

const weeklyData: ChartData = {
  labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  datasets: [
    {
      data: [65, 85, 72, 78, 93, 88, 82],
      color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
      strokeWidth: 2,
    },
  ],
};

const monthlyData: ChartData = {
  labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
  datasets: [
    {
      data: [78, 82, 85, 90],
      color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
    },
  ],
};

interface TimeframeButtonProps {
  title: string;
  active: boolean;
  onPress: () => void;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  trend: number;
}

const Stats = () => {
  const [timeframe, setTimeframe] = useState<"daily" | "weekly" | "monthly">("weekly");
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Theme colors
  const theme = {
    background: isDark ? 'bg-slate-900' : 'bg-slate-50',
    surface: isDark ? 'bg-slate-800' : 'bg-white',
    surfaceSecondary: isDark ? 'bg-slate-700' : 'bg-slate-100',
    textPrimary: isDark ? 'text-slate-50' : 'text-slate-900',
    textSecondary: isDark ? 'text-slate-400' : 'text-slate-600',
    accent: isDark ? 'bg-indigo-500' : 'bg-indigo-600',
    accentLight: isDark ? 'bg-indigo-400' : 'bg-indigo-100',
    success: isDark ? 'bg-emerald-500' : 'bg-emerald-400',
    successLight: isDark ? 'bg-emerald-400' : 'bg-emerald-100',
    border: isDark ? 'border-slate-700' : 'border-slate-200',
  };

  const chartConfig = {
    backgroundColor: "#ffffff",
    backgroundGradientFrom: "#ffffff",
    backgroundGradientTo: "#ffffff",
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(55, 65, 81, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: "6",
      strokeWidth: "2",
      stroke: "#2563EB",
    },
  };

  const TimeframeButton: React.FC<TimeframeButtonProps> = ({ title, active, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      className={`px-4 py-2 rounded-full ${
        active ? "bg-blue-500" : "bg-gray-200"
      }`}
    >
      <Text
        className={`text-sm font-medium ${
          active ? "text-white" : "text-gray-600"
        }`}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );

  const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend }) => (
    <View className="bg-white p-4 rounded-xl shadow-sm">
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-gray-600 font-medium">{title}</Text>
        <Ionicons name={icon} size={24} color="#2563EB" />
      </View>
      <Text className="text-2xl font-bold text-gray-900">{value}</Text>
      <View className="flex-row items-center mt-2">
        <Ionicons
          name={trend > 0 ? "trending-up" : "trending-down"}
          size={20}
          color={trend > 0 ? "#10B981" : "#EF4444"}
        />
        <Text
          className={`ml-1 ${
            trend > 0 ? "text-green-600" : "text-red-500"
          }`}
        >
          {Math.abs(trend)}% from last week
        </Text>
      </View>
    </View>
  );

  // Mock data for stats
  const stats = {
    streak: 7,
    completionRate: 85,
    totalHabits: 12,
    activeHabits: 8,
    focusTime: 120,
    waterIntake: 2.5,
  };

  return (
    <SafeAreaView className={`flex-1 ${theme.background}`}>
      {/* Header */}
      <View className={`p-5 ${theme.surface} border-b ${theme.border}`}>
        <Text className={`text-2xl font-bold ${theme.textPrimary}`}>
          Statistics
        </Text>
        <Text className={`text-sm mt-1 ${theme.textSecondary}`}>
          Your progress overview
        </Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Time Period Selector */}
        <View className="flex-row justify-between px-4 py-4">
          <TimeframeButton
            title="Daily"
            active={timeframe === "daily"}
            onPress={() => setTimeframe("daily")}
          />
          <TimeframeButton
            title="Weekly"
            active={timeframe === "weekly"}
            onPress={() => setTimeframe("weekly")}
          />
          <TimeframeButton
            title="Monthly"
            active={timeframe === "monthly"}
            onPress={() => setTimeframe("monthly")}
          />
        </View>

        {/* Quick Stats */}
        <View className="p-5">
          <View className="flex-row flex-wrap justify-between">
            <View className={`w-[48%] p-4 rounded-xl mb-4 ${theme.surface} border ${theme.border}`}>
              <View className="flex-row items-center mb-2">
                <View className={`w-8 h-8 rounded-full ${theme.accentLight} justify-center items-center`}>
                  <Ionicons name="flame" size={16} color={isDark ? '#818cf8' : '#4f46e5'} />
                </View>
                <Text className={`ml-2 text-sm font-medium ${theme.textPrimary}`}>
                  Current Streak
                </Text>
              </View>
              <Text className={`text-2xl font-bold ${theme.textPrimary}`}>
                {stats.streak} days
              </Text>
            </View>
            <View className={`w-[48%] p-4 rounded-xl mb-4 ${theme.surface} border ${theme.border}`}>
              <View className="flex-row items-center mb-2">
                <View className={`w-8 h-8 rounded-full ${theme.successLight} justify-center items-center`}>
                  <Ionicons name="checkmark-circle" size={16} color={isDark ? '#34d399' : '#059669'} />
                </View>
                <Text className={`ml-2 text-sm font-medium ${theme.textPrimary}`}>
                  Completion Rate
                </Text>
              </View>
              <Text className={`text-2xl font-bold ${theme.textPrimary}`}>
                {stats.completionRate}%
              </Text>
            </View>
          </View>
        </View>

        {/* Detailed Stats */}
        <View className="p-5">
          <Text className={`text-lg font-bold mb-4 ${theme.textPrimary}`}>
            Detailed Stats
          </Text>
          <View className="gap-3">
            <StatItem
              icon="list"
              title="Total Habits"
              value={stats.totalHabits}
              theme={theme}
            />
            <StatItem
              icon="checkmark-circle"
              title="Active Habits"
              value={stats.activeHabits}
              theme={theme}
            />
            <StatItem
              icon="timer"
              title="Focus Time"
              value={`${stats.focusTime} min`}
              theme={theme}
            />
            <StatItem
              icon="water"
              title="Water Intake"
              value={`${stats.waterIntake}L`}
              theme={theme}
            />
          </View>
        </View>

        {/* Progress Chart */}
        <View className="p-5">
          <Text className={`text-lg font-bold mb-4 ${theme.textPrimary}`}>
            Weekly Progress
          </Text>
          <View className={`p-4 rounded-xl ${theme.surface} border ${theme.border}`}>
            <View className="h-40 justify-center items-center">
              <Text className={`text-sm ${theme.textSecondary}`}>
                Chart will be displayed here
              </Text>
            </View>
          </View>
        </View>

        {/* Achievements */}
        <View className="p-5">
          <Text className={`text-lg font-bold mb-4 ${theme.textPrimary}`}>
            Recent Achievements
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[1, 2, 3].map((item) => (
              <View
                key={item}
                className={`w-40 p-4 rounded-xl mr-4 ${theme.surface} border ${theme.border}`}
              >
                <View className={`w-12 h-12 rounded-full ${theme.accent} justify-center items-center mb-3`}>
                  <Ionicons name="trophy" size={24} color="#fff" />
                </View>
                <Text className={`text-sm font-bold ${theme.textPrimary}`}>
                  Achievement {item}
                </Text>
                <Text className={`text-xs mt-1 ${theme.textSecondary}`}>
                  Earned 2 days ago
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

function StatItem({ icon, title, value, theme }: { icon: keyof typeof Ionicons.glyphMap; title: string; value: string | number; theme: any }) {
  return (
    <View className={`flex-row items-center p-4 rounded-xl ${theme.surface} border ${theme.border}`}>
      <View className={`w-10 h-10 rounded-full ${theme.surfaceSecondary} justify-center items-center`}>
        <Ionicons
          name={icon}
          size={20}
          color={theme.textSecondary.replace('text-', '')}
        />
      </View>
      <View className="flex-1 ml-4">
        <Text className={`text-sm font-medium ${theme.textPrimary}`}>{title}</Text>
        <Text className={`text-base font-bold ${theme.textPrimary}`}>{value}</Text>
      </View>
    </View>
  );
}

export default Stats;
