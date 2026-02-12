import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Dimensions, DeviceEventEmitter, InteractionManager, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { subscribeToHabits, getCompletions, toggleCompletion, calculateGoalProgress, Habit, getLastNDaysCompletions, isHabitScheduledForDate } from '@/lib/habitsSQLite';
import { NotificationService } from '@/lib/notificationService';
import { NotificationsModal } from '@/components/NotificationsModal';
import { AIAgentModal } from '@/components/AIAgentModal';
import { CelebrationAnimation } from '@/components/CelebrationAnimation';
import { useHaptics } from '@/hooks/useHaptics';
import { useSounds } from '@/hooks/useSounds';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useFocusEffect } from 'expo-router';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';
import { useAppSettings } from '@/constants/AppSettingsContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { generateGreeting, generateSmartGreeting, UserGreetingData } from '@/lib/deepseek';
import { LinearGradient } from 'expo-linear-gradient';

// Pro user motivational quotes by AI personality
const PRO_QUOTES: Record<string, string[]> = {
  mentor: [
    "Every step forward counts. Keep building.",
    "Consistency beats intensity. You've got this.",
    "Your habits are shaping your future self.",
    "Progress is progress, no matter how small.",
    "Today's discipline is tomorrow's freedom.",
  ],
  coach: [
    "Let's crush it today! 💪",
    "You're stronger than your excuses!",
    "Champions are made in the daily grind!",
    "No limits! Push through!",
    "Your potential is unlimited!",
  ],
  friend: [
    "Hey! You're doing amazing 🌟",
    "So proud of your progress!",
    "One day at a time, friend.",
    "You've got this, I believe in you!",
    "Keep going, you're inspiring!",
  ],
  minimal: [
    "Execute.",
    "Focus. Discipline. Results.",
    "Less talk. More action.",
    "Build the habit.",
    "Stay consistent.",
  ],
};

// Free user promotional messages
const FREE_PROMOS = [
  "Unlock AI coaching with Habyss Pro ✨",
  "Go Pro for personalized habit insights",
  "Pro users get smart reminders & analytics",
  "Upgrade to Pro for unlimited goals",
  "Pro: Advanced stats & AI motivation",
  "Unlock your full potential with Pro",
  "Pro users see 3x better habit retention",
  "Get AI-powered habit suggestions with Pro",
];

import { useTheme } from '@/constants/themeContext';

import { GoalsProgressBar } from '@/components/Home/GoalsProgressBar';
import { StreakCard } from '@/components/Home/StreakCard';
import { ConsistencyCard } from '@/components/Home/ConsistencyCard';
import { StreakModal } from '@/components/Home/StreakModal';
import { AnalyticsDashboard } from '@/components/Home/AnalyticsDashboard';
import { ConsistencyModal } from '@/components/Home/ConsistencyModal';
import { FocusTimeCard } from '@/components/Home/FocusTimeCard';
import { TodaysCompletionCard } from '@/components/Home/TodaysCompletionCard';
import { CompletionModal } from '@/components/Home/CompletionModal';

