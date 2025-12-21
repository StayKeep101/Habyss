import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ProgressWidget } from './ProgressWidget';
import { ActivityCards } from './ActivityCards';
import { router } from 'expo-router';
import { HealthData, KcalChart, TimeChart, DistanceChart, WorkoutChart } from './Statistics';

interface AnalyticsModalProps {
  onCreatePress: () => void;
  completedHabitsCount: number;
  totalHabitsCount: number;
}

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({ 
  onCreatePress,
  completedHabitsCount,
  totalHabitsCount
}) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const snapPoints = useMemo(() => ['18%', '85%'], []);

  const completionRate = totalHabitsCount > 0 ? Math.round((completedHabitsCount / totalHabitsCount) * 100) : 0;

  return (
    <BottomSheet
      index={1} // Start expanded
      snapPoints={snapPoints}
      handleComponent={null}
      backgroundStyle={{ backgroundColor: '#F8FAFC', borderRadius: 30 }}
    >
      <View style={{ flex: 1 }}>
        {/* Custom Header */}
        <View className="flex-row justify-between items-start px-6 pt-4 pb-2 bg-white rounded-t-3xl">
            {/* Settings Button */}
            <TouchableOpacity 
                className="p-2 bg-gray-100 rounded-full mt-4"
                onPress={() => router.push('/settings')}
            >
                <Ionicons name="settings-outline" size={24} color={colors.textPrimary} />
            </TouchableOpacity>

            {/* Gauge */}
            <View className="mt-[-10]">
                <ProgressWidget compact={true} />
            </View>

            {/* FAB - Open Create Modal */}
            <TouchableOpacity 
                className="w-12 h-12 rounded-full items-center justify-center mt-2 shadow-md"
                style={{ backgroundColor: colors.primaryLight }}
                onPress={onCreatePress}
            >
                <Ionicons name="add" size={28} color="white" />
            </TouchableOpacity>
        </View>

        {/* Separator / Drag Indicator hint */}
        <View className="items-center pb-4 bg-white">
            <View className="w-12 h-1 bg-gray-300 rounded-full" />
        </View>

        {/* Scrollable Content */}
        <BottomSheetScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 50 }}>
             <View className="px-6 py-6">
                <View className="flex-row justify-between items-center mb-6">
                     <Text className="text-2xl font-bold text-black">My Statistics</Text>
                     <TouchableOpacity className="p-2 bg-gray-100 rounded-full">
                         <Ionicons name="grid-outline" size={20} color="black" />
                     </TouchableOpacity>
                </View>

                <HealthData />

                <View className="flex-row mb-4">
                    <KcalChart />
                    <View className="flex-1 justify-between">
                         <TimeChart />
                         <DistanceChart />
                    </View>
                </View>

                <WorkoutChart />
             </View>
        </BottomSheetScrollView>
      </View>
    </BottomSheet>
  );
};
