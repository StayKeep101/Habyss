import React from 'react';
import { View, Text } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Habit } from './Dashboard.types';

interface HabitHeatmapProps {
  habits: Habit[];
  // In a real app, we'd pass a matrix of completion status
}

export const HabitHeatmap: React.FC<HabitHeatmapProps> = ({ habits }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  // Mock last 7 days
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <View className="mb-8 p-5 rounded-3xl" style={{ backgroundColor: colors.surfaceSecondary }}>
      <Text className="text-lg font-bold mb-4" style={{ color: colors.textPrimary }}>Weekly Performance</Text>
      
      {/* Header Row */}
      <View className="flex-row mb-2">
        <View className="flex-1" />
        {days.map((day, i) => (
             <View key={i} className="w-8 items-center">
                <Text className="text-xs font-bold" style={{ color: colors.textSecondary }}>{day}</Text>
             </View>
        ))}
      </View>

      {/* Habit Rows */}
      {habits.slice(0, 5).map((habit, index) => (
        <View key={habit.id} className="flex-row items-center mb-3">
            <View className="flex-1 mr-2">
                <Text numberOfLines={1} className="text-sm font-medium" style={{ color: colors.textPrimary }}>{habit.icon} {habit.title}</Text>
            </View>
            {days.map((_, dayIndex) => {
                // Mock random completion for visualization
                // In production, this would use actual data
                const isCompleted = Math.random() > 0.3; 
                const opacity = isCompleted ? 1 : 0.1;
                
                return (
                    <View key={dayIndex} className="w-8 items-center">
                        <View 
                            className="w-6 h-6 rounded-md" 
                            style={{ 
                                backgroundColor: habit.color, 
                                opacity 
                            }} 
                        />
                    </View>
                );
            })}
        </View>
      ))}
    </View>
  );
};