const Home = () => {
  const router = useRouter();
  const { theme } = useTheme();
  const colors = Colors[theme];
  const isLight = theme === 'light';
  const { colors: accentColors, primary: accentColor } = useAccentGradient();
  const { lightFeedback, mediumFeedback, selectionFeedback } = useHaptics();
  const { playComplete, playTap } = useSounds();
  const { width } = Dimensions.get('window');

  // Pro Hooks
  const { isPremium } = usePremiumStatus();
  const { aiPersonality, greetingStyle } = useAppSettings();

  // Data state
  const [allHabits, setAllHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<Record<string, boolean>>({});
  const [historyData, setHistoryData] = useState<{ date: string; completedIds: string[] }[]>([]);
  // Stats are now derived, removed explicit state
  // const [goalProgressMap, setGoalProgressMap] = useState<Record<string, number>>({});
  const [greeting, setGreeting] = useState('');

  // UI state
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAIAgent, setShowAIAgent] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [showConsistencyModal, setShowConsistencyModal] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [motivationalQuote, setMotivationalQuote] = useState('');
  const [displayedQuote, setDisplayedQuote] = useState('');

  // Generate smart greeting using user data
  const generateUserGreeting = useCallback(async () => {
    // Calculate inline stats for greeting
    const activeHabits = allHabits.filter(h => !h.isGoal && !h.isArchived);
    const scheduledForToday = activeHabits.filter(h => isHabitScheduledForDate(h, new Date()));
    const completedTodayCount = scheduledForToday.filter(h => completions[h.id]).length;

    // Simple streak calculation from history
    let currentStreak = 0;
    const sortedHistory = [...historyData].sort((a, b) => b.date.localeCompare(a.date));
    for (const day of sortedHistory) {
      if (day.completedIds && day.completedIds.length > 0) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Simple consistency (last 7 days)
    const last7Days = historyData.slice(0, 7);
    const daysWithCompletions = last7Days.filter(d => d.completedIds && d.completedIds.length > 0).length;
    const consistencyScore = last7Days.length > 0 ? Math.round((daysWithCompletions / last7Days.length) * 100) : 0;

    // Identify Best & Struggling habits (Last 7 days)
    const habitCounts: Record<string, number> = {};
    activeHabits.forEach(h => habitCounts[h.id] = 0);
    last7Days.forEach(day => {
      day.completedIds?.forEach(id => { if (habitCounts[id] !== undefined) habitCounts[id]++; });
    });

    const sortedStats = activeHabits.sort((a, b) => habitCounts[b.id] - habitCounts[a.id]);
    const bestHabitName = sortedStats.length > 0 && habitCounts[sortedStats[0].id] > 0 ? sortedStats[0].name : undefined;
    const strugglingHabitName = sortedStats.length > 1 && habitCounts[sortedStats[sortedStats.length - 1].id] < 3
      ? sortedStats[sortedStats.length - 1].name
      : undefined;

    // Gather user data for smart greeting
    const userData: UserGreetingData = {
      currentStreak,
      consistencyScore,
      todayCompleted: completedTodayCount,
      todayTotal: scheduledForToday.length,
      bestHabit: bestHabitName,
      strugglingHabit: strugglingHabitName,
      topHabit: bestHabitName, // Fallback
    };

    // ONLY call API if greetingStyle is 'ai' - otherwise use static quotes
    if (greetingStyle !== 'ai') {
      // Use static quotes - NO API CALLS
      if (isPremium) {
        const personality = aiPersonality || 'mentor';
        const quotes = PRO_QUOTES[personality] || PRO_QUOTES.mentor;
        return quotes[Math.floor(Math.random() * quotes.length)];
      } else {
        return FREE_PROMOS[Math.floor(Math.random() * FREE_PROMOS.length)];
      }
    }

    // AI mode - try smart greeting (API-powered)
    try {
      const smartGreeting = await generateSmartGreeting(aiPersonality || 'mentor', userData);
      return smartGreeting;
    } catch {
      // Fallback to static quotes on error
      if (isPremium) {
        const personality = aiPersonality || 'mentor';
        const quotes = PRO_QUOTES[personality] || PRO_QUOTES.mentor;
        return quotes[Math.floor(Math.random() * quotes.length)];
      } else {
        return FREE_PROMOS[Math.floor(Math.random() * FREE_PROMOS.length)];
      }
    }
  }, [isPremium, aiPersonality, allHabits, completions, historyData, greetingStyle]);

  // Get random quote based on pro status and AI personality (fallback)
  const getRandomQuote = useCallback(() => {
    if (isPremium) {
      const personality = aiPersonality || 'mentor';
      const quotes = PRO_QUOTES[personality] || PRO_QUOTES.mentor;
      return quotes[Math.floor(Math.random() * quotes.length)];
    } else {
      return FREE_PROMOS[Math.floor(Math.random() * FREE_PROMOS.length)];
    }
  }, [isPremium, aiPersonality]);

  // Set initial quote - use smart greeting for premium users with AI setting
  useEffect(() => {
    // Premium users with AI greeting style get smart AI-generated greetings
    if (isPremium && greetingStyle === 'ai') {
      generateUserGreeting().then(q => setMotivationalQuote(q));
    } else {
      // Non-premium users or those who prefer quotes-only
      setMotivationalQuote(getRandomQuote());
    }
  }, [isPremium, aiPersonality, greetingStyle]);

  // Typewriter animation effect - FIXED closure bug
  useEffect(() => {
    if (!motivationalQuote) return;

    setDisplayedQuote('');
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex < motivationalQuote.length) {
        const char = motivationalQuote.charAt(currentIndex);
        setDisplayedQuote(motivationalQuote.substring(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(interval);
      }
    }, 30); // 30ms per character for smooth typing effect

    return () => clearInterval(interval);
  }, [motivationalQuote]);

  // Pull-to-refresh handler - OPTIMIZED: reload all stats data here
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Generate new greeting based on preference
    if (isPremium && greetingStyle === 'ai') {
      generateUserGreeting().then(q => setMotivationalQuote(q));
    } else {
      setMotivationalQuote(getRandomQuote());
    }
    // Reload completions for today
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const completionsData = await getCompletions(today);
    setCompletions(completionsData);
    // Reload history data for accurate stats (streak, consistency, goal progress)
    const historyResult = await getLastNDaysCompletions(90);
    setHistoryData(historyResult);
    setRefreshing(false);
  }, [isPremium, greetingStyle, getRandomQuote, generateUserGreeting]);

  // Derived data
  const goals = useMemo(() => allHabits.filter(h => h.isGoal), [allHabits]);
  const habits = useMemo(() => allHabits.filter(h => !h.isGoal), [allHabits]);

  // Load initial data & Sync on Focus
  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        const savedAvatar = await AsyncStorage.getItem('profile_avatar');
        if (savedAvatar) setProfileAvatar(savedAvatar);
        const count = await NotificationService.getUnreadCount();
        setUnreadCount(count);
      };

      loadData();

      // Update greeting ONLY if premium AND using AI greeting style
      // This prevents unnecessary API calls when quotes-only is selected
      if (isPremium && greetingStyle === 'ai') {
        generateGreeting(aiPersonality).then(g => setGreeting(g));
      }
    }, [isPremium, aiPersonality, greetingStyle])
  );

  // Listen for profile avatar changes (syncs instantly when changed in settings)
  useEffect(() => {
    const avatarListener = DeviceEventEmitter.addListener('profile_avatar_changed', (uri: string) => {
      setProfileAvatar(uri);
    });
    return () => avatarListener.remove();
  }, []);

  // Subscribe to habits
  useEffect(() => {
    const unsubPromise = subscribeToHabits(setAllHabits);
    return () => { unsubPromise.then(unsub => unsub()); };
  }, []);

  // Load today's completions & subscription to global updates
  useEffect(() => {
    const loadCompletions = async () => {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const c = await getCompletions(today);
      setCompletions(c);
    };
    loadCompletions();

    // Listen for updates from other screens (Roadmap, Detail)
    const sub = DeviceEventEmitter.addListener('habit_completion_updated', ({ habitId, date, completed }) => {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // Only update if the event matches TODAY (since Home only shows today)
      if (date === todayStr) {
        setCompletions(prev => ({
          ...prev,
          [habitId]: completed
        }));
      }
    });

    return () => sub.remove();
  }, []);

  // Load history data
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(async () => {
      const data = await getLastNDaysCompletions(90);
      setHistoryData(data);
    });
    return () => task.cancel();
  }, []);

  // INSTANT: Calculate goal progress synchronously using local state (completions + historyData)
  // This avoids the network delay of 'calculateGoalProgress' after every toggle
  const goalProgressMap = useMemo(() => {
    const map: Record<string, number> = {};
    const todayStr = new Date().toISOString().split('T')[0];

    goals.forEach(goal => {
      // 1. Get linked habits
      const linked = habits.filter(h => h.goalId === goal.id && !h.isArchived);
      if (linked.length === 0) {
        map[goal.id] = 0;
        return;
      }

      // 2. Define Time Range
      const startDate = new Date(goal.startDate || goal.createdAt);
      const targetDate = goal.targetDate ? new Date(goal.targetDate) : new Date();
      // Clamp target date to today? User wanted "Progress towards deadline" usually implies full duration.
      // But for "Current Progress" visual, usually we mean completions / expected.
      // Let's stick to the logic: Valid completions in range / Expected completions in range.

      // 3. Iterate days to calculate Expected vs Actual
      let totalExpected = 0;
      let totalCompleted = 0;

      const current = new Date(startDate);
      // Safety break
      if (current > targetDate) {
        map[goal.id] = 0;
        return;
      }

      // Optimization: Convert habit details to faster lookup
      // const habitActiveRanges = linked.map... 

      while (current <= targetDate) {
        const dateStr = current.toISOString().split('T')[0];
        const dayName = current.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();

        linked.forEach(habit => {
          // Check scheduling
          const hCreated = new Date(habit.createdAt);
          const createdStr = hCreated.toISOString().split('T')[0];

          if (dateStr >= createdStr) {
            if (habit.taskDays?.includes(dayName)) {
              totalExpected++;

              // DATA SOURCE 1: Today's local state
              if (dateStr === todayStr) {
                if (completions[habit.id]) totalCompleted++;
              }
              // DATA SOURCE 2: History (network/cache)
              else {
                const historyDay = historyData.find(d => d.date === dateStr);
                if (historyDay && historyDay.completedIds?.includes(habit.id)) {
                  totalCompleted++;
                }
              }
            }
          }
        });

        current.setDate(current.getDate() + 1);
      }

      if (totalExpected === 0) map[goal.id] = 0;
      else map[goal.id] = Math.round((totalCompleted / totalExpected) * 100);
    });

    return map;
  }, [goals, habits, historyData, completions]);

  // Average Mission Progress (Derived instantly from above)
  const avgGoalProgress = useMemo(() => {
    if (goals.length === 0) return 0;
    const sum = goals.reduce((acc, g) => acc + (goalProgressMap[g.id] || 0), 0);
    return Math.round(sum / goals.length);
  }, [goals, goals.length, goalProgressMap]);

  // Calculate streak (goal-based: streak++ if ALL habits for ANY goal completed)
  const { streak, completionTier, completedDaysPerGoal } = useMemo(() => {
    let currentStreak = 0;
    const completedDaysPerGoal: Record<string, string[]> = {};

    // Initialize
    goals.forEach(g => { completedDaysPerGoal[g.id] = []; });

    // Check each day for goal completion
    const sortedHistory = [...historyData].sort((a, b) => b.date.localeCompare(a.date));

    for (const dayData of sortedHistory) {
      let anyGoalComplete = false;

      goals.forEach(goal => {
        const goalHabits = habits.filter(h => h.goalId === goal.id);
        if (goalHabits.length === 0) return;

        const allDone = goalHabits.every(h => dayData.completedIds?.includes(h.id));
        if (allDone) {
          anyGoalComplete = true;
          completedDaysPerGoal[goal.id].push(dayData.date);
        }
      });

      if (anyGoalComplete) {
        currentStreak++;
      } else {
        break; // Streak broken
      }
    }

    // Calculate completion tier for today
    let goalsCompleteToday = 0;
    goals.forEach(goal => {
      const goalHabits = habits.filter(h => h.goalId === goal.id);
      if (goalHabits.length === 0) return;
      const allDone = goalHabits.every(h => completions[h.id]);
      if (allDone) goalsCompleteToday++;
    });

    let tier = 0;
    if (goals.length > 0) {
      const ratio = goalsCompleteToday / goals.length;
      if (ratio >= 1) tier = 4;
      else if (ratio >= 0.75) tier = 3;
      else if (ratio >= 0.5) tier = 2;
      else if (ratio >= 0.25) tier = 1;
    }

    return { streak: currentStreak, completionTier: tier, completedDaysPerGoal };
  }, [goals, habits, historyData, completions]);

  // Calculate consistency score per goal
  const { goalConsistency, avgConsistency } = useMemo(() => {
    const consistency: Record<string, number> = {};

    goals.forEach(goal => {
      const goalHabits = habits.filter(h => h.goalId === goal.id);
      if (goalHabits.length === 0) {
        consistency[goal.id] = 0;
        return;
      }

      // Find earliest habit start date
      const startDates = goalHabits.map(h => new Date(h.startDate || Date.now()));
      const earliest = new Date(Math.min(...startDates.map(d => d.getTime())));
      const today = new Date();
      const totalDays = Math.max(1, Math.ceil((today.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24)));

      // Count days where all SCHEDULED habits were completed
      let completeDays = 0;
      let scheduledDays = 0;

      historyData.forEach(day => {
        const dayDate = new Date(day.date);

        // Filter habits that were actually scheduled for this specific historical date
        const scheduledHabits = goalHabits.filter(h => isHabitScheduledForDate(h, dayDate));

        if (scheduledHabits.length > 0) {
          scheduledDays++;
          const allDone = scheduledHabits.every(h => day.completedIds?.includes(h.id));
          if (allDone) completeDays++;
        }
      });

      // Prevent division by zero if goal just started or no days scheduled yet
      consistency[goal.id] = scheduledDays > 0 ? Math.round((completeDays / scheduledDays) * 100) : 0;
    });

    const avg = goals.length > 0
      ? Math.round(goals.reduce((sum, g) => sum + (consistency[g.id] || 0), 0) / goals.length)
      : 0;

    return { goalConsistency: consistency, avgConsistency: avg };
  }, [goals, habits, historyData]);

  // Quick habits (non-goal habits for today)
  // Filter for ONLY habits scheduled for TODAY
  const topHabits = useMemo(() => {
    return habits.filter(h => isHabitScheduledForDate(h, new Date())).slice(0, 5);
  }, [habits]);

  // Handlers
  const handleHabitToggle = (habitId: string) => {
    selectionFeedback();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const wasCompleted = completions[habitId];

    // Optimistic UI update - instant!
    setCompletions(prev => {
      const updated = { ...prev };
      if (updated[habitId]) delete updated[habitId];
      else updated[habitId] = true;
      return updated;
    });

    // Play sound effect on completion
    if (!wasCompleted) {
      playComplete();
    } else {
      playTap();
    }

    // Fire and forget - don't await, let it run in background
    toggleCompletion(habitId, today).catch(console.error);
  };

  const handleProfilePress = () => {
    selectionFeedback();
    router.push('/(root)/(tabs)/settings');
  };

  return (
    <VoidShell>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 150, paddingHorizontal: 20 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >

          {/* Header Row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 20 }}>
            {/* Left: Profile */}
            <View>
              {/* Profile Avatar */}
              <TouchableOpacity onPress={() => router.push('/(root)/(tabs)/settings')} activeOpacity={0.8}>
                <LinearGradient
                  colors={accentColors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    padding: 2,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <View style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    overflow: 'hidden',
                    backgroundColor: colors.background
                  }}>
                    {profileAvatar ? (
                      <Image source={{ uri: profileAvatar }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <View style={{ flex: 1, backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="person" size={22} color={colors.textSecondary} />
                      </View>
                    )}
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Right: Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
              <TouchableOpacity onPress={() => { mediumFeedback(); setShowAIAgent(true); }} style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden' }}>
                <LinearGradient
                  colors={accentColors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="sparkles" size={18} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { lightFeedback(); setShowNotifications(true); }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="notifications" size={20} color={colors.textPrimary} />
                {unreadCount > 0 && <View style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }} />}
              </TouchableOpacity>
            </View>
          </View>

          {/* AI Greeting - Full Width Below Header */}
          {motivationalQuote ? (
            <Animated.View entering={FadeInDown.duration(400)} style={{ marginTop: 16 }}>
              <Text style={{
                fontSize: 15,
                fontWeight: '600',
                color: isPremium ? colors.text : colors.textSecondary,
                fontFamily: 'Lexend',
                textAlign: 'left',
                lineHeight: 22,
              }}>
                {displayedQuote}
                {displayedQuote.length < motivationalQuote.length && (
                  <Text style={{ color: colors.primary }}>|</Text>
                )}
              </Text>
            </Animated.View>
          ) : null}

          {/* Spacer after header */}
          <View style={{ height: 16 }} />

          {/* Goals Progress Bar */}
          <Animated.View entering={FadeInDown.delay(100).duration(500)}>
            <GoalsProgressBar
              progress={avgGoalProgress}
              goalsCount={goals.length}
              onPress={() => router.push('/goals-overview')}
            />
          </Animated.View>

          {/* 3-Column Stats Row: Streak | Consistency | Completion */}
          <Animated.View entering={FadeInDown.delay(200).duration(500)} style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <StreakCard
              streak={streak}
              completionTier={completionTier}
              onPress={() => setShowStreakModal(true)}
            />
            <ConsistencyCard
              score={avgConsistency}
              onPress={() => setShowConsistencyModal(true)}
            />
            <TodaysCompletionCard
              completedCount={habits.filter(h => !h.isArchived && isHabitScheduledForDate(h, new Date()) && completions[h.id]).length}
              totalCount={habits.filter(h => !h.isArchived && isHabitScheduledForDate(h, new Date())).length}
              onPress={() => setShowCompletionModal(true)}
            />
          </Animated.View>

          {/* Today's Focus Card - Moved Above Matrix */}
          <Animated.View entering={FadeInDown.delay(250).duration(500)} style={{ marginTop: 16 }}>
            <FocusTimeCard />
          </Animated.View>

          {/* Analytics Dashboard (Life Balance Matrix) */}
          <View style={{ marginTop: 16 }}>
            <AnalyticsDashboard habits={habits} completions={completions} history={historyData} />
          </View>

        </ScrollView>

        <StreakModal
          visible={showStreakModal}
          onClose={() => setShowStreakModal(false)}
          goals={goals}
          completedDays={completedDaysPerGoal}
          streak={streak}
        />
        <ConsistencyModal
          visible={showConsistencyModal}
          onClose={() => setShowConsistencyModal(false)}
          goals={goals}
          habits={habits} // Pass habits for graph calculation
          goalConsistency={goalConsistency}
          avgConsistency={avgConsistency}
        />
        <CompletionModal
          visible={showCompletionModal}
          onClose={() => setShowCompletionModal(false)}
          habits={allHabits}
          completions={completions}
          onToggle={handleHabitToggle}
          onEdit={(habit) => {
            setShowCompletionModal(false);
            DeviceEventEmitter.emit('show_habit_modal', { initialHabit: habit, goalId: habit.goalId });
          }}
          onDelete={(habit) => {
            Alert.alert(
              "Delete Habit",
              "Are you sure? This cannot be undone.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: async () => {
                    const { removeHabitEverywhere } = require('@/lib/habitsSQLite');
                    await removeHabitEverywhere(habit.id);
                  }
                }
              ]
            );
          }}
        />
        <NotificationsModal
          visible={showNotifications}
          onClose={async () => {
            setShowNotifications(false);
            // Refresh unread count to update badge
            const count = await NotificationService.getUnreadCount();
            setUnreadCount(count);
          }}
        />
        <AIAgentModal visible={showAIAgent} onClose={() => setShowAIAgent(false)} />
        <CelebrationAnimation visible={showCelebration} onComplete={() => setShowCelebration(false)} />
      </SafeAreaView>
    </VoidShell>
  );
};

export default Home;
