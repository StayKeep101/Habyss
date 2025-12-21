import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export const ActivityCards = () => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false} 
      contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 20 }}
    >
      {/* Card 1 - Meditate */}
      <View 
        className="w-72 p-5 rounded-3xl mr-4 relative overflow-hidden"
        style={{ backgroundColor: colors.accent }} // Light Green
      >
        <View className="flex-row justify-between items-start mb-4">
          <View className="w-10 h-10 rounded-full items-center justify-center bg-green-900">
             <Text style={{ fontSize: 20 }}>🧘‍♂️</Text>
          </View>
          <TouchableOpacity 
            className="px-3 py-1.5 rounded-full bg-green-900"
          >
            <Text className="text-xs font-medium text-white">Skip</Text>
          </TouchableOpacity>
        </View>

        <Text className="text-2xl font-bold mb-2 leading-tight" style={{ color: colors.textPrimary }}>
          Let's start meditate for{'\n'}5 minutes
        </Text>

        <Text className="text-sm mb-12 leading-5" style={{ color: colors.textSecondary }}>
          Spend just five minutes in mindfulness to relax your mind, reduce stress, and regain focus.
        </Text>

        {/* Floating Action Button for Card */}
         <TouchableOpacity 
            className="absolute bottom-4 self-center w-14 h-14 rounded-full items-center justify-center shadow-sm"
             style={{ backgroundColor: colors.primaryLight }}
          >
            <Ionicons name="add" size={28} color="#000" />
          </TouchableOpacity>
      </View>

      {/* Card 2 - Partial */}
      <View 
        className="w-72 p-5 rounded-3xl relative overflow-hidden"
        style={{ backgroundColor: '#0F2618' }} // Dark Green
      >
        <View className="flex-row justify-between items-start mb-4">
          <View className="w-10 h-10 rounded-full items-center justify-center bg-green-100">
             <Text style={{ fontSize: 20 }}>🏃</Text>
          </View>
           <TouchableOpacity 
            className="px-3 py-1.5 rounded-full bg-green-100/20"
          >
            <Text className="text-xs font-medium text-green-100">Skip</Text>
          </TouchableOpacity>
        </View>

        <Text className="text-2xl font-bold mb-2 leading-tight text-white">
          Morning Run{'\n'}5 km
        </Text>

        <Text className="text-sm mb-12 leading-5 text-gray-400">
          Start your day with energy...
        </Text>
      </View>
    </ScrollView>
  );
};
