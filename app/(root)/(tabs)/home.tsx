import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Dimensions, DeviceEventEmitter } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import { subscribeToHabits, getCompletions, toggleCompletion, Habit } from '@/lib/habits';
import { NotificationService } from '@/lib/notificationService';
import { NotificationsModal } from '@/components/NotificationsModal';
import { AIAgentModal } from '@/components/AIAgentModal';
import { CelebrationAnimation } from '@/components/CelebrationAnimation';
import { useAppSettings } from '@/constants/AppSettingsContext';
import { useHaptics } from '@/hooks/useHaptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Home = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();

  const { hapticsEnabled } = useAppSettings(); // Keep internal state sync? Or remove if unused.
  const { lightFeedback, mediumFeedback, selectionFeedback } = useHaptics();
  const { width } = Dimensions.get('window');
  const GAP = 12;
  const PADDING = 20;
  const TOTAL_WIDTH = width - (PADDING * 2);
  const HALF_WIDTH = (TOTAL_WIDTH - GAP) / 2;

  // Real data state
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<Record<string, boolean>>({});
  const [weeklyCompletions, setWeeklyCompletions] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
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

      // Load real unread count
      const count = await NotificationService.getUnreadCount();
      setUnreadCount(count);
    };
    loadInitialData();
  }, []);

  // Subscribe to habits
  useEffect(() => {
    const unsubPromise = subscribeToHabits((newHabits) => {
      setHabits(newHabits.filter(h => !h.isGoal)); // Filter out goals, keep habits
    });
    return () => { unsubPromise.then(unsub => unsub()); };
  }, []);

  // Load today's completions
  useEffect(() => {
    const loadCompletions = async () => {
      // Use local date format
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const c = await getCompletions(today);
      setCompletions(c);
    };
    loadCompletions();
  }, []);

  // Load weekly completions for chart
  useEffect(() => {
    const loadWeeklyData = async () => {
      const weekData: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        // Use local date format
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const dayCompletions = await getCompletions(dateStr);
        weekData.push(Object.keys(dayCompletions).length);
      }
      setWeeklyCompletions(weekData);
    };
    loadWeeklyData();
  }, [completions]); // Re-run when completions change for instant updates

  // Computed metrics
  const todaysHabits = habits.length;
  const completedToday = Object.keys(completions).filter(id => completions[id]).length;
  const progressPercent = todaysHabits > 0 ? Math.round((completedToday / todaysHabits) * 100) : 0;

  // Generate chart data from weekly completions
  const habitPulseData = useMemo(() => {
    const maxVal = Math.max(...weeklyCompletions, 1);
    return weeklyCompletions.map((val, i) => ({
      value: val,
      frontColor: i === 6 ? '#A3E635' : 'rgba(255,255,255,0.15)',
      topLabelComponent: i === 6 ? () => (
        <Text style={{ color: '#A3E635', fontSize: 10, marginBottom: 4 }}>{val}</Text>
      ) : undefined,
    }));
  }, [weeklyCompletions]);

  const weeklyTrendData = useMemo(() => {
    return weeklyCompletions.map(val => ({ value: val }));
  }, [weeklyCompletions]);

  // Calculate additional metrics
  const weeklyTotal = useMemo(() => weeklyCompletions.reduce((a, b) => a + b, 0), [weeklyCompletions]);

  const consistencyScore = useMemo(() => {
    if (todaysHabits === 0) return 0;
    const possibleTotal = todaysHabits * 7;
    return Math.round((weeklyTotal / possibleTotal) * 100);
  }, [weeklyTotal, todaysHabits]);

  const currentStreak = useMemo(() => {
    // Calculate streak from weekly completions (consecutive days with completions)
    let streak = 0;
    for (let i = weeklyCompletions.length - 1; i >= 0; i--) {
      if (weeklyCompletions[i] > 0) streak++;
      else break;
    }
    return streak;
  }, [weeklyCompletions]);

  const bestDayCount = useMemo(() => Math.max(...weeklyCompletions, 0), [weeklyCompletions]);

  // Day labels for chart
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const today = new Date().getDay();
  const orderedLabels = useMemo(() => {
    // Shift so today is last
    const arr = [...dayLabels];
    const shifted = [];
    for (let i = 0; i < 7; i++) {
      const idx = (today + i) % 7;
      shifted.push(arr[idx === 0 ? 6 : idx - 1]); // Adjust for Sunday = 0
    }
    return shifted;
  }, [today]);

  // Top 3 habits for display
  const topHabits = habits.slice(0, 3);

  // Dynamic motivational text based on progress
  const getMotivationalText = (percent: number, completed: number, total: number): string => {
    if (total === 0) return "Ready to start your journey?";
    if (percent >= 100) return "🎉 You crushed it today!";
    if (percent >= 75) return `Almost there! Just ${total - completed} more to go!`;
    if (percent >= 50) return `You're halfway there! Keep the momentum!`;
    if (percent >= 25) return `Great start! ${completed} down, ${total - completed} to go!`;
    if (completed > 0) return `Good progress! ${completed} habit${completed > 1 ? 's' : ''} done!`;
    return "Let's build some habits today!";
  };

  // Handle habit toggle from Habit Pulse
  const handleHabitToggle = async (habitId: string) => {
    selectionFeedback();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Optimistic update - toggle immediately in local state
    setCompletions(prev => {
      const updated = { ...prev };
      if (updated[habitId]) {
        delete updated[habitId];
      } else {
        updated[habitId] = true;
      }
      return updated;
    });

    // Call API (this also updates the cache optimistically)
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
            <TouchableOpacity
              onPress={handleProfilePress}
              style={{ padding: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 24 }}
            >
              {profileAvatar ? (
                <Image
                  source={{ uri: profileAvatar }}
                  style={{ width: 40, height: 40, borderRadius: 20 }}
                />
              ) : (
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="person" size={20} color="rgba(255,255,255,0.6)" />
                </View>
              )}
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  mediumFeedback();
                  setShowAIAgent(true);
                }}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(16, 185, 129, 0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                <Ionicons name="sparkles" size={20} color="#10B981" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleNotificationsPress}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="notifications" size={20} color="#fff" />
                {unreadCount > 0 && (
                  <View style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', borderWidth: 1, borderColor: '#000' }} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Hero: Progress */}
          <Animated.View entering={FadeInDown.delay(100).duration(600)}>
            <View style={{ marginBottom: 4 }}>
              <Text style={{ fontSize: 16, color: '#fff', fontFamily: 'SpaceGrotesk-Bold' }}>
                {getMotivationalText(progressPercent, completedToday, todaysHabits)}
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', fontFamily: 'SpaceGrotesk-Bold' }}>
                  {completedToday}/{todaysHabits} habits today
                </Text>
                <Text style={{ fontSize: 32, color: '#fff', fontFamily: 'SpaceGrotesk-Bold' }}>{progressPercent}%</Text>
              </View>
            </View>

            <View style={{ height: 48, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 24, padding: 4, flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
              {/* Segmented Progress Gradient */}
              <LinearGradient
                colors={['#2DD4BF', '#A3E635']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ flex: progressPercent / 100, height: '100%', borderRadius: 20, overflow: 'hidden' }}
              >
                {/* Texture Overlay for segments */}
                <View style={{ flexDirection: 'row', flex: 1 }}>
                  {[...Array(Math.max(1, Math.round(progressPercent / 3)))].map((_, i) => (
                    <View key={i} style={{ flex: 1, borderRightWidth: 2, borderRightColor: 'rgba(0,0,0,0.2)', transform: [{ skewX: '-20deg' }] }} />
                  ))}
                </View>
              </LinearGradient>
              {/* Remaining Dark Segments */}
              {progressPercent < 100 && (
                <View style={{ flex: (100 - progressPercent) / 100, height: '100%', borderRadius: 20, overflow: 'hidden', marginLeft: 4, backgroundColor: 'rgba(0,0,0,0.2)' }}>
                  <View style={{ flexDirection: 'row', flex: 1 }}>
                    {[...Array(Math.max(1, Math.round((100 - progressPercent) / 10)))].map((_, i) => (
                      <View key={i} style={{ flex: 1, borderRightWidth: 2, borderRightColor: 'rgba(255,255,255,0.05)', transform: [{ skewX: '-20deg' }] }} />
                    ))}
                  </View>
                </View>
              )}
            </View>
          </Animated.View>

          {/* Row 1: Habits Completed Tile */}
          <Animated.View entering={FadeInDown.delay(200).duration(600)}>
            <VoidCard style={{ padding: 20, height: 120, marginBottom: GAP, justifyContent: 'space-between' }}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <Text style={{ fontSize: 32, color: '#fff', fontFamily: 'SpaceGrotesk-Bold' }}>{completedToday}</Text>
                  <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.5)', fontFamily: 'SpaceGrotesk-Bold' }}>/{todaysHabits}</Text>
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'SpaceMono-Regular', fontSize: 12 }}>Habits Completed - Today</Text>
              </View>

              <View style={{ position: 'absolute', right: 20, top: 32 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 4, borderColor: progressPercent >= 100 ? '#A3E635' : '#2DD4BF', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={progressPercent >= 100 ? "checkmark" : "fitness"} size={24} color={progressPercent >= 100 ? '#A3E635' : '#2DD4BF'} />
                </View>
              </View>
            </VoidCard>
          </Animated.View>

          {/* Row 2: Split Tiles */}
          <View style={{ flexDirection: 'row', gap: GAP, marginBottom: GAP }}>
            {/* Green Tile (Streak / Goals) */}
            <Animated.View entering={FadeInDown.delay(300).duration(600)}>
              <LinearGradient
                colors={['#2DD4BF', '#10B981']}
                style={{ width: HALF_WIDTH, height: 160, borderRadius: 24, padding: 16, justifyContent: 'space-between' }}
              >
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    <Text style={{ fontSize: 24, color: '#fff', fontFamily: 'SpaceGrotesk-Bold' }}>{habits.filter(h => h.isGoal).length || weeklyCompletions[6]}</Text>
                    <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginLeft: 4, fontFamily: 'SpaceMono-Regular' }}>today</Text>
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'SpaceMono-Regular', fontSize: 12 }}>Completions</Text>
                </View>

                {/* Simple Bar Chart Simulation from weekly data */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 60, gap: 4, justifyContent: 'space-between' }}>
                  {weeklyCompletions.map((val, i) => {
                    const maxVal = Math.max(...weeklyCompletions, 1);
                    const h = val / maxVal;
                    return (
                      <View key={i} style={{ flex: 1, backgroundColor: i === 6 ? '#fff' : 'rgba(255,255,255,0.3)', height: `${h * 80}%`, borderRadius: 2 }} />
                    );
                  })}
                </View>
              </LinearGradient>
            </Animated.View>

            {/* Graph Tile (Weekly Trend) */}
            <Animated.View entering={FadeInDown.delay(400).duration(600)}>
              <VoidCard style={{ width: HALF_WIDTH, height: 160, padding: 16, justifyContent: 'space-between' }}>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    <Text style={{ fontSize: 24, color: '#fff', fontFamily: 'SpaceGrotesk-Bold' }}>{weeklyCompletions.reduce((a, b) => a + b, 0)}</Text>
                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginLeft: 4, fontFamily: 'SpaceMono-Regular' }}>this week</Text>
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'SpaceMono-Regular', fontSize: 12 }}>Weekly trend</Text>
                </View>

                {/* Wave Graph */}
                <View style={{ height: 60, marginLeft: -10, marginBottom: -10 }}>
                  <LineChart
                    data={weeklyTrendData}
                    hideRules
                    hideAxesAndRules
                    hideDataPoints={false}
                    curved
                    color="#A3E635"
                    thickness={2}
                    height={60}
                    width={HALF_WIDTH - 20}
                    initialSpacing={0}
                    dataPointsColor="#A3E635"
                    dataPointsRadius={3}
                  />
                </View>
              </VoidCard>
            </Animated.View>
          </View>

          {/* Row 3: Streak & Consistency */}
          <View style={{ flexDirection: 'row', gap: GAP, marginBottom: GAP }}>
            {/* Streak Tile - Orange/Flame Theme */}
            <Animated.View entering={FadeInDown.delay(450).duration(600)}>
              <LinearGradient
                colors={['#F97316', '#DC2626']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: HALF_WIDTH, height: 100, borderRadius: 24, padding: 16, justifyContent: 'space-between' }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View>
                    <Text style={{ fontSize: 32, color: '#fff', fontFamily: 'SpaceGrotesk-Bold' }}>{currentStreak}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.85)', fontFamily: 'SpaceMono-Regular', fontSize: 11 }}>DAY STREAK</Text>
                  </View>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 16 }}>
                    <Ionicons name="flame" size={24} color="#fff" />
                  </View>
                </View>
              </LinearGradient>
            </Animated.View>

            {/* Consistency Score - Purple Theme */}
            <Animated.View entering={FadeInDown.delay(500).duration(600)}>
              <LinearGradient
                colors={['#8B5CF6', '#6366F1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: HALF_WIDTH, height: 100, borderRadius: 24, padding: 16, justifyContent: 'space-between' }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                      <Text style={{ fontSize: 32, color: '#fff', fontFamily: 'SpaceGrotesk-Bold' }}>{consistencyScore}</Text>
                      <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.8)', fontFamily: 'SpaceGrotesk-Bold' }}>%</Text>
                    </View>
                    <Text style={{ color: 'rgba(255,255,255,0.85)', fontFamily: 'SpaceMono-Regular', fontSize: 11 }}>CONSISTENCY</Text>
                  </View>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 16 }}>
                    <Ionicons name="pulse" size={24} color="#fff" />
                  </View>
                </View>
              </LinearGradient>
            </Animated.View>
          </View>

          {/* Row 4: Best Day & Weekly Count */}
          <View style={{ flexDirection: 'row', gap: GAP, marginBottom: GAP }}>
            {/* Best Day */}
            <Animated.View entering={FadeInDown.delay(550).duration(600)}>
              <VoidCard style={{ width: HALF_WIDTH, height: 90, padding: 16, justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View>
                    <Text style={{ fontSize: 28, color: '#2DD4BF', fontFamily: 'SpaceGrotesk-Bold' }}>{bestDayCount}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'SpaceMono-Regular', fontSize: 11 }}>BEST DAY</Text>
                  </View>
                  <Ionicons name="trophy" size={22} color="#2DD4BF" />
                </View>
              </VoidCard>
            </Animated.View>

            {/* Weekly Total */}
            <Animated.View entering={FadeInDown.delay(600).duration(600)}>
              <VoidCard style={{ width: HALF_WIDTH, height: 90, padding: 16, justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View>
                    <Text style={{ fontSize: 28, color: '#A3E635', fontFamily: 'SpaceGrotesk-Bold' }}>{weeklyTotal}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'SpaceMono-Regular', fontSize: 11 }}>WEEK TOTAL</Text>
                  </View>
                  <Ionicons name="bar-chart" size={22} color="#A3E635" />
                </View>
              </VoidCard>
            </Animated.View>
          </View>

          {/* Bottom: Habit Pulse */}
          <Animated.View entering={FadeInDown.delay(500).duration(600)}>
            <VoidCard style={{ padding: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                <Text style={{ fontSize: 16, color: '#fff', fontFamily: 'SpaceGrotesk-Bold' }}>Habit Pulse</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginRight: 4 }}>7 days</Text>
                  <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.8)" />
                </View>
              </View>

              {/* Top habits mini list */}
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

              {/* Bar Chart Bottom */}
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

        {/* Notifications Modal */}
        <NotificationsModal
          visible={showNotifications}
          onClose={() => setShowNotifications(false)}
        />

        {/* AI Agent Modal */}
        <AIAgentModal
          visible={showAIAgent}
          onClose={() => setShowAIAgent(false)}
        />

        {/* Celebration Animation */}
        <CelebrationAnimation
          visible={showCelebration}
          onComplete={() => setShowCelebration(false)}
        />
      </SafeAreaView>
    </VoidShell>
  );
};

export default Home;
