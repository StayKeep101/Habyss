import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export const CalendarStrip = () => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [selectedPeriod, setSelectedPeriod] = useState('Week');
  const [selectedDate, setSelectedDate] = useState(new Date().getDate());

  const periods = ['Day', 'Week', 'Month', 'Year'];
  
  // Generate current week dates
  const generateDates = () => {
    const dates = [];
    const today = new Date();
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

  return (
    <View className="pt-12 pb-4 px-4" style={{ backgroundColor: colors.background }}>
      {/* Date Strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10 }}>
        {dates.map((date, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => setSelectedDate(date.dayNumber)}
            className={`items-center justify-center w-16 h-24 mx-1.5 rounded-2xl ${
              selectedDate === date.dayNumber ? 'bg-purple-400' : 'bg-purple-50'
            }`}
          >
            <Text 
              className={`text-xs mb-2 font-bold uppercase tracking-wider ${selectedDate === date.dayNumber ? 'text-white' : 'text-gray-400'}`}
            >
              {date.dayName}
            </Text>
            <Text 
              className={`text-xl font-bold ${selectedDate === date.dayNumber ? 'text-white' : 'text-gray-800'}`}
            >
              {date.dayNumber}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};
