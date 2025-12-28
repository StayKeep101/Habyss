import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import Svg, { Path, Line, Circle } from 'react-native-svg';

export const HealthData = React.memo(() => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View className="rounded-3xl p-5 mb-4 shadow-sm" style={{ backgroundColor: colors.surfaceSecondary }}>
      <View className="flex-row items-center mb-2">
        <View className="w-10 h-10 rounded-2xl items-center justify-center mr-3" style={{ backgroundColor: colors.success + '20' }}>
            <Ionicons name="stats-chart" size={20} color={colors.success} />
        </View>
        <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>Health Data</Text>
      </View>
      <Text className="text-sm mb-4" style={{ color: colors.textSecondary }}>
        Your statistics is calculated based on the in-app trackers
      </Text>
    </View>
  );
});

export const KcalChart = React.memo(() => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  return (
    <View className="rounded-3xl p-5 flex-1 mr-2 shadow-sm h-48 justify-between" style={{ backgroundColor: colors.surfaceSecondary }}>
      <View>
        <View className="flex-row items-center mb-2">
            <Ionicons name="heart-outline" size={20} color={colors.textPrimary} style={{ marginRight: 6 }} />
            <Text className="font-bold" style={{ color: colors.textPrimary }}>Kcal</Text>
        </View>
        <View className="flex-row items-end">
            <Text className="text-3xl font-bold mr-1" style={{ color: colors.textPrimary }}>31</Text>
            <Text className="text-sm font-medium mb-1" style={{ color: colors.textSecondary }}>kcal</Text>
        </View>
      </View>
      
      {/* Simple Line Chart Placeholder */}
      <View style={{ height: 60, width: '100%' }}>
         <Svg height="100%" width="100%">
            <Path
              d="M0,50 C20,30 40,60 60,20 C80,0 100,30 120,40 L120,60 L0,60 Z"
              fill={colors.success + '33'} // Green with opacity
            />
             <Path
              d="M0,50 C20,30 40,60 60,20 C80,0 100,30 120,40"
              fill="none"
              stroke={colors.success}
              strokeWidth="2"
            />
            <Circle cx="60" cy="20" r="4" fill={colors.surfaceSecondary} stroke={colors.success} strokeWidth="2" />
         </Svg>
      </View>
    </View>
  );
});

export const TimeChart = React.memo(() => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  return (
    <View className="rounded-3xl p-5 flex-1 ml-2 shadow-sm mb-4" style={{ backgroundColor: colors.surfaceSecondary }}>
       <View className="flex-row items-center mb-2">
            <Ionicons name="time-outline" size={20} color={colors.textPrimary} style={{ marginRight: 6 }} />
            <Text className="font-bold" style={{ color: colors.textPrimary }}>50 Min</Text>
        </View>
        <View className="flex-row items-end">
            <Text className="text-3xl font-bold mr-1" style={{ color: colors.textPrimary }}>15</Text>
            <Text className="text-sm font-medium mb-1" style={{ color: colors.textSecondary }}>Min</Text>
        </View>
    </View>
  );
});

export const DistanceChart = React.memo(() => {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    return (
      <View className="rounded-3xl p-5 flex-1 ml-2 shadow-sm" style={{ backgroundColor: colors.surfaceSecondary }}>
         <View className="flex-row items-center mb-2">
              <Ionicons name="location-outline" size={20} color={colors.textPrimary} style={{ marginRight: 6 }} />
              <Text className="font-bold" style={{ color: colors.textPrimary }}>2 Km</Text>
          </View>
          <View className="flex-row items-end">
              <Text className="text-3xl font-bold mr-1" style={{ color: colors.textPrimary }}>0.7</Text>
              <Text className="text-sm font-medium mb-1" style={{ color: colors.textSecondary }}>Km</Text>
          </View>
      </View>
    );
});

export const WorkoutChart = React.memo(() => {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const data = [40, 80, 60, 90, 70, 80, 65]; // Percentages
    
    return (
        <View className="rounded-3xl p-6 mt-4 shadow-sm" style={{ backgroundColor: colors.surfaceSecondary }}>
            <View className="flex-row justify-between items-center mb-2">
                <View>
                    <Text className="text-xl font-bold" style={{ color: colors.textPrimary }}>Workout</Text>
                    <Text style={{ color: colors.textSecondary }}>0/8,500 steps</Text>
                </View>
                <Text className="font-medium" style={{ color: colors.textSecondary }}>Goal 20 Min</Text>
            </View>

            {/* Bar Chart */}
            <View className="flex-row justify-between items-end h-40 mt-6">
                {data.map((value, index) => (
                    <View key={index} className="items-center flex-1">
                        {/* Tooltip for Wednesday */}
                        {index === 3 && (
                            <View className="rounded-lg py-1 px-2 mb-2" style={{ backgroundColor: colors.textPrimary }}>
                                <Text className="text-xs font-bold" style={{ color: colors.surfaceSecondary }}>15 min</Text>
                                <View 
                                    className="absolute bottom-[-4px] left-1/2 ml-[-4px] w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent" 
                                    style={{ borderTopColor: colors.textPrimary }}
                                />
                            </View>
                        )}
                        
                        {/* Bar Container */}
                        <View className="w-8 h-32 rounded-full overflow-hidden justify-end" style={{ backgroundColor: colors.surfaceTertiary }}>
                            {/* Fill */}
                            <View 
                                style={{ height: `${value}%`, backgroundColor: '#9CB1D6' }} 
                                className="w-full rounded-full"
                            />
                        </View>
                        
                        <Text className="text-xs mt-2 font-medium" style={{ color: colors.textSecondary }}>{days[index]}</Text>
                    </View>
                ))}
            </View>

             <View className="flex-row justify-between items-center mt-6 pt-4 border-t" style={{ borderColor: colors.border }}>
                <Text className="font-medium" style={{ color: colors.textSecondary }}>Weekly Average</Text>
                <Text className="font-bold" style={{ color: colors.textPrimary }}>140 Min</Text>
             </View>
        </View>
    );
});
