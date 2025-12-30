import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ImageBackground, Dimensions, Alert } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { HalfCircleProgress } from '@/components/Common/HalfCircleProgress';
import { RoadmapView } from '@/components/Home/RoadmapView';
import { SwipeableHabitItem } from '@/components/Home/SwipeableHabitItem';
import { subscribeToHabits, Habit, removeHabitEverywhere } from '@/lib/habits';

const GoalDetail = () => {
  const router = useRouter();
  const { goalId } = useGlobalSearchParams();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [habits, setHabits] = useState<Habit[]>([]);
  const [goal, setGoal] = useState<Habit | null>(null);
  const [bgImage] = useState<string | null>(null);

  useEffect(() => {
    const unsubPromise = subscribeToHabits((allHabits) => {
      setHabits(allHabits);
      const foundGoal = allHabits.find(h => h.id === goalId);
      if (foundGoal) {
        setGoal(foundGoal);
      }
    });
    return () => { unsubPromise.then(unsub => unsub()); };
  }, [goalId]);

  const associatedHabits = useMemo(() => {
    return habits.filter(h => h.goalId === goalId);
  }, [habits, goalId]);

  // Calculate overall progress (mock logic for now: average completion rate)
  const progress = useMemo(() => {
    if (associatedHabits.length === 0) return 0;
    // In a real app, we'd fetch completions for these habits.
    // For now, let's return a stable mock value or random for variety
    return 65; 
  }, [associatedHabits]);

  const handleEditGoal = () => {
    if (!goal) return;
    router.push({
      pathname: '/create',
      params: { 
        id: goal.id,
        name: goal.name,
        category: goal.category,
        icon: goal.icon,
        isGoal: 'true',
        targetDate: goal.targetDate
      }
    });
  };

  const handleAddHabit = () => {
    router.push({
      pathname: '/create',
      params: { goalId: goalId as string }
    });
  };

  const handleDeleteHabit = (habit: Habit) => {
    Alert.alert("Delete Habit", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => removeHabitEverywhere(habit.id) }
    ]);
  };

  if (!goal) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        
        {/* Header with Customizable Background */}
        <ImageBackground 
          source={bgImage ? { uri: bgImage } : require('@/assets/images/adaptive-icon.png')} // Default placeholder
          className="h-80 w-full justify-end pb-6"
          imageStyle={{ opacity: 0.6 }}
          style={{ backgroundColor: colors.primary + '20' }}
        >
          <SafeAreaView edges={['top']} className="absolute top-0 left-0 right-0 flex-row justify-between px-6 pt-4">
            <TouchableOpacity 
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full items-center justify-center bg-black/20"
            >
              <Ionicons name="chevron-back" size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => Alert.alert("Background", "Change background feature coming soon!")}
              className="w-10 h-10 rounded-full items-center justify-center bg-black/20"
            >
              <Ionicons name="camera" size={20} color="white" />
            </TouchableOpacity>
          </SafeAreaView>

          <View className="items-center">
            <HalfCircleProgress 
              progress={progress}
              size={180}
              strokeWidth={15}
              color={goal.color || colors.primary}
              backgroundColor="rgba(255,255,255,0.3)"
              textColor="white"
              fontSize={24}
            />
          </View>
        </ImageBackground>

        {/* Goal Info */}
        <View className="px-6 -mt-6 bg-white dark:bg-gray-900 rounded-t-[40px] pt-8">
          <View className="flex-row justify-between items-start mb-2">
            <View className="flex-1">
              <Text className="text-3xl font-bold" style={{ color: colors.textPrimary }}>{goal.name}</Text>
              <Text className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                Target: {new Date(goal.targetDate || '').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>
            <TouchableOpacity 
              onPress={handleEditGoal}
              className="p-2 rounded-full"
              style={{ backgroundColor: colors.surfaceSecondary }}
            >
              <Ionicons name="pencil" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          
          {goal.description && (
            <Text className="text-base mt-4 leading-6" style={{ color: colors.textSecondary }}>
              {goal.description}
            </Text>
          )}

          {/* Associated Habits */}
          <View className="mt-10">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold" style={{ color: colors.textPrimary }}>Associated Habits</Text>
              <TouchableOpacity 
                onPress={handleAddHabit}
                className="flex-row items-center px-3 py-1.5 rounded-full"
                style={{ backgroundColor: colors.primary + '15' }}
              >
                <Ionicons name="add" size={18} color={colors.primary} />
                <Text className="ml-1 font-bold text-xs" style={{ color: colors.primary }}>Add Habit</Text>
              </TouchableOpacity>
            </View>
            
            {associatedHabits.length > 0 ? (
              associatedHabits.map(habit => (
                <SwipeableHabitItem 
                  key={habit.id}
                  habit={habit}
                  onPress={() => router.push({ pathname: '/habit-detail', params: { habitId: habit.id } })}
                  onEdit={(h) => router.push({ 
                    pathname: '/create', 
                    params: { 
                        id: h.id, 
                        name: h.name,
                        category: h.category,
                        icon: h.icon || '',
                        duration: h.durationMinutes ? String(h.durationMinutes) : '',
                        goalId: goalId as string
                    } 
                  })}
                  onDelete={handleDeleteHabit}
                  onFocus={() => {}}
                />
              ))
            ) : (
              <View className="items-center justify-center py-8 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                <Text className="text-gray-400">No habits linked to this goal yet</Text>
              </View>
            )}
          </View>

          {/* Individual Roadmap */}
          <View className="mt-10 h-[500px]">
            <Text className="text-xl font-bold mb-6" style={{ color: colors.textPrimary }}>Goal Journey</Text>
            <RoadmapView 
              habits={associatedHabits}
              completedHabitsCount={0} // This would be dynamic
              totalHabitsCount={associatedHabits.length}
              onDayPress={(day) => console.log('Day pressed:', day)}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default GoalDetail;
