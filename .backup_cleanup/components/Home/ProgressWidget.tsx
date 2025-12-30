import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface ProgressWidgetProps {
  compact?: boolean;
  percentage?: number; // 0 to 100
  title?: string;
}

export const ProgressWidget: React.FC<ProgressWidgetProps> = ({ compact = false, percentage = 0, title = "Consistency" }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const width = compact ? 200 : 300;
  const height = compact ? 100 : 160;
  const centerX = width / 2;
  const centerY = compact ? 90 : 140;
  const radius = compact ? 80 : 130;
  const thickness = compact ? 25 : 45;
  
  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees - 180) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };

  const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number, thickness: number) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    
    const innerStart = polarToCartesian(x, y, radius - thickness, endAngle);
    const innerEnd = polarToCartesian(x, y, radius - thickness, startAngle);

    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

    const d = [
      "M", start.x, start.y,
      "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
      "L", innerEnd.x, innerEnd.y,
      "A", radius - thickness, radius - thickness, 0, largeArcFlag, 1, innerStart.x, innerStart.y,
      "Z"
    ].join(" ");

    return d;
  };

  // Map percentage to angle (0% -> 0 deg, 100% -> 180 deg)
  const maxAngle = 180;
  const progressAngle = Math.min(Math.max(percentage, 0), 100) / 100 * maxAngle;

  return (
    <View className="items-center justify-center">
      <View style={{ width, height }}>
        <Svg width={width} height={height}>
          {/* Background Arc */}
          <Path
            d={describeArc(centerX, centerY, radius, 0, 180, thickness)}
            fill={colors.surfaceSecondary}
          />
          
          {/* Progress Arc */}
          {percentage > 0 && (
              <Path
                d={describeArc(centerX, centerY, radius, 0, progressAngle, thickness)}
                fill={colors.primary}
              />
          )}
        </Svg>
        
        {/* Center Text */}
        <View className="absolute inset-0 items-center justify-end pb-2">
          <Text className={`${compact ? 'text-xl' : 'text-4xl'} font-bold mb-1`} style={{ color: colors.textPrimary }}>
            {percentage}%
          </Text>
          {!compact && (
            <View className="px-3 py-1 rounded-full" style={{ backgroundColor: colors.surfaceSecondary }}>
                <Text className="text-xs font-medium" style={{ color: colors.textSecondary }}>
                {title}
                </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};
