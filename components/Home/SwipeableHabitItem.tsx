import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Dimensions } from 'react-native';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { Habit as BaseHabit } from '@/lib/habits';
import { useRouter } from 'expo-router';

interface Habit extends BaseHabit {
  completed?: boolean;
  streak?: number;
}

interface SwipeableHabitItemProps {
  habit: Habit;
  onPress: (habit: Habit) => void;  // Mark complete
  onEdit: (habit: Habit) => void;
  onDelete: (habit: Habit) => void;
  onShare?: (habit: Habit) => void;
}

const { width } = Dimensions.get('window');
const ACTION_WIDTH = 70;

export const SwipeableHabitItem: React.FC<SwipeableHabitItemProps> = ({
  habit, onPress, onEdit, onDelete, onShare
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const swipeableRef = useRef<Swipeable>(null);
  const router = useRouter();

  const close = () => swipeableRef.current?.close();

  // Right swipe (swipe left gesture) - Opens habit detail page
  const renderLeftActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const trans = dragX.interpolate({
      inputRange: [0, 50, 100],
      outputRange: [-20, 0, 0],
      extrapolate: 'clamp',
    });

    return (
      <RectButton
        style={[styles.leftAction, { backgroundColor: colors.primary }]}
        onPress={() => {
          close();
          router.push({ pathname: '/habit-detail', params: { habitId: habit.id } });
        }}
      >
        <Animated.View style={[styles.actionContent, { transform: [{ translateX: trans }] }]}>
          <Ionicons name="open-outline" size={20} color="white" />
          <Text style={styles.actionText}>View</Text>
        </Animated.View>
      </RectButton>
    );
  };

  // Left swipe (swipe right gesture) - Share, Edit, Delete
  const renderRightActions = () => {
    return (
      <View style={styles.rightActionsContainer}>
        {onShare && (
          <RectButton
            style={[styles.rightAction, { backgroundColor: '#3B82F6' }]}
            onPress={() => { close(); onShare(habit); }}
          >
            <View style={styles.actionContent}>
              <Ionicons name="share-outline" size={20} color="white" />
              <Text style={styles.actionText}>Share</Text>
            </View>
          </RectButton>
        )}
        <RectButton
          style={[styles.rightAction, { backgroundColor: '#F59E0B' }]}
          onPress={() => { close(); onEdit(habit); }}
        >
          <View style={styles.actionContent}>
            <Ionicons name="pencil" size={20} color="white" />
            <Text style={styles.actionText}>Edit</Text>
          </View>
        </RectButton>
        <RectButton
          style={[styles.rightAction, { backgroundColor: '#EF4444' }]}
          onPress={() => { close(); onDelete(habit); }}
        >
          <View style={styles.actionContent}>
            <Ionicons name="trash" size={20} color="white" />
            <Text style={styles.actionText}>Delete</Text>
          </View>
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
      overshootRight={false}
      friction={2}
      containerStyle={styles.swipeableContainer}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onPress(habit)}  // Mark complete on tap
        style={styles.cardWrapper}
      >
        <View style={[styles.card, { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: habit.completed ? 'rgba(0, 255, 148, 0.2)' : 'rgba(255,255,255,0.06)' }]}>
          <View style={[styles.iconContainer, { backgroundColor: habit.completed ? 'rgba(0, 255, 148, 0.1)' : (habit.color || '#8B5CF6') + '15' }]}>
            <Ionicons name={(habit.icon as any) || 'ellipse-outline'} size={16} color={habit.completed ? colors.success : habit.color || colors.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.textPrimary, textDecorationLine: habit.completed ? 'line-through' : 'none', opacity: habit.completed ? 0.6 : 1 }]} numberOfLines={1}>{habit.name}</Text>
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
  swipeableContainer: {
    marginBottom: 6,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardWrapper: {
    backgroundColor: '#0a0d14',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftAction: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 24,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
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
  actionText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
});
