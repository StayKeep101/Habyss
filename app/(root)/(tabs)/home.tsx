import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, Dimensions, Alert, DeviceEventEmitter, Modal } from 'react-native';
import { Swipeable, RectButton, PanGestureHandler as RNGHPanGestureHandler, State } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';
import CreateModal from '@/components/CreateModal';
import { getHabits as loadHabits, getCompletions, toggleCompletion, Habit as StoreHabit, removeHabitEverywhere } from '@/lib/habits';

const { width, height } = Dimensions.get('window');

interface Habit extends StoreHabit {
  streak?: number;
  completed?: boolean;
  icon?: string;
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
  
  const [habits, setHabits] = useState<Habit[]>([]);
  const [isCreateVisible, setIsCreateVisible] = useState(false);
  const [currentDay, setCurrentDay] = useState(0);
  const scrollY = useRef(new Animated.Value(0)).current;
  const panRef = useRef(null);
  const [selectedDay, setSelectedDay] = useState<any>(null);
  const [dayModalVisible, setDayModalVisible] = useState(false);
  const [currentQuote, setCurrentQuote] = useState(0);

  const motivationalQuotes = [
    "The secret of getting ahead is getting started.",
    "Success is the sum of small efforts repeated day in and day out.",
    "The future belongs to those who believe in the beauty of their dreams.",
    "Don't watch the clock; do what it does. Keep going.",
    "The only way to do great work is to love what you do.",
    "Your limitation—it's only your imagination.",
    "Great things never come from comfort zones.",
    "Dream it. Wish it. Do it.",
    "Success doesn't just find you. You have to go out and get it.",
    "The harder you work for something, the greater you'll feel when you achieve it.",
    "Dream bigger. Do bigger.",
    "Don't stop when you're tired. Stop when you're done.",
    "Wake up with determination. Go to bed with satisfaction.",
    "Do something today that your future self will thank you for.",
    "Little things make big days.",
  ];

  const [focusSessions] = useState<FocusSession[]>([
    { id: '1', name: 'Pomodoro', duration: 25, type: 'pomodoro', isActive: false },
    { id: '2', name: 'Deep Focus', duration: 90, type: 'focus', isActive: false },
    { id: '3', name: 'Quick Break', duration: 5, type: 'break', isActive: false },
  ]);

  const [currentStreak, setCurrentStreak] = useState(0);
  const [totalHabits, setTotalHabits] = useState(0);
  const [completedHabits, setCompletedHabits] = useState(0);

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

  // Load habits and today's completions; refresh on new habit
  useEffect(() => {
    const load = async () => {
      const h = await loadHabits();
      const c = await getCompletions();
      const mapped: Habit[] = h.map(item => ({ ...item, completed: !!c[item.id], streak: 0 }));
      setHabits(mapped);
      setTotalHabits(mapped.length);
      setCompletedHabits(Object.values(c).filter(Boolean).length);
      setCurrentStreak(0);
    };
    load();
    const sub = DeviceEventEmitter.addListener('habit_created', load);
    return () => sub.remove();
  }, []);

