import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import Svg, { Path, Line, Circle } from 'react-native-svg';

export const HealthData = () => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View className="bg-white rounded-3xl p-5 mb-4 shadow-sm">
      <View className="flex-row items-center mb-2">
        <View className="w-10 h-10 rounded-2xl bg-green-100 items-center justify-center mr-3">
            <Ionicons name="stats-chart" size={20} color={colors.success} />
        </View>
        <Text className="text-lg font-bold text-black">Health Data</Text>
      </View>
      <Text className="text-gray-400 text-sm mb-4">
        Your statistics is calculated based on the in-app trackers
      </Text>
    </View>
  );
};

export const KcalChart = () => {
  return (
    <View className="bg-white rounded-3xl p-5 flex-1 mr-2 shadow-sm h-48 justify-between">
      <View>
        <View className="flex-row items-center mb-2">
            <Ionicons name="heart-outline" size={20} color="black" style={{ marginRight: 6 }} />
            <Text className="font-bold text-black">Kcal</Text>
        </View>
        <View className="flex-row items-end">
            <Text className="text-3xl font-bold text-black mr-1">31</Text>
            <Text className="text-sm font-medium text-gray-500 mb-1">kcal</Text>
        </View>
      </View>
      
      {/* Simple Line Chart Placeholder */}
      <View style={{ height: 60, width: '100%' }}>
         <Svg height="100%" width="100%">
            <Path
              d="M0,50 C20,30 40,60 60,20 C80,0 100,30 120,40 L120,60 L0,60 Z"
              fill="rgba(74, 222, 128, 0.2)" // Green-400 with opacity
            />
             <Path
              d="M0,50 C20,30 40,60 60,20 C80,0 100,30 120,40"
              fill="none"
              stroke="#4ade80" // Green-400
              strokeWidth="2"
            />
            <Circle cx="60" cy="20" r="4" fill="white" stroke="#4ade80" strokeWidth="2" />
         </Svg>
      </View>
    </View>
  );
};

export const TimeChart = () => {
  return (
    <View className="bg-white rounded-3xl p-5 flex-1 ml-2 shadow-sm mb-4">
       <View className="flex-row items-center mb-2">
            <Ionicons name="time-outline" size={20} color="black" style={{ marginRight: 6 }} />
            <Text className="font-bold text-black">50 Min</Text>
        </View>
        <View className="flex-row items-end">
            <Text className="text-3xl font-bold text-black mr-1">15</Text>
            <Text className="text-sm font-medium text-gray-500 mb-1">Min</Text>
        </View>
    </View>
  );
};

export const DistanceChart = () => {
    return (
      <View className="bg-white rounded-3xl p-5 flex-1 ml-2 shadow-sm">
         <View className="flex-row items-center mb-2">
              <Ionicons name="location-outline" size={20} color="black" style={{ marginRight: 6 }} />
              <Text className="font-bold text-black">2 Km</Text>
          </View>
          <View className="flex-row items-end">
              <Text className="text-3xl font-bold text-black mr-1">0.7</Text>
              <Text className="text-sm font-medium text-gray-500 mb-1">Km</Text>
          </View>
      </View>
    );
  };

export const WorkoutChart = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const data = [40, 80, 60, 90, 70, 80, 65]; // Percentages
    
    return (
        <View className="bg-white rounded-3xl p-6 mt-4 shadow-sm">
            <View className="flex-row justify-between items-center mb-2">
                <View>
                    <Text className="text-xl font-bold text-black">Workout</Text>
                    <Text className="text-gray-500">0/8,500 steps</Text>
                </View>
                <Text className="text-gray-500 font-medium">Goal 20 Min</Text>
            </View>

            {/* Bar Chart */}
            <View className="flex-row justify-between items-end h-40 mt-6">
                {data.map((value, index) => (
                    <View key={index} className="items-center flex-1">
                        {/* Tooltip for Wednesday */}
                        {index === 3 && (
                            <View className="bg-black rounded-lg py-1 px-2 mb-2">
                                <Text className="text-white text-xs font-bold">15 min</Text>
                                <View className="absolute bottom-[-4px] left-1/2 ml-[-4px] w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-black" />
                            </View>
                        )}
                        
                        {/* Bar Container */}
                        <View className="w-8 h-32 bg-gray-100 rounded-full overflow-hidden justify-end">
                            {/* Fill */}
                            <View 
                                style={{ height: `${value}%` }} 
                                className="w-full bg-purple-400 rounded-full"
                            />
                             {/* Striped Pattern Overlay (simulated with opacity or image if needed, keeping simple for now) */}
                        </View>
                        
                        <Text className="text-xs text-gray-400 mt-2 font-medium">{days[index]}</Text>
                    </View>
                ))}
            </View>

             <View className="flex-row justify-between items-center mt-6 pt-4 border-t border-gray-100">
                <Text className="text-gray-500 font-medium">Weekly Average</Text>
                <Text className="text-black font-bold">140 Min</Text>
             </View>
        </View>
    );
}
