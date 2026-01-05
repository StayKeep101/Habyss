import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, G } from 'react-native-svg';

interface HeroStatsProps {
  currentStreak: number;
  percentAboveBest: number;
  habitScore?: number;
  consistencyScore?: number;
  weeklyData: { day: string; completionRate: number }[];
}

export const HeroStats: React.FC<HeroStatsProps> = ({
  currentStreak,
  percentAboveBest,
  habitScore = 0,
  consistencyScore = 0,
  weeklyData,
}) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Circular Progress Logic
  const size = 80;
  const strokeWidth = 8;
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (habitScore / 100) * circumference;

  return (
    <View className="flex-row justify-between mb-6">
      {/* Streak Card */}
      <View
        className="flex-1 mr-2 p-4 rounded-3xl justify-between"
        style={{ backgroundColor: colors.surfaceSecondary }}
      >
        <View className="flex-row items-center mb-2">
          <Ionicons name="flame" size={20} color={colors.primary} />
          <Text className="text-xs font-bold ml-1 uppercase" style={{ color: colors.textSecondary }}>Streak</Text>
        </View>
        <View>
          <Text className="text-3xl font-bold" style={{ color: colors.textPrimary }}>{currentStreak}</Text>
          <Text className="text-xs font-medium" style={{ color: colors.textSecondary }}>Days</Text>
        </View>
        <View className="mt-2 flex-row items-center">
          <Text className="text-xs font-bold mr-1" style={{ color: colors.success }}>+{percentAboveBest}%</Text>
          <Text className="text-xs" style={{ color: colors.textSecondary }}>vs best</Text>
        </View>
      </View>

      {/* Goals Progress Card */}
      <View
        className="flex-1 mx-1 p-4 rounded-3xl justify-between items-center"
        style={{ backgroundColor: colors.surfaceSecondary }}
      >
        <Text className="text-xs font-bold uppercase self-start mb-2" style={{ color: colors.textSecondary }}>Goals</Text>
        <View style={{ width: size, height: size, position: 'relative', justifyContent: 'center', alignItems: 'center' }}>
          <Svg width={size} height={size}>
            <G rotation="-90" origin={`${center}, ${center}`}>
              <Circle
                stroke={colors.surfaceTertiary}
                cx={center}
                cy={center}
                r={radius}
                strokeWidth={strokeWidth}
              />
              <Circle
                stroke={colors.primary}
                cx={center}
                cy={center}
                r={radius}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </G>
          </Svg>
          <View className="absolute items-center justify-center">
            <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>{habitScore}%</Text>
          </View>
        </View>
      </View>

      {/* Completion Rate Card */}
      <View
        className="flex-1 ml-2 p-4 rounded-3xl justify-between"
        style={{ backgroundColor: colors.surfaceSecondary }}
      >
        <View className="flex-row items-center mb-2">
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text className="text-xs font-bold ml-1 uppercase" style={{ color: colors.textSecondary }}>Rate</Text>
        </View>
        <View>
          <Text className="text-3xl font-bold" style={{ color: colors.textPrimary }}>{consistencyScore}%</Text>
          <Text className="text-xs font-medium" style={{ color: colors.textSecondary }}>This Week</Text>
        </View>

        {/* Mini Bar Chart */}
        <View className="flex-row items-end h-8 mt-2 justify-between gap-1">
          {weeklyData.map((d, i) => (
            <View
              key={i}
              style={{
                height: `${d.completionRate}%`,
                backgroundColor: d.completionRate >= 100 ? colors.success : colors.primary,
                opacity: 0.8,
                borderRadius: 2
              }}
              className="flex-1"
            />
          ))}
        </View>
      </View>
    </View>
  );
};