  // Cycle through motivational quotes
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentQuote(prev => (prev + 1) % motivationalQuotes.length);
    }, 8000); // Change quote every 8 seconds

    return () => clearInterval(interval);
  }, []);

  const spin = logoRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Generate days for the path (upcoming days above, today at bottom)
  const generateDays = () => {
    const days = [];
    const today = new Date();
    
    // Future days (upcoming days above)
    for (let i = 30; i >= 1; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      days.push({
        day: -i,
        date,
        completed: false,
        isToday: false,
        isPast: false,
      });
    }
    
    // Today (at the bottom)
    days.push({
      day: 0,
      date: today,
      completed: completedHabits > 0,
      isToday: true,
      isPast: false,
    });
    
    return days;
  };

  const days = generateDays();

  const onPanGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: scrollY } }],
    { useNativeDriver: false }
  );

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationY } = event.nativeEvent;
      setCurrentDay(prev => Math.max(0, prev + Math.round(translationY / 100)));
      Animated.spring(scrollY, {
        toValue: 0,
        useNativeDriver: false,
      }).start();
    }
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const toggleHabit = async (habitId: string) => {
    lightFeedback();
    const next = await toggleCompletion(habitId);
    setHabits(prev => prev.map(h => ({ ...h, completed: !!next[h.id] })));
    setCompletedHabits(Object.values(next).filter(Boolean).length);
  };

  const handleDayPress = async (day: any) => {
    lightFeedback();
    setSelectedDay(day);
    setDayModalVisible(true);
  };

  const renderDayNode = (day: any, index: number) => {
    const isCompleted = day.completed;
    const isToday = day.isToday;
    const isFuture = day.day < 0;
    
    let nodeColor = colors.surfaceSecondary;
    let iconName = 'ellipse-outline';
    let iconColor = colors.textSecondary;
    
    if (isCompleted) {
      nodeColor = colors.success;
      iconName = 'checkmark-circle';
      iconColor = 'white';
    } else if (isToday) {
      nodeColor = colors.primary;
      iconName = 'today';
      iconColor = 'white';
    } else if (isFuture) {
      // Future days
      nodeColor = colors.surfaceSecondary;
      iconName = 'ellipse-outline';
      iconColor = colors.border;
    }
    
    return (
      <View key={index} className="items-center mb-8">
        <TouchableOpacity
          className="w-16 h-16 rounded-full items-center justify-center"
          style={{ 
            backgroundColor: nodeColor,
            shadowColor: '#000',
            shadowOpacity: 0.1,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
            elevation: 2,
          }}
          onPress={() => handleDayPress(day)}
        >
          <Ionicons name={iconName as any} size={24} color={iconColor} />
        </TouchableOpacity>
        <Text className="text-xs mt-2 font-medium" style={{ color: colors.textSecondary }}>
          {formatDate(day.date)}
        </Text>
        {isToday && (
          <Text className="text-xs mt-1" style={{ color: colors.textTertiary }}>
            {completedHabits}/{totalHabits}
          </Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="flex-1">
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
                <Text className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                  Day {currentStreak} • {completedHabits}/{totalHabits} completed
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Motivational Quotes Section */}
        <View className="px-6 mb-6">
          <Animated.View 
            className="rounded-2xl p-6"
            style={{ backgroundColor: colors.primary + '10' }}
          >
            <View className="flex-row items-center mb-3">
              <View 
                className="w-8 h-8 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: colors.primary + '20' }}
              >
                <Ionicons name="bulb" size={18} color={colors.primary} />
              </View>
              <Text className="text-sm font-semibold" style={{ color: colors.primary }}>
                Daily Inspiration
              </Text>
            </View>
            <Animated.Text 
              className="text-base leading-6"
              style={{ color: colors.textPrimary }}
            >
              "{motivationalQuotes[currentQuote]}"
            </Animated.Text>
            <View className="flex-row justify-center mt-4">
              {motivationalQuotes.map((_, index) => (
                <View
                  key={index}
                  className="w-2 h-2 rounded-full mx-1"
                  style={{ 
                    backgroundColor: index === currentQuote ? colors.primary : colors.border,
                    opacity: index === currentQuote ? 1 : 0.3
                  }}
                />
              ))}
            </View>
          </Animated.View>
        </View>

        {/* Duolingo-style Day Path */}
        <View className="flex-1 px-6">
          <RNGHPanGestureHandler
            ref={panRef}
            onGestureEvent={onPanGestureEvent}
            onHandlerStateChange={onHandlerStateChange}
          >
            <Animated.View style={{ flex: 1 }}>
              <ScrollView
                contentContainerStyle={{ paddingVertical: 20, flexGrow: 1, justifyContent: 'flex-end' }}
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={Animated.event(
                  [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                  { useNativeDriver: false }
                )}
                onContentSizeChange={(contentWidth, contentHeight) => {
                  // Auto-scroll to bottom (today) when content loads
                  setTimeout(() => {
                    // This will be handled by the ScrollView's contentContainerStyle
                  }, 100);
                }}
              >
                {days.map((day, index) => renderDayNode(day, index))}
              </ScrollView>
            </Animated.View>
          </RNGHPanGestureHandler>
        </View>
      </View>
      {/* Floating Create Button */}
      <View style={{ position: 'absolute', right: 20, bottom: 28 }}>
        <TouchableOpacity
          className="w-16 h-16 rounded-full items-center justify-center"
          style={{ backgroundColor: colors.primary, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 }}
          onPress={() => setIsCreateVisible(true)}
        >
          <Ionicons name="add" size={24} color={'white'} />
            </TouchableOpacity>
          </View>
      <CreateModal
        visible={isCreateVisible}
        onClose={() => setIsCreateVisible(false)}
      />

      {/* Day Details Modal */}
      <Modal
        visible={dayModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDayModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-center items-center px-4">
          <Animated.View 
            className="w-full max-w-sm rounded-3xl overflow-hidden"
            style={{ 
              backgroundColor: colors.background,
              shadowColor: '#000',
              shadowOpacity: 0.25,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 10 },
              elevation: 10,
            }}
          >
            {/* Header */}
            <View className="px-6 pt-6 pb-4">
              <View className="flex-row justify-between items-center mb-4">
                <View className="flex-1">
                  <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                    {selectedDay ? formatDate(selectedDay.date) : ''}
                  </Text>
                  <Text className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                    {selectedDay?.date?.toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setDayModalVisible(false)}
                  className="w-8 h-8 rounded-full items-center justify-center"
                  style={{ backgroundColor: colors.surfaceSecondary }}
                >
                  <Ionicons name="close" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              
              {/* Progress indicator */}
              {selectedDay?.isToday && (
                <View className="flex-row items-center justify-center py-3 px-4 rounded-2xl" style={{ backgroundColor: colors.primary + '10' }}>
                  <View className="flex-row items-center">
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    <Text className="ml-2 font-semibold" style={{ color: colors.primary }}>
                      {completedHabits} of {totalHabits} completed
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Content */}
            <ScrollView className="max-h-80" showsVerticalScrollIndicator={false}>
              <View className="px-6 pb-6">
                <Text className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
                  {selectedDay?.isToday ? "Today's Habits" : "Habits"}
                </Text>
                
                {habits.length > 0 ? (
                  <View className="space-y-3">
                    {habits.map((habit, index) => (
                      <TouchableOpacity
                        key={habit.id}
                        className="flex-row items-center p-4 rounded-2xl"
                        style={{ backgroundColor: colors.surfaceSecondary }}
                        onPress={() => {
                          if (selectedDay?.isToday) {
                            toggleHabit(habit.id);
                          }
                        }}
                      >
                        <View 
                          className="w-12 h-12 rounded-2xl items-center justify-center mr-4"
                          style={{ backgroundColor: colors.primary + '20' }}
                        >
                          <Ionicons 
                            name={(habit.icon as any) || 'star'} 
                            size={24} 
                            color={colors.primary} 
                          />
                        </View>
                        <View className="flex-1">
                          <Text className="font-bold text-base" style={{ color: colors.textPrimary }}>
                            {habit.name}
                          </Text>
                          <Text className="text-sm" style={{ color: colors.textSecondary }}>
                            {habit.durationMinutes ? `${habit.durationMinutes} minutes` : 'No duration set'}
                          </Text>
                        </View>
                        <View
                          className={`w-10 h-10 rounded-2xl items-center justify-center ${
                            selectedDay?.isToday ? 'border-2' : ''
                          }`}
                          style={{ 
                            borderColor: selectedDay?.isToday ? colors.border : 'transparent',
                            backgroundColor: selectedDay?.isToday ? 'transparent' : colors.surfaceSecondary
                          }}
                        >
                          {selectedDay?.isToday && habit.completed && (
                            <Ionicons name="checkmark" size={20} color={colors.success} />
                          )}
                          {!selectedDay?.isToday && (
                            <Ionicons name="time" size={20} color={colors.textTertiary} />
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View className="items-center py-12">
                    <View 
                      className="w-20 h-20 rounded-full items-center justify-center mb-4"
                      style={{ backgroundColor: colors.surfaceSecondary }}
                    >
                      <Ionicons name="calendar-outline" size={32} color={colors.textTertiary} />
                    </View>
                    <Text className="text-lg font-semibold mb-2" style={{ color: colors.textSecondary }}>
                      No habits yet
                    </Text>
                    <Text className="text-sm text-center" style={{ color: colors.textTertiary }}>
                      Create your first habit to start tracking your progress
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default Home;