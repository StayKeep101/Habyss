import React, { useRef, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Habit } from '@/lib/habits';

const { width } = Dimensions.get('window');

interface RoadmapViewProps {
  onDayPress: (day: any) => void;
  habits: Habit[];
  completedHabitsCount: number;
  totalHabitsCount: number;
}

export const RoadmapView: React.FC<RoadmapViewProps> = ({ 
  onDayPress, 
  habits, 
  completedHabitsCount, 
  totalHabitsCount 
}) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const scrollY = useRef(new Animated.Value(0)).current;

  // Generate days (30 days future, today, 30 days past)
  // Logic adapted from previous implementation
  const generateDays = () => {
    const days = [];
    const today = new Date();
    
    // Future days (upcoming days above)
    for (let i = 14; i >= 1; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      days.push({
        day: -i,
        date,
        completed: false,
        isToday: false,
        isPast: false,
      });
    }
    
    // Today
    days.push({
      day: 0,
      date: today,
      completed: completedHabitsCount > 0 && completedHabitsCount === totalHabitsCount,
      isToday: true,
      isPast: false,
    });
    
    // Past days
    for (let i = 1; i <= 14; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        days.push({
          day: i,
          date,
          completed: Math.random() > 0.5, // Mock data for now
          isToday: false,
          isPast: true,
        });
    }
    
    return days;
  };

  const days = generateDays();

  const formatDate = (date: Date) => {
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Today';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderDayNode = (day: any, index: number) => {
    const isRightSide = index % 2 === 1;
    
    let nodeColor = colors.surfaceSecondary;
    let iconName = 'ellipse-outline';
    let iconColor = colors.textSecondary;
    let nodeSize = 60;
    
    if (day.isToday) {
      nodeColor = colors.primary;
      iconName = 'today';
      iconColor = 'white';
      nodeSize = 70;
    } else if (day.completed) {
      nodeColor = colors.success;
      iconName = 'checkmark-circle';
      iconColor = 'white';
    }
    
    return (
      <View key={index} className="mb-8 relative">
        <View style={{ 
          alignItems: 'center',
          marginLeft: isRightSide ? width * 0.4 : width * 0.1,
          marginRight: isRightSide ? width * 0.1 : width * 0.4,
        }}>
          <TouchableOpacity
            className="items-center justify-center"
            style={{ 
              width: nodeSize,
              height: nodeSize,
              backgroundColor: nodeColor,
              borderRadius: 20,
              shadowColor: colors.primaryDark,
              shadowOpacity: 0.2,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
              borderWidth: day.isToday ? 2 : 1,
              borderColor: day.isToday ? 'white' : 'transparent',
            }}
            onPress={() => onDayPress(day)}
          >
            <Ionicons name={iconName as any} size={24} color={iconColor} />
          </TouchableOpacity>
          <Text className="text-xs mt-2 font-medium" style={{ color: colors.textSecondary }}>
            {formatDate(day.date)}
          </Text>
        </View>
        
        {/* Connector Line Logic would go here */}
      </View>
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingVertical: 100, paddingBottom: 400 }} // Extra padding at bottom for modal
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center mb-8">
            <Text className="text-xl font-bold" style={{ color: colors.textPrimary }}>Your Journey</Text>
        </View>
        {days.map((day, index) => renderDayNode(day, index))}
      </ScrollView>
    </View>
  );
};
