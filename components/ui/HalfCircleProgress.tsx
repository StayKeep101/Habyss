import { FontFamily } from '@/theme/designSystem';
import React from 'react';
import { View, Text } from 'react-native';
import { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { AnimatedPath, useCountUp, useProgress } from './Motion';

interface HalfCircleProgressProps {
  progress: number;
  size: number;
  strokeWidth: number;
  color: string;
  backgroundColor: string;
  textColor: string;
  fontSize?: number;
  showPercentage?: boolean;
}

export const HalfCircleProgress: React.FC<HalfCircleProgressProps> = ({
  progress,
  size,
  strokeWidth,
  color,
  backgroundColor,
  textColor,
  fontSize = 12,
  showPercentage = true
}) => {
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = Math.PI * radius; // Only half circle
  const shown = useProgress(Math.min(100, Math.max(0, progress)) / 100);
  const arc = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - shown.get()) }));
  const percent = useCountUp(`${Math.round(progress)}%`);

  return (
    <View style={{ width: size, height: size / 2 + (showPercentage ? 5 : 0), alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', top: 0 }}>
        {/* Background Path (Half Circle) */}
        <Path
          d={`M ${strokeWidth / 2} ${center} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${center}`}
          fill="none"
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Progress Path (Half Circle) */}
        <AnimatedPath
          d={`M ${strokeWidth / 2} ${center} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${center}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          animatedProps={arc}
          strokeLinecap="round"
        />
      </Svg>
      {showPercentage && (
        <View style={{ position: 'absolute', bottom: 8 }}>
          <Text style={{ color: textColor, fontFamily: FontFamily.bold, fontSize, textAlign: 'center' }}>{percent}</Text>
        </View>
      )}
    </View>
  );
};
