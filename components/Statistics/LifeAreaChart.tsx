import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Path, G, Circle } from 'react-native-svg';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { HabitCategory } from '@/lib/habits';

interface LifeAreaChartProps {
  data: { category: HabitCategory; count: number; color: string; label: string }[];
  selectedCategory: HabitCategory | null;
  onSelectCategory: (category: HabitCategory) => void;
}

const { width } = Dimensions.get('window');
const SIZE = width * 0.65;
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2;
const INNER_RADIUS = RADIUS * 0.65; // Donut thickness

export const LifeAreaChart: React.FC<LifeAreaChartProps> = ({ data, selectedCategory, onSelectCategory }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];

  const total = useMemo(() => data.reduce((sum, item) => sum + item.count, 0), [data]);

  const arcs = useMemo(() => {
    let startAngle = 0;
    return data.map((item) => {
      const angle = total > 0 ? (item.count / total) * 360 : 360 / data.length; // Equal slices if empty
      const endAngle = startAngle + angle;
      
      // Calculate path
      const x1 = CENTER + RADIUS * Math.cos((startAngle * Math.PI) / 180);
      const y1 = CENTER + RADIUS * Math.sin((startAngle * Math.PI) / 180);
      const x2 = CENTER + RADIUS * Math.cos((endAngle * Math.PI) / 180);
      const y2 = CENTER + RADIUS * Math.sin((endAngle * Math.PI) / 180);
      
      const x3 = CENTER + INNER_RADIUS * Math.cos((endAngle * Math.PI) / 180);
      const y3 = CENTER + INNER_RADIUS * Math.sin((endAngle * Math.PI) / 180);
      const x4 = CENTER + INNER_RADIUS * Math.cos((startAngle * Math.PI) / 180);
      const y4 = CENTER + INNER_RADIUS * Math.sin((startAngle * Math.PI) / 180);

      const largeArcFlag = angle > 180 ? 1 : 0;

      const path = `
        M ${x1} ${y1}
        A ${RADIUS} ${RADIUS} 0 ${largeArcFlag} 1 ${x2} ${y2}
        L ${x3} ${y3}
        A ${INNER_RADIUS} ${INNER_RADIUS} 0 ${largeArcFlag} 0 ${x4} ${y4}
        Z
      `;

      // Centroid for tap detection (simplified) or label
      const midAngle = startAngle + angle / 2;
      
      const slice = {
        path,
        color: item.color,
        category: item.category,
        label: item.label,
        startAngle,
        endAngle,
        midAngle
      };
      
      startAngle += angle;
      return slice;
    });
  }, [data, total]);

  const selectedItem = data.find(d => d.category === selectedCategory);

  return (
    <View className="items-center justify-center my-6">
      <View style={{ width: SIZE, height: SIZE }}>
        <Svg width={SIZE} height={SIZE}>
          <G rotation="-90" origin={`${CENTER}, ${CENTER}`}>
            {arcs.map((slice, index) => {
                const isSelected = selectedCategory === slice.category;
                return (
                    <Path
                        key={index}
                        d={slice.path}
                        fill={slice.color}
                        opacity={isSelected || !selectedCategory ? 1 : 0.3}
                        onPress={() => onSelectCategory(slice.category)}
                        stroke={colors.background}
                        strokeWidth="4"
                    />
                );
            })}
          </G>
        </Svg>
        
        {/* Center Content */}
        <View 
            className="absolute top-0 left-0 right-0 bottom-0 items-center justify-center"
            pointerEvents="none"
        >
            <Text className="text-3xl font-bold" style={{ color: colors.textPrimary }}>
                {selectedItem ? selectedItem.count : total}
            </Text>
            <Text className="text-sm font-medium uppercase tracking-wider" style={{ color: colors.textSecondary }}>
                {selectedItem ? selectedItem.label : 'Total Habits'}
            </Text>
        </View>
      </View>

      {/* Legend / Category Selector */}
      <View className="flex-row flex-wrap justify-center mt-8 gap-3 px-4">
        {data.map((item) => (
            <TouchableOpacity
                key={item.category}
                onPress={() => onSelectCategory(item.category)}
                className="flex-row items-center px-3 py-2 rounded-full border"
                style={{ 
                    backgroundColor: selectedCategory === item.category ? item.color + '20' : colors.surfaceSecondary,
                    borderColor: selectedCategory === item.category ? item.color : 'transparent'
                }}
            >
                <View className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }} />
                <Text 
                    className="font-medium text-xs"
                    style={{ color: selectedCategory === item.category ? item.color : colors.textSecondary }}
                >
                    {item.label}
                </Text>
            </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};
