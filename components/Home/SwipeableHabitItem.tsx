import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Habit } from '@/lib/habits';

interface SwipeableHabitItemProps {
  habit: Habit;
  onPress: (habit: Habit) => void;
  onEdit: (habit: Habit) => void;
  onDelete: (habit: Habit) => void;
  onFocus: (habit: Habit) => void;
}

export const SwipeableHabitItem: React.FC<SwipeableHabitItemProps> = ({ 
  habit, 
  onPress, 
  onEdit, 
  onDelete, 
  onFocus 
}) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
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
      <View className="flex-row items-center mb-3 ml-2">
        <TouchableOpacity 
          onPress={() => { close(); onFocus(habit); }}
          className="w-16 h-full rounded-2xl items-center justify-center bg-emerald-500 mr-2"
        >
           <Animated.View style={{ transform: [{ scale }] }}>
             <Ionicons name="scan" size={24} color="white" />
             <Text className="text-white text-xs font-bold mt-1">Focus</Text>
           </Animated.View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    // Basic scaling for icons
    const scale = dragX.interpolate({
      inputRange: [-160, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    // Translation for edit button (moves normally)
    const transEdit = dragX.interpolate({
        inputRange: [-160, 0],
        outputRange: [0, 160], // Stays put or moves with drag
        extrapolate: 'clamp',
    });
    
    // Translation for delete button (expands left if dragged far)
    // When dragX goes below -160 (e.g. -300), we want the Delete button to grow or move left
    // But standard Swipeable keeps them in a container.
    // A common trick is to make the delete button width dynamic or just translate it further.
    
    // Let's make the Delete button translate more to fill space if we overshoot
    const transDelete = dragX.interpolate({
        inputRange: [-300, -160, 0],
        outputRange: [-140, 0, 160], // Moves extra left
        extrapolate: 'clamp',
    });

    return (
      <View className="flex-row items-center mb-3 mr-2 h-full w-[160px]">
        {/* Edit Button */}
        <Animated.View 
            style={{ 
                transform: [{ translateX: 0 }], 
                width: 80, 
                height: '100%',
                zIndex: 1
            }}
        >
            <TouchableOpacity 
                onPress={() => { close(); onEdit(habit); }}
                className="w-[70px] h-full rounded-2xl items-center justify-center bg-amber-500 ml-2"
            >
                <Animated.View style={{ transform: [{ scale }] }}>
                    <Ionicons name="pencil" size={24} color="white" />
                    <Text className="text-white text-xs font-bold mt-1">Edit</Text>
                </Animated.View>
            </TouchableOpacity>
        </Animated.View>
        
        {/* Delete Button - Expands */}
        <Animated.View 
            style={{ 
                transform: [{ translateX: transDelete }], 
                position: 'absolute',
                right: 0,
                width: 80, // Base width
                height: '100%',
                zIndex: 0
            }}
        >
            {/* 
               To simulate expansion, we can't easily change width of the container inside renderRightActions 
               without layout issues in Swipeable.
               However, we can make the background color fill the space if we had a background container.
               
               Alternative: Just standard buttons for now, as "expanding delete" often requires 
               custom re-implementation of Swipeable or 'overshootRight' logic that fills the space.
               
               Let's try standard behavior with overshootRight=true (default) but style the delete button 
               to look connected if we could.
               
               Actually, the user asked for "expand as I swipe left".
               The best way in standard Swipeable is to let it overshoot, and have the rightmost action 
               grow or be backed by a view that grows.
            */}
             <TouchableOpacity 
                onPress={() => { close(); onDelete(habit); }}
                className="w-full h-full rounded-2xl items-center justify-center bg-red-500 ml-2"
            >
                <Animated.View style={{ transform: [{ scale }] }}>
                    <Ionicons name="trash" size={24} color="white" />
                    <Text className="text-white text-xs font-inter-bold mt-1">Delete</Text>
                </Animated.View>
            </TouchableOpacity>
        </Animated.View>
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
      containerStyle={{ overflow: 'visible' }} // Allow shadows to show
    >
        <TouchableOpacity 
            activeOpacity={0.9}
            onPress={() => onPress(habit)}
            className="flex-row items-center p-4 mb-3 rounded-2xl shadow-sm"
            style={{ backgroundColor: colors.surfaceSecondary }}
        >
            <View className="w-12 h-12 rounded-full items-center justify-center mr-4" style={{ backgroundColor: habit.completed ? colors.success + '20' : colors.surfaceTertiary }}>
                <Ionicons 
                    name={habit.completed ? "checkmark" : "ellipse-outline"} 
                    size={24} 
                    color={habit.completed ? colors.success : colors.textTertiary} 
                />
            </View>
            <View className="flex-1">
                <Text className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                    {habit.name}
                </Text>
                <Text className="text-sm" style={{ color: colors.textSecondary }}>
                    {habit.durationMinutes ? `${habit.durationMinutes} mins` : 'No duration'} • {habit.streak || 0} day streak
                </Text>
            </View>
            {/* Optional chevron or status indicator */}
            {habit.isGoal && (
                 <Ionicons name="trophy" size={16} color={colors.warning} />
            )}
        </TouchableOpacity>
    </Swipeable>
  );
};
