import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface CalendarStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

export const CalendarStrip: React.FC<CalendarStripProps> = ({ selectedDate, onSelectDate }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  // Generate current week dates
  const generateDates = () => {
    const dates = [];
    const today = new Date();
    // Generate a range of dates centered around today, or maybe just this week
    // Let's keep the existing logic of +/- 3 days from today for now
    for (let i = -3; i <= 3; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push({
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: d.getDate(),
        isToday: i === 0,
        fullDate: d
      });
    }
    return dates;
  };

  const dates = generateDates();

  const isSelected = (d1: Date, d2: Date) => {
    return d1.getDate() === d2.getDate() && 
           d1.getMonth() === d2.getMonth() && 
           d1.getFullYear() === d2.getFullYear();
  };

  return (
    <View className="pt-12 pb-4 px-4" style={{ backgroundColor: colors.background }}>
      {/* Date Strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10 }}>
        {dates.map((date, index) => {
           const selected = isSelected(selectedDate, date.fullDate);
           return (
          <TouchableOpacity
            key={index}
            onPress={() => onSelectDate(date.fullDate)}
            className="items-center justify-center w-16 h-24 mx-1.5 rounded-2xl"
            style={{ 
              backgroundColor: selected ? '#9CB1D6' : colors.surfaceSecondary 
            }}
          >
            <Text 
              className="text-xs mb-2 font-bold uppercase tracking-wider"
              style={{ color: selected ? colors.textPrimary : colors.textTertiary }}
            >
              {date.dayName}
            </Text>
            <Text 
              className="text-xl font-bold"
              style={{ color: selected ? colors.textPrimary : colors.textPrimary }}
            >
              {date.dayNumber}
            </Text>
          </TouchableOpacity>
        )})}
      </ScrollView>
    </View>
  );
};
