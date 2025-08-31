import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';

const { width, height } = Dimensions.get('window');

interface TimerSession {
  id: string;
  name: string;
  duration: number; // in minutes
  type: 'pomodoro' | 'short-break' | 'long-break' | 'deep-focus';
  color: string;
  icon: string;
}

const FocusTimer = () => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { lightFeedback, mediumFeedback, heavyFeedback } = useHaptics();
  
  const [currentSession, setCurrentSession] = useState<TimerSession | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0); // in seconds
  const [completedSessions, setCompletedSessions] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(4);
  const [totalFocusTime, setTotalFocusTime] = useState(0); // in minutes

  const progressAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnimation = useRef(new Animated.Value(1)).current;

  const sessions: TimerSession[] = [
    {
      id: '1',
      name: 'Pomodoro',
      duration: 25,
      type: 'pomodoro',
      color: colors.primary,
      icon: 'timer'
    },
    {
      id: '2',
      name: 'Deep Focus',
      duration: 90,
      type: 'deep-focus',
      color: colors.secondary,
      icon: 'eye'
    },
    {
      id: '3',
      name: 'Short Break',
      duration: 5,
      type: 'short-break',
      color: colors.success,
      icon: 'cafe'
    },
    {
      id: '4',
      name: 'Long Break',
      duration: 15,
      type: 'long-break',
      color: colors.accent,
      icon: 'bed'
    }
  ];

  useEffect(() => {
    let interval: number;
    
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          const newTime = prev - 1;
          
          // Update progress animation
          const progress = 1 - (newTime / (currentSession?.duration! * 60));
          Animated.timing(progressAnimation, {
            toValue: progress,
            duration: 1000,
            useNativeDriver: false,
          }).start();
          
          if (newTime <= 0) {
            heavyFeedback();
            setIsRunning(false);
            setCompletedSessions(prev => prev + 1);
            
            // Add to total focus time if it's a focus session
            if (currentSession?.type === 'pomodoro' || currentSession?.type === 'deep-focus') {
              setTotalFocusTime(prev => prev + currentSession.duration);
            }
            
            Alert.alert(
              'Session Complete!',
              `Great job! You've completed your ${currentSession?.name} session. Take a moment to celebrate your progress!`,
              [{ text: 'OK' }]
            );
            return 0;
          }
          
          return newTime;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isRunning, timeLeft, currentSession, progressAnimation, heavyFeedback]);

  const startSession = (session: TimerSession) => {
    lightFeedback();
    setCurrentSession(session);
    setTimeLeft(session.duration * 60);
    setIsRunning(true);
    
    // Animate scale
    Animated.sequence([
      Animated.timing(scaleAnimation, {
        toValue: 1.1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const toggleTimer = () => {
    if (isRunning) {
      mediumFeedback();
      setIsRunning(false);
    } else {
      lightFeedback();
      setIsRunning(true);
    }
  };

  const resetTimer = () => {
    mediumFeedback();
    setIsRunning(false);
    setTimeLeft(currentSession?.duration ? currentSession.duration * 60 : 0);
    Animated.timing(progressAnimation, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const skipSession = () => {
    lightFeedback();
    Alert.alert(
      'Skip Session',
      'Are you sure you want to skip this session? Your progress will not be counted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Skip', 
          style: 'destructive',
          onPress: () => {
            setIsRunning(false);
            setTimeLeft(0);
            Alert.alert('Session Skipped', 'Session has been skipped. Ready for the next one?');
          }
        }
      ]
    );
  };

  const handleViewStats = () => {
    lightFeedback();
    router.push('/stats');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressColor = () => {
    if (!currentSession) return colors.primary;
    return currentSession.color;
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="px-6 pt-4 pb-6">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
            Focus Timer
          </Text>
          <View className="flex-row space-x-2">
            <TouchableOpacity 
              className="w-12 h-12 rounded-2xl items-center justify-center"
              style={{ backgroundColor: colors.surfaceSecondary }}
              onPress={handleViewStats}
            >
              <Ionicons name="stats-chart" size={22} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity 
              className="w-12 h-12 rounded-2xl items-center justify-center"
              style={{ backgroundColor: colors.surfaceSecondary }}
              onPress={() => {
                lightFeedback();
                router.back();
              }}
            >
              <Ionicons name="close" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Timer Display */}
      <View className="flex-1 items-center justify-center px-6">
        {currentSession ? (
          <View className="items-center">
            {/* Progress Circle */}
            <View className="relative mb-8">
              <View 
                className="w-72 h-72 rounded-full items-center justify-center"
                style={{ backgroundColor: colors.surfaceSecondary }}
              >
                <Animated.View
                  className="absolute w-72 h-72 rounded-full"
                  style={{
                    borderWidth: 8,
                    borderColor: getProgressColor(),
                    borderTopColor: 'transparent',
                    borderLeftColor: 'transparent',
                    transform: [{ rotate: progressAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg']
                    }) }],
                  }}
                />
                <View className="items-center">
                  <Text className="text-7xl font-bold mb-3" style={{ color: colors.textPrimary }}>
                    {formatTime(timeLeft)}
                  </Text>
                  <Text className="text-xl font-bold" style={{ color: colors.textPrimary }}>
                    {currentSession.name}
                  </Text>
                  <Text className="text-base" style={{ color: colors.textSecondary }}>
                    Round {currentRound} of {totalRounds}
                  </Text>
                </View>
              </View>
            </View>

            {/* Timer Controls */}
            <View className="flex-row items-center space-x-6">
              <TouchableOpacity
                className="w-16 h-16 rounded-2xl items-center justify-center"
                style={{ backgroundColor: colors.surfaceSecondary }}
                onPress={resetTimer}
              >
                <Ionicons name="refresh" size={26} color={colors.textSecondary} />
              </TouchableOpacity>
              
              <Animated.View style={{ transform: [{ scale: scaleAnimation }] }}>
                <TouchableOpacity
                  className="w-24 h-24 rounded-2xl items-center justify-center"
                  style={{ backgroundColor: getProgressColor() }}
                  onPress={toggleTimer}
                >
                  <Ionicons 
                    name={isRunning ? 'pause' : 'play'} 
                    size={36} 
                    color="white" 
                  />
                </TouchableOpacity>
              </Animated.View>
              
              <TouchableOpacity
                className="w-16 h-16 rounded-2xl items-center justify-center"
                style={{ backgroundColor: colors.surfaceSecondary }}
                onPress={skipSession}
              >
                <Ionicons name="play-forward" size={26} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Stats */}
            <View className="mt-8 flex-row space-x-8">
              <View className="items-center">
                <Text className="text-3xl font-bold" style={{ color: colors.textPrimary }}>
                  {completedSessions}
                </Text>
                <Text className="text-sm font-medium" style={{ color: colors.textSecondary }}>
                  Completed
                </Text>
              </View>
              <View className="items-center">
                <Text className="text-3xl font-bold" style={{ color: colors.textPrimary }}>
                  {totalFocusTime}
                </Text>
                <Text className="text-sm font-medium" style={{ color: colors.textSecondary }}>
                  Minutes
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View className="items-center">
            <View className="w-36 h-36 rounded-2xl items-center justify-center mb-8"
                  style={{ backgroundColor: colors.surfaceSecondary }}>
              <Ionicons name="timer" size={56} color={colors.primary} />
            </View>
            <Text className="text-2xl font-bold mb-3" style={{ color: colors.textPrimary }}>
              Choose a Session
            </Text>
            <Text className="text-center text-base" style={{ color: colors.textSecondary }}>
              Select a focus session to begin your productivity journey
            </Text>
          </View>
        )}
      </View>

      {/* Session Types */}
      <View className="px-6 pb-8">
        <Text className="text-xl font-bold mb-4" style={{ color: colors.textPrimary }}>
          Session Types
        </Text>
        <View className="flex-row flex-wrap justify-between">
          {sessions.map((session) => (
            <TouchableOpacity
              key={session.id}
              className="w-[48%] p-5 rounded-2xl mb-4 items-center"
              style={{ 
                backgroundColor: currentSession?.id === session.id 
                  ? session.color + '20' 
                  : colors.surfaceSecondary 
              }}
              onPress={() => startSession(session)}
            >
              <View 
                className="w-16 h-16 rounded-2xl items-center justify-center mb-3"
                style={{ backgroundColor: session.color + '20' }}
              >
                <Ionicons name={session.icon as any} size={32} color={session.color} />
              </View>
              <Text className="font-bold text-base" style={{ color: colors.textPrimary }}>
                {session.name}
              </Text>
              <Text className="text-sm" style={{ color: colors.textSecondary }}>
                {session.duration} min
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
};

export default FocusTimer;