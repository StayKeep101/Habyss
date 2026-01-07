import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Dimensions } from 'react-native';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { Habit } from '@/lib/habits';
import { useRouter } from 'expo-router';
import { RoadMapCardSize } from '@/constants/AppSettingsContext';
import { VoidCard } from '../Layout/VoidCard';
import { useHaptics } from '@/hooks/useHaptics';

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
}

const { width } = Dimensions.get('window');
const ACTION_WIDTH = 70; // Slightly larger for better touch targets

export const SwipeableHabitItem = React.memo<SwipeableHabitItemProps>(({
  habit, onPress, onEdit, onDelete, onShare, size, completed
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const swipeableRef = useRef<Swipeable>(null);
  const router = useRouter();
  const { lightFeedback, selectionFeedback, mediumFeedback } = useHaptics();

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
        {onShare && (
          <RectButton
            style={[styles.rightAction, { backgroundColor: '#3B82F6' }]}
            onPress={() => { selectionFeedback(); close(); onShare(habit); }}
          >
            <Animated.View style={[styles.actionContent, { transform: [{ scale }, { translateX: Animated.multiply(trans, 0.1) }] }]}>
              <Ionicons name="share-outline" size={20} color="white" />
            </Animated.View>
          </RectButton>
        )}
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
      >
        <VoidCard
          intensity={40} // Lighter glass for items
          style={[
            styles.card,
            isCompleted && { opacity: 0.7 },
            { paddingVertical: paddingV }
          ]}
        >
          {/* Checkbox / Hit Area */}
          <View style={[styles.checkbox, { width: checkboxSize, height: checkboxSize, borderRadius: checkboxSize / 2 }, isCompleted && { backgroundColor: colors.success, borderColor: colors.success }]}>
            {isCompleted && <Ionicons name="checkmark" size={checkboxSize * 0.7} color="black" />}
          </View>

          {/* Icon */}
          <View style={[styles.iconContainer, { width: iconBoxSize, height: iconBoxSize }, { backgroundColor: isCompleted ? 'rgba(34, 197, 94, 0.1)' : (habit.color || '#8B5CF6') + '15' }]}>
            <Ionicons name={(habit.icon as any) || 'ellipse-outline'} size={iconSize} color={isCompleted ? colors.success : habit.color || colors.textSecondary} />
          </View>

          {/* Text Info */}
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { fontSize, color: colors.textPrimary, textDecorationLine: isCompleted ? 'line-through' : 'none' }]} numberOfLines={1}>{habit.name}</Text>
            {(habit.streak && habit.streak > 0 && !isSmall) ? ( // Hide streak on small if crowded, or just keep it small
              <Text style={[styles.streakText, { color: '#F59E0B' }]}>🔥 {habit.streak}</Text>
            ) : null}
          </View>

          {/* Time (Compact) */}
          <View>
            <Text style={[styles.timeText, { color: colors.textTertiary, fontSize: isSmall ? 9 : 11 }]}>{habit.startTime || '--:--'}</Text>
          </View>

        </VoidCard>
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
