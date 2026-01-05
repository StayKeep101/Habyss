import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { Habit as BaseHabit } from '@/lib/habits';
import { VoidCard } from '@/components/Layout/VoidCard';

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
  habit, onPress, onEdit, onDelete, onFocus, onShare
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const swipeableRef = useRef<Swipeable>(null);

  const close = () => swipeableRef.current?.close();

  const renderLeftActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    const scale = dragX.interpolate({ inputRange: [0, 80], outputRange: [0, 1], extrapolate: 'clamp' });
    return (
      <View style={{ marginBottom: 8, marginLeft: 16, justifyContent: 'center' }}>
        <TouchableOpacity onPress={() => { close(); onFocus(habit); }} style={styles.actionButton}>
          <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
            <Ionicons name="scan" size={20} color="#10B981" />
          </Animated.View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    const scale = dragX.interpolate({ inputRange: [-200, 0], outputRange: [1, 0], extrapolate: 'clamp' });
    return (
      <View style={{ flexDirection: 'row', marginBottom: 8, marginRight: 16, alignItems: 'center' }}>
        {onShare && (
          <TouchableOpacity onPress={() => { close(); onShare(habit); }} style={styles.actionButton}>
            <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
              <Ionicons name="share-social" size={18} color="#3B82F6" />
            </Animated.View>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => { close(); onEdit(habit); }} style={styles.actionButton}>
          <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
            <Ionicons name="create" size={18} color="#F59E0B" />
          </Animated.View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { close(); onDelete(habit); }} style={styles.actionButton}>
          <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
            <Ionicons name="trash" size={18} color="#EF4444" />
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
      <TouchableOpacity activeOpacity={0.9} onPress={() => onPress(habit)} style={{ marginBottom: 6 }}>
        <View style={[styles.card, { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }]}>
          <View style={[styles.iconContainer, { backgroundColor: habit.completed ? 'rgba(0, 255, 148, 0.1)' : (habit.color || '#8B5CF6') + '15' }]}>
            <Ionicons name={(habit.icon as any) || 'ellipse-outline'} size={16} color={habit.completed ? colors.success : habit.color || colors.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>{habit.name}</Text>
            <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
              {habit.startTime || 'Any time'} {habit.streak ? ` · 🔥${habit.streak}` : ''}
            </Text>
          </View>
          <View style={[styles.checkbox, habit.completed && { backgroundColor: colors.success, borderColor: colors.success }]}>
            {habit.completed && <Ionicons name="checkmark" size={12} color="white" />}
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  iconContainer: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 1,
  },
  subtitle: {
    fontSize: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
