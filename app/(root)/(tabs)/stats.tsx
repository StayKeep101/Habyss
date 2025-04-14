import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LineChart, BarChart } from "react-native-chart-kit";

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

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-4 py-3 border-b border-gray-200">
        <Text className="text-2xl font-bold text-gray-900">Statistics</Text>
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

        {/* Quick Stats Grid */}
        <View className="px-4 py-2">
          <View className="flex-row space-x-4 mb-4">
            <View className="flex-1">
              <StatCard
                title="Focus Time"
                value="5.2h"
                icon="timer-outline"
                trend={12}
              />
            </View>
            <View className="flex-1">
              <StatCard
                title="Productivity"
                value="87%"
                icon="trending-up"
                trend={5}
              />
            </View>
          </View>
          <View className="flex-row space-x-4">
            <View className="flex-1">
              <StatCard
                title="Streak"
                value="12 days"
                icon="flame-outline"
                trend={8}
              />
            </View>
            <View className="flex-1">
              <StatCard
                title="Tasks Done"
                value="24"
                icon="checkmark-circle-outline"
                trend={-3}
              />
            </View>
          </View>
        </View>

        {/* Progress Chart */}
        <View className="mt-4 bg-white p-4 rounded-t-xl">
          <Text className="text-lg font-semibold text-gray-800 mb-4">Progress Overview</Text>
          <LineChart
            data={weeklyData}
            width={screenWidth - 32}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={{
              marginVertical: 8,
              borderRadius: 16,
            }}
          />
        </View>

        {/* Monthly Performance */}
        <View className="mt-4 bg-white p-4">
          <Text className="text-lg font-semibold text-gray-800 mb-4">Monthly Performance</Text>
          <BarChart
            data={monthlyData}
            width={screenWidth - 32}
            height={220}
            yAxisLabel=""
            yAxisSuffix=""
            chartConfig={chartConfig}
            style={{
              marginVertical: 8,
              borderRadius: 16,
            }}
          />
        </View>

        {/* Achievements */}
        <View className="mt-4 bg-white p-4 rounded-xl mx-4 mb-6">
          <Text className="text-lg font-semibold text-gray-800 mb-3">Recent Achievements</Text>
          <View className="flex-row items-center py-3 border-b border-gray-100">
            <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center mr-4">
              <Ionicons name="trophy" size={24} color="#2563EB" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-800 font-medium">7-Day Streak</Text>
              <Text className="text-gray-500 text-sm">Completed all daily goals</Text>
            </View>
            <Text className="text-blue-500">+50 pts</Text>
          </View>
          <View className="flex-row items-center py-3">
            <View className="w-12 h-12 bg-green-100 rounded-full items-center justify-center mr-4">
              <Ionicons name="star" size={24} color="#10B981" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-800 font-medium">Productivity Master</Text>
              <Text className="text-gray-500 text-sm">85%+ productivity for 5 days</Text>
            </View>
            <Text className="text-blue-500">+100 pts</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Stats;
