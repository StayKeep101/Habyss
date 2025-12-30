import React, { useState } from 'react';
import { View, Text, LayoutChangeEvent } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

export const WeeklyTrends: React.FC = () => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [containerWidth, setContainerWidth] = useState(0);
  
  // Mock data points
  const data = [30, 45, 60, 55, 70, 85, 80];
  const max = 100;
  const height = 150;

  const onLayout = (event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  };

  // Simple path generator
  const renderChart = () => {
    if (containerWidth === 0) return null;

    const stepX = containerWidth / (data.length - 1);
    const points = data.map((val, i) => {
        const x = i * stepX;
        const y = height - (val / max) * height;
        return `${x},${y}`;
    });

    const pathD = `M ${points.join(' L ')}`;
    const areaD = `${pathD} L ${containerWidth},${height} L 0,${height} Z`;

    return (
      <Svg height={height} width={containerWidth}>
          <Defs>
              <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors.primary} stopOpacity="0.5" />
                  <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
              </LinearGradient>
          </Defs>
          <Path d={areaD} fill="url(#grad)" />
          <Path d={pathD} stroke={colors.primary} strokeWidth="3" fill="none" />
      </Svg>
    );
  };

  return (
    <View className="mb-8 p-5 rounded-3xl" style={{ backgroundColor: colors.surfaceSecondary }}>
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>Completion Trend</Text>
        <Text className="text-sm font-bold" style={{ color: colors.success }}>+12% this week</Text>
      </View>

      <View style={{ height }} onLayout={onLayout}>
        {renderChart()}
      </View>
      
      <View className="flex-row justify-between mt-2">
         {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
             <Text 
                key={i} 
                className="text-[10px] font-medium" 
                style={{ 
                    color: colors.textSecondary,
                    width: 35, // Fixed width for labels to ensure centering
                    textAlign: 'center',
                    // Adjust margin for first and last to keep them within bounds
                    marginLeft: i === 0 ? -10 : 0,
                    marginRight: i === 6 ? -10 : 0,
                }}
            >
                {d}
            </Text>
         ))}
      </View>
    </View>
  );
};
