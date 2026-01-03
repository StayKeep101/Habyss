import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { Habit as BaseHabit } from '@/lib/habits';
import { VoidCard } from '@/components/Layout/VoidCard';

// Extended Habit type with optional UI state
interface Habit extends BaseHabit {
  completed?: boolean;
  streak?: number;
}

interface SwipeableHabitItemProps {
  habit: Habit;
  onPress: (habit: Habit) => void;
  onEdit: (habit: Habit) => void;
  onDelete: (habit: Habit) => void;
  onFocus: (habit: Habit) => void;
  onShare?: (habit: Habit) => void;
}


export const SwipeableHabitItem: React.FC<SwipeableHabitItemProps> = ({
  habit,
  onPress,
  onEdit,
  onDelete,
  onFocus,
  onShare
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const swipeableRef = useRef<Swipeable>(null);

  const close = () => {
    swipeableRef.current?.close();
  };

  const renderLeftActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    const scale = dragX.interpolate({
      inputRange: [0, 80],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });

    return (
      <View style={{ marginBottom: 12, marginLeft: 20, justifyContent: 'center' }}>
        <TouchableOpacity
          onPress={() => { close(); onFocus(habit); }}
          style={styles.actionButton}
        >
          <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
            <Ionicons name="scan" size={24} color="#10B981" />
          </Animated.View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    const scale = dragX.interpolate({
      inputRange: [-200, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    return (
      <View style={{ flexDirection: 'row', marginBottom: 12, marginRight: 20, alignItems: 'center' }}>
        {onShare && (
          <TouchableOpacity
            onPress={() => { close(); onShare(habit); }}
            style={[styles.actionButton, { backgroundColor: 'transparent' }]}
          >
            <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
              <Ionicons name="share-social" size={24} color="#3B82F6" />
            </Animated.View>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => { close(); onEdit(habit); }}
          style={[styles.actionButton, { backgroundColor: 'transparent' }]}
        >
          <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
            <Ionicons name="settings-sharp" size={24} color="#F59E0B" />
          </Animated.View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => { close(); onDelete(habit); }}
          style={[styles.actionButton, { backgroundColor: 'transparent', marginLeft: 8 }]}
        >
          <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
            <Ionicons name="trash-bin" size={24} color="#EF4444" />
          </Animated.View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      overshootLeft={false}
      overshootRight={false}
      containerStyle={{ overflow: 'visible' }}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onPress(habit)}
        style={{ marginBottom: 12 }}
      >
        <VoidCard style={styles.cardContent}>
          <View style={[styles.iconContainer, { backgroundColor: habit.completed ? 'rgba(0, 255, 148, 0.1)' : 'rgba(255, 255, 255, 0.05)' }]}>
            <Ionicons
              name={habit.completed ? "checkmark" : "ellipse-outline"}
              size={20}
              color={habit.completed ? colors.success : colors.textTertiary}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {habit.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {habit.durationMinutes ? `${habit.durationMinutes} MIN` : 'N/A'}
              </Text>
              <View style={{ width: 1, height: 10, backgroundColor: colors.textTertiary, marginHorizontal: 8 }} />
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                STREAK: {habit.streak || 0}
              </Text>
            </View>
          </View>

          {habit.isGoal && (
            <Ionicons name="planet" size={16} color={colors.primary} style={{ opacity: 0.8 }} />
          )}
        </VoidCard>
      </TouchableOpacity>
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  title: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk-Bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    fontFamily: 'SpaceMono-Regular',
    letterSpacing: 0.5,
  },
  actionButton: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  }
});
