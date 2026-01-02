import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Habit } from '@/lib/habits';
import { HalfCircleProgress } from '@/components/Common/HalfCircleProgress';

interface GoalCardProps {
  goal: Habit;
  progress: number;
  onPress: () => void;
}

import { VoidCard } from '@/components/Layout/VoidCard';

export const GoalCard: React.FC<GoalCardProps> = ({ goal, progress, onPress }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <VoidCard style={{ marginBottom: 16, padding: 20 }}>
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center flex-1">
            <View className="w-12 h-12 rounded-2xl items-center justify-center mr-4" style={{ backgroundColor: colors.surfaceTertiary }}>
              <Text className="text-2xl">{goal.icon || '🎯'}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold" style={{ color: colors.textPrimary }} numberOfLines={1}>{goal.name}</Text>
              <View className="flex-row items-center mt-1">
                <View className="px-2 py-0.5 rounded-full bg-green-500/10 mr-2">
                  <Text className="text-[10px] font-bold text-green-500 uppercase">On Track</Text>
                </View>
                <Text className="text-xs" style={{ color: colors.textSecondary }}>Target: {new Date(goal.targetDate || '').toLocaleDateString()}</Text>
              </View>
            </View>
          </View>

          <View className="w-16 h-16 items-center justify-center ml-2">
            <HalfCircleProgress
              progress={progress}
              size={60}
              strokeWidth={6}
              color={goal.color || colors.primary}
              backgroundColor={colors.surfaceTertiary}
              textColor={colors.textPrimary}
            />
          </View>
        </View>
      </VoidCard>
    </TouchableOpacity>
  );
};
