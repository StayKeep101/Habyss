import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { router } from 'expo-router';
import { DashboardView } from '../Dashboard/DashboardView';
import { DashboardData } from '../Dashboard/Dashboard.types';

// Temporarily use mock data generator or similar until real data is passed
const generateMockData = (): DashboardData => ({
    currentStreak: 12,
    bestStreak: 20,
    percentAboveBest: 15,
    percentile: 90,
    goalsProgress: 68,
    weeklyCompletionRate: 82,
    weeklyData: [
        { day: 'Mon', completionRate: 80, date: '' },
        { day: 'Tue', completionRate: 100, date: '' },
        { day: 'Wed', completionRate: 60, date: '' },
        { day: 'Thu', completionRate: 90, date: '' },
        { day: 'Fri', completionRate: 70, date: '' },
        { day: 'Sat', completionRate: 100, date: '' },
        { day: 'Sun', completionRate: 85, date: '' },
    ],
    goals: [],
    heatmapData: [],
});

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
  // Increase initial snap point to show more content
  const snapPoints = useMemo(() => ['50%', '90%'], []);

  const dateLabel = selectedDate.toDateString() === new Date().toDateString() 
    ? 'Today' 
    : selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <BottomSheet
      index={0} // Start at 50%
      snapPoints={snapPoints}
      handleComponent={null}
      enableOverDrag={false}
      enablePanDownToClose={false}
      backgroundStyle={{ backgroundColor: colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1, borderColor: colors.border }}
    >
      <View style={{ flex: 1 }}>
        {/* Custom Header */}
        <View className="flex-row justify-between items-center px-6 pt-5 pb-3 rounded-t-3xl" style={{ backgroundColor: colors.surface }}>
            <View className="flex-row items-center">
                 <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.surfaceSecondary }}>
                    <Ionicons name="stats-chart" size={20} color={colors.primary} />
                 </View>
                 <View>
                    <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>Dashboard</Text>
                    <Text className="text-xs font-medium" style={{ color: colors.textSecondary }}>{dateLabel}</Text>
                 </View>
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
                <DashboardView data={generateMockData()} />
             </View>
        </BottomSheetScrollView>
      </View>
    </BottomSheet>
  );
};
