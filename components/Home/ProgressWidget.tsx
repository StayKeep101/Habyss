import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

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

interface ProgressWidgetProps {
  compact?: boolean;
}

export const ProgressWidget: React.FC<ProgressWidgetProps> = ({ compact = false }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const width = compact ? 200 : 300;
  const height = compact ? 100 : 160;
  const centerX = width / 2;
  const centerY = compact ? 90 : 140;
  const radius = compact ? 80 : 130;
  const thickness = compact ? 25 : 45;
  const fontSize = compact ? "10" : "12";
  
  return (
    <View className="items-center justify-center">
      <View style={{ width, height }}>
        <Svg width={width} height={height}>
          {/* Left Segment - 32% */}
          <Path
            d={describeArc(centerX, centerY, radius, 0, 50, thickness)}
            fill={colors.primaryLight} // Medium Green
          />
           {!compact && <SvgText
            x={polarToCartesian(centerX, centerY, radius - thickness/2, 25).x}
            y={polarToCartesian(centerX, centerY, radius - thickness/2, 25).y}
            fill="#1E3E2B"
            fontSize={fontSize}
            fontWeight="bold"
            textAnchor="middle"
            alignmentBaseline="middle"
            transform={`rotate(-45, ${polarToCartesian(centerX, centerY, radius - thickness/2, 25).x}, ${polarToCartesian(centerX, centerY, radius - thickness/2, 25).y})`}
          >
            32%
          </SvgText>}

          {/* Top Segment - 36% */}
          <Path
            d={describeArc(centerX, centerY, radius, 55, 125, thickness)}
            fill={colors.surfaceSecondary} // Light Green
          />
           {!compact && <SvgText
            x={polarToCartesian(centerX, centerY, radius - thickness/2, 90).x}
            y={polarToCartesian(centerX, centerY, radius - thickness/2, 90).y}
            fill="#1E3E2B"
            fontSize={fontSize}
            fontWeight="bold"
            textAnchor="middle"
            alignmentBaseline="middle"
          >
            36%
          </SvgText>}

          {/* Right Segment - 33% */}
          <Path
            d={describeArc(centerX, centerY, radius, 130, 180, thickness)}
            fill={colors.primary} // Dark Green
          />
           {!compact && <SvgText
            x={polarToCartesian(centerX, centerY, radius - thickness/2, 155).x}
            y={polarToCartesian(centerX, centerY, radius - thickness/2, 155).y}
            fill="#D1EAD1"
            fontSize={fontSize}
            fontWeight="bold"
            textAnchor="middle"
            alignmentBaseline="middle"
             transform={`rotate(45, ${polarToCartesian(centerX, centerY, radius - thickness/2, 155).x}, ${polarToCartesian(centerX, centerY, radius - thickness/2, 155).y})`}
          >
            33%
          </SvgText>}
        </Svg>
        
        {/* Center Text */}
        <View className="absolute inset-0 items-center justify-end pb-2">
          <Text className={`${compact ? 'text-xl' : 'text-3xl'} font-bold mb-1`} style={{ color: colors.textPrimary }}>
            10-12%
          </Text>
          {!compact && (
            <View className="px-3 py-1 rounded-full bg-gray-100">
                <Text className="text-xs font-medium text-gray-500">
                Daily Improvement
                </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};
