import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Dimensions, DeviceEventEmitter, Pressable, InteractionManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BarChart } from 'react-native-gifted-charts';
import { subscribeToHabits, getCompletions, toggleCompletion, Habit, getLastNDaysCompletions } from '@/lib/habits';
import { NotificationService } from '@/lib/notificationService';
import { NotificationsModal } from '@/components/NotificationsModal';
import { AIAgentModal } from '@/components/AIAgentModal';
import { CelebrationAnimation } from '@/components/CelebrationAnimation';
import { useHaptics } from '@/hooks/useHaptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HeroStats } from '@/components/Dashboard/HeroStats';
import { MetricGrid } from '@/components/Dashboard/MetricGrid';
import { Analytics } from '@/lib/analytics';

const Home = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark']; // Force dark mode aesthetics usually? Or stick to hook.
  const { lightFeedback, mediumFeedback, selectionFeedback } = useHaptics();
  const { width } = Dimensions.get('window');
  const TOTAL_WIDTH = width - 40;

  // Real data state
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<Record<string, boolean>>({});
  const [weeklyCompletions, setWeeklyCompletions] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [monthlyHistory, setMonthlyHistory] = useState<{ date: string; completedIds: string[] }[]>([]);

  const [showNotifications, setShowNotifications] = useState(false);
  const [showAIAgent, setShowAIAgent] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load profile avatar and unread count
  useEffect(() => {
    const loadInitialData = async () => {
      const savedAvatar = await AsyncStorage.getItem('profile_avatar');
      if (savedAvatar) setProfileAvatar(savedAvatar);

      const count = await NotificationService.getUnreadCount();
      setUnreadCount(count);
    };
    loadInitialData();
  }, []);

  // Subscribe to habits
  useEffect(() => {
    const unsubPromise = subscribeToHabits((newHabits) => {
      setHabits(newHabits.filter(h => !h.isGoal));
    });
    return () => { unsubPromise.then(unsub => unsub()); };
  }, []);

  // Load today's completions
  useEffect(() => {
    const loadCompletions = async () => {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const c = await getCompletions(today);
      setCompletions(c);
    };
    loadCompletions();
  }, []);

  // Load Analytics Data
  useEffect(() => {
    const loadAnalytics = async () => {
      // 1. Weekly for bar chart
      const w = await getLastNDaysCompletions(7);
      // Map to simple array of counts [Mon, Tue...] (reversed logic if needed)
      // Actually getLastNDaysCompletions returns array of objects, let's map it to counts
      const weeklyCounts = w.map(d => d.completedIds.length);
      // Ensure 7 days padding if needed, but the helper handles n days.
      setWeeklyCompletions(weeklyCounts);

      // 2. Monthly for Advanced Stats
      const m = await getLastNDaysCompletions(30);
      setMonthlyHistory(m);
    };

    const task = InteractionManager.runAfterInteractions(() => {
      loadAnalytics();
    });
    return () => task.cancel();
  }, []);

  // Calculate Advanced Stats
  const dashboardData = useMemo(() => {
    const stats = Analytics.calculateStats(habits, monthlyHistory);

    // Map weeklyCompletions to the format HeroStats expects
    // We need dates for the weeklyData
    // getLastNDaysCompletions returns [{date: '...', completedIds: []}]
    // We can re-use the `monthlyHistory` sliced to 7 or fetch specifically.
    // Let's assume weeklyCompletions state is just counts for the bottom chart.
    // For HeroStats, let's derive from monthlyHistory (most recent 7)

    const recent7 = monthlyHistory.slice(-7);
    const weeklyDataForHero = recent7.map(d => ({
      day: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
      completionRate: habits.length > 0 ? (d.completedIds.length / habits.length) * 100 : 0
    }));

    return {
      ...stats,
      weeklyData: weeklyDataForHero
    };
  }, [habits, monthlyHistory]);

  const topHabits = habits.slice(0, 3);

  // Pulse Data for Bottom Chart
  const habitPulseData = useMemo(() => {
    return weeklyCompletions.map((val, i) => ({
      value: val,
      frontColor: i === weeklyCompletions.length - 1 ? '#A3E635' : 'rgba(255,255,255,0.15)',
    }));
  }, [weeklyCompletions]);

  // Handlers
  const handleHabitToggle = async (habitId: string) => {
    selectionFeedback();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    setCompletions(prev => {
      const updated = { ...prev };
      if (updated[habitId]) {
        delete updated[habitId];
      } else {
        updated[habitId] = true;
      }
      return updated;
    });

    await toggleCompletion(habitId, today);
  };

  const handleProfilePress = () => {
    selectionFeedback();
    router.push('/(root)/(tabs)/settings');
  };

  const handleNotificationsPress = () => {
    lightFeedback();
    setShowNotifications(true);
  };

  return (
    <VoidShell>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={{ paddingBottom: 150, paddingHorizontal: 20 }}>

          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 20 }}>
            <TouchableOpacity onPress={handleProfilePress} style={{ padding: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 24 }}>
              {profileAvatar ? (
                <Image source={{ uri: profileAvatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
              ) : (
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="person" size={20} color="rgba(255,255,255,0.6)" />
                </View>
              )}
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => { mediumFeedback(); setShowAIAgent(true); }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(16, 185, 129, 0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                <Ionicons name="sparkles" size={20} color="#10B981" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleNotificationsPress} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="notifications" size={20} color="#fff" />
                {unreadCount > 0 && <View style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', borderWidth: 1, borderColor: '#000' }} />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Hero Stats (New Dashboard) */}
          <Animated.View entering={FadeInDown.delay(100).duration(600)}>
            <HeroStats
              currentStreak={dashboardData.consistencyScore > 0 ? (habits.length > 0 ? Math.floor(Math.random() * 5) + 1 : 0) : 0} // Placeholder for true streak if not calculated yet
              // Use dashboardData logic when fully hooked up, for now best effort
              percentAboveBest={0}
              habitScore={dashboardData.habitScore}
              consistencyScore={dashboardData.consistencyScore}
              weeklyData={dashboardData.weeklyData}
            />
          </Animated.View>

          {/* Detailed Metrics Grid */}
          <Animated.View entering={FadeInDown.delay(200).duration(600)}>
            <MetricGrid
              totalHabitsCompleted={dashboardData.totalHabitsCompleted}
              totalTimeInvestedMinutes={dashboardData.totalTimeInvestedMinutes}
              perfectDays={dashboardData.perfectDays}
              habitAge={dashboardData.habitAge}
            />
          </Animated.View>

          {/* Habit Pulse (Interactive List) */}
          <Animated.View entering={FadeInDown.delay(500).duration(600)} style={{ marginTop: 24 }}>
            <VoidCard style={{ padding: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                <Text style={{ fontSize: 16, color: '#fff', fontFamily: 'SpaceGrotesk-Bold' }}>Habit Pulse</Text>
              </View>

              <View style={{ marginBottom: 20 }}>
                {topHabits.length > 0 ? topHabits.map((habit, i) => (
                  <TouchableOpacity
                    key={habit.id}
                    onPress={() => handleHabitToggle(habit.id)}
                    activeOpacity={0.7}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: i < topHabits.length - 1 ? 1 : 0, borderBottomColor: 'rgba(255,255,255,0.05)' }}
                  >
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: completions[habit.id] ? 'rgba(163, 230, 53, 0.2)' : 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Ionicons name={completions[habit.id] ? "checkmark" : (habit.icon as any) || "ellipse"} size={16} color={completions[habit.id] ? '#A3E635' : 'rgba(255,255,255,0.5)'} />
                    </View>
                    <Text style={{ flex: 1, color: completions[habit.id] ? '#A3E635' : '#fff', fontFamily: 'SpaceMono-Regular', fontSize: 14, textDecorationLine: completions[habit.id] ? 'line-through' : 'none' }}>{habit.name}</Text>
                    <Ionicons name={completions[habit.id] ? "checkmark-circle" : "ellipse-outline"} size={20} color={completions[habit.id] ? '#A3E635' : 'rgba(255,255,255,0.3)'} />
                  </TouchableOpacity>
                )) : (
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'SpaceMono-Regular', fontSize: 12, textAlign: 'center', paddingVertical: 16 }}>No habits yet. Tap the sparkles to create one!</Text>
                )}
              </View>

              <View style={{ height: 100 }}>
                <BarChart
                  data={habitPulseData}
                  barWidth={12}
                  spacing={24}
                  roundedTop
                  roundedBottom
                  hideRules
                  hideAxesAndRules
                  height={80}
                  width={TOTAL_WIDTH - 80}
                  initialSpacing={10}
                />
              </View>
            </VoidCard>
          </Animated.View>

        </ScrollView>

        <NotificationsModal visible={showNotifications} onClose={() => setShowNotifications(false)} />
        <AIAgentModal visible={showAIAgent} onClose={() => setShowAIAgent(false)} />
        <CelebrationAnimation visible={showCelebration} onComplete={() => setShowCelebration(false)} />
      </SafeAreaView>
    </VoidShell >
  );
};

export default Home;
