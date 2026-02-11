import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Dimensions } from 'react-native';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { Habit } from '@/lib/habitsSQLite';
import { useRouter } from 'expo-router';
import { RoadMapCardSize } from '@/constants/AppSettingsContext';
import { VoidCard } from '../Layout/VoidCard';
import { useHaptics } from '@/hooks/useHaptics';
import Svg, { Rect, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

// Extended habit type with runtime properties
interface ExtendedHabit extends Habit {
  completed?: boolean;
  streak?: number;
}

interface SwipeableHabitItemProps {
  habit: ExtendedHabit;
  onPress: (habit: ExtendedHabit) => void;
  onEdit: (habit: ExtendedHabit) => void;
  onDelete: (habit: ExtendedHabit) => void;
  onShare?: (habit: ExtendedHabit) => void;
  size: RoadMapCardSize;
  completed?: boolean; // New prop for performance (avoids object recreation)
  goalName?: string; // Optional goal name to display as subtitle
  isActive?: boolean;
  timeLeft?: number; // In seconds
  totalDuration?: number; // In minutes
}

const { width } = Dimensions.get('window');
const ACTION_WIDTH = 70; // Slightly larger for better touch targets

export const SwipeableHabitItem = React.memo<SwipeableHabitItemProps>(({
  habit, onPress, onEdit, onDelete, onShare, size, completed, goalName, isActive, timeLeft, totalDuration
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const swipeableRef = useRef<Swipeable>(null);
  const router = useRouter();
  const { lightFeedback, selectionFeedback, mediumFeedback } = useHaptics();
  const { colors: accentColors, primary: accentColor } = useAccentGradient();

  // Measure card for SVG Border
  const [layout, setLayout] = React.useState({ width: 0, height: 0 });

  const close = () => swipeableRef.current?.close();

  // Prefer dedicated prop, fallback to object property
  const isCompleted = completed !== undefined ? completed : habit.completed;

  // Dynamic Sizing (Habits must be smaller than Goals)
  const isSmall = size === 'small';
  const isBig = size === 'big';

  // Even for BIG, habits should stay relatively compact compared to goals
  const paddingV = isSmall ? 4 : (isBig ? 12 : 10);
  const iconSize = isSmall ? 12 : (isBig ? 16 : 14);
  const iconBoxSize = isSmall ? 20 : (isBig ? 32 : 26);
  const fontSize = isSmall ? 11 : (isBig ? 14 : 13);
  const checkboxSize = isSmall ? 14 : (isBig ? 20 : 18);

  // Swipe threshold trigger with haptic
  const onSwipeableWillOpen = (direction: 'left' | 'right') => {
    lightFeedback(); // Subtle haptic when swipe reveals actions
  };

  // (renderLeftActions and renderRightActions remain mostly same but slightly smaller)
  const renderLeftActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const trans = dragX.interpolate({
      inputRange: [0, 50, 100],
      outputRange: [-20, 0, 0],
      extrapolate: 'clamp',
    });
    const scale = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.8, 1],
      extrapolate: 'clamp',
    });

    return (
      <RectButton
        style={[styles.leftAction, { backgroundColor: colors.primary }]}
        onPress={() => {
          selectionFeedback();
          close();
          router.push({ pathname: '/habit-detail', params: { habitId: habit.id } });
        }}
      >
        <Animated.View style={[styles.actionContent, { transform: [{ translateX: trans }, { scale }] }]}>
          <Ionicons name="open-outline" size={20} color="white" />
        </Animated.View>
      </RectButton>
    );
  };

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    // Reveal animation
    const trans = dragX.interpolate({
      inputRange: [-ACTION_WIDTH * 3, 0],
      outputRange: [0, ACTION_WIDTH * 3],
      extrapolate: 'clamp',
    });

    const scale = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.8, 1],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.rightActionsContainer}>
        <RectButton
          style={[styles.rightAction, { backgroundColor: '#F59E0B' }]}
          onPress={() => { selectionFeedback(); close(); onEdit(habit); }}
        >
          <Animated.View style={[styles.actionContent, { transform: [{ scale }, { translateX: Animated.multiply(trans, 0.2) }] }]}>
            <Ionicons name="pencil" size={20} color="white" />
          </Animated.View>
        </RectButton>
        <RectButton
          style={[styles.rightAction, { backgroundColor: '#EF4444' }]}
          onPress={() => { mediumFeedback(); close(); onDelete(habit); }}
        >
          <Animated.View style={[styles.actionContent, { transform: [{ scale }, { translateX: Animated.multiply(trans, 0.3) }] }]}>
            <Ionicons name="trash" size={20} color="white" />
          </Animated.View>
        </RectButton>
      </View>
    );
  };

  // Timer Progress Logic
  const formattedTime = React.useMemo(() => {
    if (!timeLeft) return null;
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }, [timeLeft]);

  const progress = React.useMemo(() => {
    if (!timeLeft || !totalDuration) return 0;
    const totalSeconds = totalDuration * 60;
    const elapsed = totalSeconds - timeLeft;
    return Math.min(elapsed / totalSeconds, 1);
  }, [timeLeft, totalDuration]);

  // SVG Calculations
  const strokeWidth = 3;
  const radius = 10;
  // Perimeter of rect with rx/ry: 2*(w+h) - 8r + 2PI*r
  const perimeter = 2 * (layout.width + layout.height) - 8 * radius + (2 * Math.PI * radius);
  const strokeDashoffset = perimeter * (1 - progress);

  return (


    <Swipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      leftThreshold={50}
      rightThreshold={40}
      overshootLeft={false}
      overshootRight={true} // Allow slight overshoot for organic feel
      overshootFriction={8}
      friction={1.2} // More responsive (1.0 is 1:1, >1 is slower)
      onSwipeableWillOpen={onSwipeableWillOpen}
      containerStyle={styles.swipeableContainer}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onPress(habit)}
        style={styles.cardWrapper}
        onLayout={(e) => setLayout(e.nativeEvent.layout)}
      >
        {/* Active Gradient Border Wrapper (NOW SVG) */}
        {isActive && layout.width > 0 && (
          <View style={StyleSheet.absoluteFill}>
            <Svg width={layout.width} height={layout.height} style={StyleSheet.absoluteFill}>
              <Defs>
                <SvgGradient id="grad" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={accentColors[0]} stopOpacity="1" />
                  <Stop offset="1" stopColor={accentColors[1]} stopOpacity="1" />
                </SvgGradient>
              </Defs>
              {/* Background Track */}
              <Rect
                x={strokeWidth / 2}
                y={strokeWidth / 2}
                width={layout.width - strokeWidth}
                height={layout.height - strokeWidth}
                rx={radius}
                stroke={accentColors[0] + '30'}
                strokeWidth={strokeWidth}
                fill="none"
              />
              {/* Progress Stroke */}
              <Rect
                x={strokeWidth / 2}
                y={strokeWidth / 2}
                width={layout.width - strokeWidth}
                height={layout.height - strokeWidth}
                rx={radius}
                stroke="url(#grad)" // Use gradient
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={perimeter}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </Svg>
          </View>
        )}

        <View>
          {/* Main Card Content */}
          <VoidCard
            intensity={40} // Lighter glass for items
            style={[
              styles.card,
              isCompleted && { opacity: 0.7 },
              { paddingVertical: paddingV },
              isActive && { margin: 4 } // Inset to not cover border
            ]}
          >
            {/* Checkbox / Hit Area */}
            <View style={[styles.checkbox, { width: checkboxSize, height: checkboxSize, borderRadius: checkboxSize / 2 }, isCompleted && { backgroundColor: accentColor + '30', borderColor: accentColor }, isActive && { borderColor: accentColor, backgroundColor: accentColor + '20' }]}>
              {(isCompleted || isActive) && <Ionicons name={isCompleted ? "checkmark" : "play"} size={checkboxSize * 0.7} color={accentColor} />}
            </View>

            {/* Icon */}
            <View style={[styles.iconContainer, { width: iconBoxSize, height: iconBoxSize }, { backgroundColor: isCompleted ? accentColor + '15' : (habit.color || accentColor) + '15' }]}>
              <Ionicons name={(habit.icon as any) || 'ellipse-outline'} size={iconSize} color={isCompleted ? accentColor : habit.color || colors.textSecondary} />
            </View>

            {/* Text Info */}
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { fontSize, color: colors.textPrimary, textDecorationLine: isCompleted ? 'line-through' : 'none' }, isActive && { fontWeight: '900', color: accentColor }]} numberOfLines={1}>
                {habit.name}
              </Text>
              {goalName && !isSmall ? (
                <Text style={{ fontSize: 10, color: colors.textTertiary, fontFamily: 'Lexend_400Regular', marginTop: 2 }} numberOfLines={1}>{goalName}</Text>
              ) : ((habit.streak ?? 0) > 0 && !isSmall) ? (
                <Text style={[styles.streakText, { color: '#F59E0B' }]}>🔥 {habit.streak}</Text>
              ) : null}
            </View>

            {/* Time / Timer + Target (Compact) */}
            <View style={{ alignItems: 'flex-end' }}>
              {isActive && formattedTime ? (
                <Text style={{ fontSize: 13, fontWeight: '700', color: accentColor, fontFamily: 'Lexend', fontVariant: ['tabular-nums'] }}>
                  {formattedTime}
                </Text>
              ) : (
                <>
                  {habit.goalValue > 1 && habit.unit && habit.unit !== 'count' && !isSmall && (
                    <Text style={{ fontSize: 9, color: colors.textTertiary, fontFamily: 'Lexend_400Regular', marginBottom: 1 }}>
                      {habit.goalValue} {habit.unit}
                    </Text>
                  )}
                  <Text style={[styles.timeText, { color: colors.textTertiary, fontSize: isSmall ? 9 : 11 }]}>
                    {habit.startTime || '--:--'}{habit.durationMinutes ? ` · ${habit.durationMinutes}m` : ''}
                  </Text>
                </>
              )}
            </View>

          </VoidCard>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
});

const styles = StyleSheet.create({
  swipeableContainer: {
    marginBottom: 4, // Tighter gap
    borderRadius: 8,
    overflow: 'hidden',
  },
  cardWrapper: {
    backgroundColor: 'transparent',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  checkbox: {
    borderWidth: 1.5,
    borderColor: 'rgba(128,128,128,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  iconContainer: {
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  title: {
    fontWeight: '500',
    fontFamily: 'Lexend_400Regular', // Lighter weight for items
  },
  streakText: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 1,
  },
  timeText: {
    fontFamily: 'Lexend_400Regular',
  },
  leftAction: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 20,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  rightActionsContainer: {
    flexDirection: 'row',
  },
  rightAction: {
    width: ACTION_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
