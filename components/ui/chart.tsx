import * as React from "react"
import { View, Text, Dimensions, ScrollView, Animated } from "react-native"
import { LineChart, BarChart, PieChart } from "react-native-chart-kit"
import { Svg, Line, Circle, Defs, LinearGradient, Stop, Rect, Text as SvgText } from "react-native-svg"
import { cn } from "@/lib/utils"
import { useColorScheme } from "@/hooks/useColorScheme"
import { Colors } from "@/constants/Colors"

const { width: screenWidth } = Dimensions.get('window')

export interface ChartData {
  labels: string[]
  datasets: {
    data: number[]
    color?: (opacity: number) => string
    strokeWidth?: number
  }[]
}

export interface ChartProps {
  data: ChartData
  height?: number
  className?: string
  title?: string
  subtitle?: string
}

const chartConfig = {
  backgroundColor: "transparent",
  backgroundGradientFrom: "transparent",
  backgroundGradientTo: "transparent",
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(126, 160, 216, ${opacity})`, // Logo light blue
  labelColor: (opacity = 1) => `rgba(74, 112, 184, ${opacity})`, // Logo dark blue
  style: {
    borderRadius: 16,
  },
  propsForDots: {
    r: "4",
    strokeWidth: "2",
    stroke: "#7EA0D8"
  },
  propsForBackgroundLines: {
    strokeDasharray: "5,5",
    stroke: "#333333",
    strokeWidth: 1,
  },
}

export const LineChartComponent: React.FC<ChartProps> = ({ 
  data, 
  height = 220, 
  className, 
  title, 
  subtitle 
}) => {
  const colorScheme = useColorScheme()
  const colors = Colors[colorScheme ?? 'dark']
  const fadeAnim = React.useRef(new Animated.Value(0)).current
  const scaleAnim = React.useRef(new Animated.Value(0.9)).current
  
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start()
  }, [data])

  return (
    <Animated.View 
      className={cn("space-y-4", className)}
      style={{
        opacity: fadeAnim,
        transform: [{ scale: scaleAnim }],
      }}
    >
      {(title || subtitle) && (
        <View className="space-y-1">
          {title && (
            <Text className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
              {title}
            </Text>
          )}
          {subtitle && (
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              {subtitle}
            </Text>
          )}
        </View>
      )}
      <View 
        className="rounded-3xl overflow-hidden"
        style={{ backgroundColor: colors.surfaceSecondary }}
      >
        <LineChart
          data={data}
          width={screenWidth - 48}
          height={height}
          chartConfig={chartConfig}
          bezier
          style={{
            marginVertical: 8,
            borderRadius: 16,
          }}
          withDots={true}
          withShadow={false}
          withScrollableDot={false}
        />
      </View>
    </Animated.View>
  )
}

export const BarChartComponent: React.FC<ChartProps> = ({ 
  data, 
  height = 220, 
  className, 
  title, 
  subtitle 
}) => {
  const colorScheme = useColorScheme()
  const colors = Colors[colorScheme ?? 'dark']
  
  return (
    <View className={cn("space-y-4", className)}>
      {(title || subtitle) && (
        <View className="space-y-1">
          {title && (
            <Text className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
              {title}
            </Text>
          )}
          {subtitle && (
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              {subtitle}
            </Text>
          )}
        </View>
      )}
      <View 
        className="rounded-3xl overflow-hidden"
        style={{ backgroundColor: colors.surfaceSecondary }}
      >
        <BarChart
          data={data}
          width={screenWidth - 48}
          height={height}
          chartConfig={chartConfig}
          style={{
            marginVertical: 8,
            borderRadius: 16,
          }}
          showValuesOnTopOfBars={true}
          fromZero={true}
        />
      </View>
    </View>
  )
}

export const PieChartComponent: React.FC<{
  data: Array<{
    name: string
    population: number
    color: string
    legendFontColor: string
    legendFontSize: number
  }>
  title?: string
  subtitle?: string
  className?: string
}> = ({ data, title, subtitle, className }) => {
  const colorScheme = useColorScheme()
  const colors = Colors[colorScheme ?? 'dark']
  
  return (
    <View className={cn("space-y-4", className)}>
      {(title || subtitle) && (
        <View className="space-y-1">
          {title && (
            <Text className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
              {title}
            </Text>
          )}
          {subtitle && (
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              {subtitle}
            </Text>
          )}
        </View>
      )}
      <View 
        className="rounded-3xl overflow-hidden items-center"
        style={{ backgroundColor: colors.surfaceSecondary }}
      >
        <PieChart
          data={data}
          width={screenWidth - 48}
          height={220}
          chartConfig={chartConfig}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="15"
          style={{
            marginVertical: 8,
            borderRadius: 16,
          }}
        />
      </View>
    </View>
  )
}

// Custom Progress Ring Component
export const ProgressRing: React.FC<{
  progress: number // 0-100
  size?: number
  strokeWidth?: number
  title?: string
  subtitle?: string
  className?: string
}> = ({ progress, size = 120, strokeWidth = 8, title, subtitle, className }) => {
  const colorScheme = useColorScheme()
  const colors = Colors[colorScheme ?? 'dark']
  
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDasharray = `${circumference} ${circumference}`
  
  const animatedProgress = React.useRef(new Animated.Value(0)).current
  const fadeAnim = React.useRef(new Animated.Value(0)).current
  
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(animatedProgress, {
        toValue: progress,
        duration: 1500,
        useNativeDriver: false,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start()
  }, [progress])
  
  const strokeDashoffset = animatedProgress.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, circumference - (progress / 100) * circumference],
    extrapolate: 'clamp',
  })
  
  return (
    <Animated.View 
      className={cn("items-center space-y-3", className)}
      style={{ opacity: fadeAnim }}
    >
      {(title || subtitle) && (
        <View className="items-center space-y-1">
          {title && (
            <Text className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
              {title}
            </Text>
          )}
          {subtitle && (
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              {subtitle}
            </Text>
          )}
        </View>
      )}
      <View className="relative items-center justify-center">
        <Svg width={size} height={size} className="absolute">
          <Defs>
            <LinearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#4A70B8" stopOpacity="1" />
              <Stop offset="100%" stopColor="#7EA0D8" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          {/* Background circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.border}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#progressGradient)"
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View className="items-center">
          <Animated.Text 
            className="text-2xl font-bold" 
            style={{ color: colors.textPrimary }}
          >
            {Math.round(progress)}%
          </Animated.Text>
        </View>
      </View>
    </Animated.View>
  )
}
