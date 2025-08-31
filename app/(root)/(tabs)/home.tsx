import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');

interface Habit {
  id: string;
  name: string;
  icon: string;
  streak: number;
  completed: boolean;
  category: 'health' | 'productivity' | 'fitness' | 'mindfulness';
}

interface FocusSession {
  id: string;
  name: string;
  duration: number;
  type: 'pomodoro' | 'focus' | 'break';
  isActive: boolean;
}

const Home = () => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { lightFeedback, mediumFeedback } = useHaptics();
  
  const [habits, setHabits] = useState<Habit[]>([
    { id: '1', name: 'Morning Exercise', icon: 'fitness', streak: 7, completed: false, category: 'fitness' },
    { id: '2', name: 'Read 30 min', icon: 'book', streak: 12, completed: true, category: 'productivity' },
    { id: '3', name: 'Drink Water', icon: 'water', streak: 5, completed: false, category: 'health' },
    { id: '4', name: 'Meditate', icon: 'leaf', streak: 3, completed: false, category: 'mindfulness' },
  ]);

  const [focusSessions] = useState<FocusSession[]>([
    { id: '1', name: 'Pomodoro', duration: 25, type: 'pomodoro', isActive: false },
    { id: '2', name: 'Deep Focus', duration: 90, type: 'focus', isActive: false },
    { id: '3', name: 'Quick Break', duration: 5, type: 'break', isActive: false },
  ]);

  const [currentStreak, setCurrentStreak] = useState(12);
  const [totalHabits, setTotalHabits] = useState(habits.length);
  const [completedHabits, setCompletedHabits] = useState(habits.filter(h => h.completed).length);

  const logoScale = new Animated.Value(1);
  const logoRotation = new Animated.Value(0);

  useEffect(() => {
    // Animate logo on mount
    Animated.sequence([
      Animated.timing(logoScale, {
        toValue: 1.1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // Continuous rotation animation
    Animated.loop(
      Animated.timing(logoRotation, {
        toValue: 1,
        duration: 20000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const spin = logoRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const toggleHabit = (habitId: string) => {
    lightFeedback();
    setHabits(prev => prev.map(habit => 
      habit.id === habitId 
        ? { ...habit, completed: !habit.completed, streak: !habit.completed ? habit.streak + 1 : habit.streak }
        : habit
    ));
    
    // Update completed habits count
    setCompletedHabits(prev => {
      const habit = habits.find(h => h.id === habitId);
      return habit?.completed ? prev - 1 : prev + 1;
    });
  };

  const handleNotifications = () => {
    mediumFeedback();
    router.push('/notifications');
  };

  const handleViewAllHabits = () => {
    lightFeedback();
    router.push('/stats');
  };

  const handleQuickAction = (action: any) => {
    lightFeedback();
    
    if (action.route) {
      router.push(action.route as any);
    } else {
      // Handle specific actions
      switch (action.name) {
        case 'Journal':
          Alert.alert(
            'Journal',
            'Journal feature coming soon! You\'ll be able to write daily reflections and track your thoughts.',
            [{ text: 'OK' }]
          );
          break;
        case 'Workout':
          Alert.alert(
            'Workout Tracker',
            'Workout tracking feature coming soon! You\'ll be able to log exercises, track reps, and monitor your fitness progress.',
            [{ text: 'OK' }]
          );
          break;
        case 'Meditate':
          Alert.alert(
            'Meditation Timer',
            'Meditation timer feature coming soon! You\'ll have guided sessions, ambient sounds, and progress tracking.',
            [{ text: 'OK' }]
          );
          break;
        default:
          Alert.alert(
            action.name,
            `${action.name} feature coming soon!`,
            [{ text: 'OK' }]
          );
      }
    }
  };

  const handleFocusSession = () => {
    lightFeedback();
    router.push('/focus');
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'health': return colors.success;
      case 'productivity': return colors.primary;
      case 'fitness': return colors.warning;
      case 'mindfulness': return colors.accent;
      default: return colors.primary;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'health': return 'medical';
      case 'productivity': return 'briefcase';
      case 'fitness': return 'fitness';
      case 'mindfulness': return 'leaf';
      default: return 'star';
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header with Logo */}
        <View className="px-6 pt-4 pb-6">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Animated.View 
                style={{ 
                  transform: [{ scale: logoScale }, { rotate: spin }],
                  width: 44,
                  height: 44,
                }}
              >
                <View
                  style={{ 
                    width: 44, 
                    height: 44, 
                    borderRadius: 12,
                    backgroundColor: colors.primary
                  }}
                >
                  <View className="flex-1 items-center justify-center">
                    <Text className="text-white font-bold text-xl">H</Text>
                  </View>
                </View>
              </Animated.View>
              <View className="ml-4">
                <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                  Habyss
                </Text>
                <Text className="text-sm" style={{ color: colors.textSecondary }}>
                  Day {currentStreak} • {completedHabits}/{totalHabits} completed
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              className="w-12 h-12 rounded-2xl items-center justify-center"
              style={{ backgroundColor: colors.surfaceSecondary }}
              onPress={handleNotifications}
            >
              <Ionicons name="notifications" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Stats */}
        <View className="px-6 mb-6">
          <View
            className="rounded-3xl p-6"
            style={{ backgroundColor: colors.primary }}
          >
            <View className="flex-row justify-between items-center">
              <View>
                <Text className="text-white text-3xl font-bold">{currentStreak}</Text>
                <Text className="text-blue-100 text-sm font-medium">Day Streak</Text>
              </View>
              <View className="items-center">
                <Text className="text-white text-3xl font-bold">
                  {Math.round((completedHabits / totalHabits) * 100)}%
                </Text>
                <Text className="text-blue-100 text-sm font-medium">Today</Text>
              </View>
              <View className="items-end">
                <Text className="text-white text-3xl font-bold">24</Text>
                <Text className="text-blue-100 text-sm font-medium">Total Habits</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Focus Timer Section */}
        <View className="px-6 mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-xl font-bold" style={{ color: colors.textPrimary }}>
              Focus Sessions
            </Text>
            <TouchableOpacity onPress={handleViewAllHabits}>
              <Text className="text-sm font-medium" style={{ color: colors.primary }}>
                View All
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            {focusSessions.map((session) => (
              <TouchableOpacity
                key={session.id}
                className="mr-4 p-5 rounded-2xl min-w-[140px]"
                style={{ backgroundColor: colors.surfaceSecondary }}
                onPress={handleFocusSession}
              >
                <View className="items-center">
                  <View className="w-14 h-14 rounded-2xl items-center justify-center mb-3"
                        style={{ backgroundColor: colors.primary + '20' }}>
                    <Ionicons 
                      name={session.type === 'pomodoro' ? 'timer' : session.type === 'focus' ? 'eye' : 'cafe'} 
                      size={28} 
                      color={colors.primary} 
                    />
                  </View>
                  <Text className="font-bold text-base" style={{ color: colors.textPrimary }}>
                    {session.name}
                  </Text>
                  <Text className="text-sm" style={{ color: colors.textSecondary }}>
                    {session.duration} min
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Habits Section */}
        <View className="px-6 mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-xl font-bold" style={{ color: colors.textPrimary }}>
              Today's Habits
            </Text>
            <TouchableOpacity onPress={handleViewAllHabits}>
              <Text className="text-sm font-medium" style={{ color: colors.primary }}>
                View All
              </Text>
            </TouchableOpacity>
          </View>
          
          <View 
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: colors.surfaceSecondary }}
          >
            {habits.map((habit, index) => (
              <View key={habit.id}>
                <TouchableOpacity
                  className="flex-row items-center p-4"
                  onPress={() => toggleHabit(habit.id)}
                >
                  <View className="w-12 h-12 rounded-2xl items-center justify-center mr-4"
                        style={{ backgroundColor: getCategoryColor(habit.category) + '20' }}>
                    <Ionicons 
                      name={getCategoryIcon(habit.category) as any} 
                      size={24} 
                      color={getCategoryColor(habit.category)} 
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-base" style={{ color: colors.textPrimary }}>
                      {habit.name}
                    </Text>
                    <Text className="text-sm" style={{ color: colors.textSecondary }}>
                      {habit.streak} day streak
                    </Text>
                  </View>
                  <TouchableOpacity
                    className={`w-10 h-10 rounded-2xl items-center justify-center ${
                      habit.completed ? 'bg-green-500' : 'border-2'
                    }`}
                    style={{ 
                      borderColor: habit.completed ? 'transparent' : colors.border,
                      backgroundColor: habit.completed ? colors.success : 'transparent'
                    }}
                    onPress={() => toggleHabit(habit.id)}
                  >
                    {habit.completed && (
                      <Ionicons name="checkmark" size={20} color="white" />
                    )}
                  </TouchableOpacity>
                </TouchableOpacity>
                {index < habits.length - 1 && (
                  <View 
                    className="h-[0.5px] mx-4"
                    style={{ backgroundColor: colors.border }}
                  />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View className="px-6 mb-6">
          <Text className="text-xl font-bold mb-4" style={{ color: colors.textPrimary }}>
            Quick Actions
          </Text>
          <View className="flex-row flex-wrap justify-between">
            {[
              { name: 'Focus Timer', icon: 'timer', color: colors.primary, route: '/focus' },
              { name: 'AI Chat', icon: 'sparkles', color: colors.secondary, route: '/ai' },
              { name: 'Journal', icon: 'bookmark', color: colors.accent },
              { name: 'Workout', icon: 'fitness', color: colors.warning },
            ].map((action, index) => (
              <TouchableOpacity
                key={index}
                className="w-[48%] p-5 rounded-2xl mb-4 items-center"
                style={{ backgroundColor: colors.surfaceSecondary }}
                onPress={() => handleQuickAction(action)}
              >
                <View className="w-14 h-14 rounded-2xl items-center justify-center mb-3"
                      style={{ backgroundColor: action.color + '20' }}>
                  <Ionicons name={action.icon as any} size={28} color={action.color} />
                </View>
                <Text className="font-bold text-base" style={{ color: colors.textPrimary }}>
                  {action.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Bottom Spacing */}
        <View className="h-20" />
      </ScrollView>
    </SafeAreaView>
  );
};

export default Home;