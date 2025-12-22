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
  completedHabitsCount: number;
  totalHabitsCount: number;
  selectedDate: Date;
}

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({ 
  completedHabitsCount,
  totalHabitsCount,
  selectedDate
}) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const snapPoints = useMemo(() => ['18%', '68%'], []);

  const completionRate = totalHabitsCount > 0 ? Math.round((completedHabitsCount / totalHabitsCount) * 100) : 0;
  
  const dateLabel = selectedDate.toDateString() === new Date().toDateString() 
    ? 'Today' 
    : selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <BottomSheet
      index={1} // Start expanded
      snapPoints={snapPoints}
      handleComponent={null}
      enableOverDrag={false}
      enablePanDownToClose={false}
      backgroundStyle={{ backgroundColor: colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1, borderColor: colors.border }}
    >
      <View style={{ flex: 1 }}>
        {/* Custom Header - Finance Style */}
        <View className="flex-row justify-between items-center px-6 pt-5 pb-3 rounded-t-3xl" style={{ backgroundColor: colors.surface }}>
            <View className="flex-row items-center">
                 <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.surfaceSecondary }}>
                    <Ionicons name="stats-chart" size={20} color={colors.primary} />
                 </View>
                 <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>Statistics</Text>
            </View>

            <View className="flex-row items-center gap-2">
                {/* Settings Button */}
                <TouchableOpacity 
                    className="w-10 h-10 rounded-full items-center justify-center border"
                    style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}
                    onPress={() => router.push('/settings')}
                >
                    <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
                </TouchableOpacity>

                {/* FAB - Open Create Modal */}
                <TouchableOpacity 
                    className="w-10 h-10 rounded-full items-center justify-center shadow-sm"
                    style={{ backgroundColor: colors.primary }}
                    onPress={() => router.push('/create')}
                >
                    <Ionicons name="add" size={24} color="white" />
                </TouchableOpacity>
            </View>
        </View>

        {/* Separator */}
        <View className="h-[1px] w-full" style={{ backgroundColor: colors.border }} />

        {/* Scrollable Content */}
        <BottomSheetScrollView 
            style={{ flex: 1 }} 
            contentContainerStyle={{ paddingBottom: 50, paddingTop: 20 }}
            bounces={false}
        >
             <View className="px-6">
                
                {/* Gauge Section - Cleaned up */}
                <View className="items-center mb-8">
                     <ProgressWidget compact={false} />
                     <Text className="mt-4 text-sm font-medium" style={{ color: colors.textSecondary }}>
                        {dateLabel} • {completedHabitsCount} of {totalHabitsCount} completed
                     </Text>
                </View>

                <View className="flex-row justify-between items-center mb-4">
                    <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>Health Overview</Text>
                    <TouchableOpacity>
                        <Text className="text-sm font-semibold" style={{ color: colors.primary }}>See all</Text>
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
