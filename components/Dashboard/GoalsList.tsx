import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Goal } from './Dashboard.types';
import { Ionicons } from '@expo/vector-icons';

interface GoalsListProps {
  goals: Goal[];
}

export const GoalsList: React.FC<GoalsListProps> = ({ goals }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View className="mb-8">
      <View className="flex-row justify-between items-center mb-4 px-1">
        <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>Active Goals</Text>
        <TouchableOpacity>
            <Text className="text-sm font-semibold" style={{ color: colors.primary }}>See All</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
        {goals.map((goal) => (
          <View 
            key={goal.id} 
            className="w-72 p-5 rounded-3xl mr-4 border"
            style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}
          >
            {/* Header */}
            <View className="flex-row justify-between items-start mb-4">
                <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.surfaceTertiary }}>
                        <Text className="text-lg">{goal.icon}</Text>
                    </View>
                    <View>
                        <Text className="font-bold text-base" style={{ color: colors.textPrimary }}>{goal.title}</Text>
                        <Text className="text-xs" style={{ color: colors.textSecondary }}>Target: {new Date(goal.targetDate).toLocaleDateString()}</Text>
                    </View>
                </View>
                <View className={`px-2 py-1 rounded-full ${goal.status === 'on_track' ? 'bg-green-500/20' : goal.status === 'ahead' ? 'bg-blue-500/20' : 'bg-red-500/20'}`}>
                    <Text className={`text-xs font-bold ${goal.status === 'on_track' ? 'text-green-500' : goal.status === 'ahead' ? 'text-blue-500' : 'text-red-500'}`}>
                        {goal.status === 'on_track' ? 'On Track' : goal.status === 'ahead' ? 'Ahead' : 'Behind'}
                    </Text>
                </View>
            </View>

            {/* Progress Bar */}
            <View className="mb-4">
                <View className="flex-row justify-between mb-1">
                    <Text className="text-xs font-medium" style={{ color: colors.textSecondary }}>Progress</Text>
                    <Text className="text-xs font-bold" style={{ color: colors.textPrimary }}>{goal.progress}%</Text>
                </View>
                <View className="h-2 rounded-full w-full overflow-hidden" style={{ backgroundColor: colors.surfaceTertiary }}>
                    <View style={{ width: `${goal.progress}%`, backgroundColor: colors.primary }} className="h-full rounded-full" />
                </View>
            </View>

            {/* Contributing Habits */}
            <View>
                <Text className="text-xs font-bold uppercase mb-2" style={{ color: colors.textSecondary }}>Habits</Text>
                {goal.habits.slice(0, 3).map((habit) => (
                    <View key={habit.id} className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center">
                             <View className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: habit.color }} />
                             <Text className="text-sm" style={{ color: colors.textPrimary }}>{habit.title}</Text>
                        </View>
                        <View className="flex-row items-center">
                            <Ionicons name="flame" size={12} color={colors.warning} />
                            <Text className="text-xs ml-1" style={{ color: colors.textSecondary }}>{habit.streak}</Text>
                        </View>
                    </View>
                ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};
