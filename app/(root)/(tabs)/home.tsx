import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Dimensions, DeviceEventEmitter, InteractionManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { subscribeToHabits, getCompletions, toggleCompletion, calculateGoalProgress, Habit, getLastNDaysCompletions } from '@/lib/habits';
import { NotificationService } from '@/lib/notificationService';
import { NotificationsModal } from '@/components/NotificationsModal';
import { AIAgentModal } from '@/components/AIAgentModal';
import { CelebrationAnimation } from '@/components/CelebrationAnimation';
import { useHaptics } from '@/hooks/useHaptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useFocusEffect } from 'expo-router';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';
import { useAppSettings } from '@/constants/AppSettingsContext';
import { generateGreeting } from '@/lib/gemini';
import { LinearGradient } from 'expo-linear-gradient';

// New Dashboard Components
import { GoalsProgressBar } from '@/components/Home/GoalsProgressBar';
import { StreakCard } from '@/components/Home/StreakCard';
import { ConsistencyCard } from '@/components/Home/ConsistencyCard';
import { GoalsGridModal } from '@/components/Home/GoalsGridModal';
import { StreakModal } from '@/components/Home/StreakModal';
import { ConsistencyModal } from '@/components/Home/ConsistencyModal';

const Home = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const { lightFeedback, mediumFeedback, selectionFeedback } = useHaptics();
  const { width } = Dimensions.get('window');

  // Pro Hooks
  const { isPremium } = usePremiumStatus();
  const { aiPersonality } = useAppSettings();

  // Data state
  const [allHabits, setAllHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<Record<string, boolean>>({});
  const [historyData, setHistoryData] = useState<{ date: string; completedIds: string[] }[]>([]);
  const [goalProgressMap, setGoalProgressMap] = useState<Record<string, number>>({});
  const [greeting, setGreeting] = useState('');

  // UI state
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAIAgent, setShowAIAgent] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [showConsistencyModal, setShowConsistencyModal] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

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

      // Update greeting if premium
      if (isPremium) {
        generateGreeting(aiPersonality).then(g => setGreeting(g));
      }
    }, [isPremium, aiPersonality])
  );

  // Subscribe to habits
  useEffect(() => {
    const unsubPromise = subscribeToHabits(setAllHabits);
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

  // Load history data
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(async () => {
      const data = await getLastNDaysCompletions(90);
      setHistoryData(data);
    });
    return () => task.cancel();
  }, []);

  // Calculate STRICT goal progress (Historical Mission Progress)
  // This matches Goal Detail page logic
  useEffect(() => {
    const loadGoalStats = async () => {
      const map: Record<string, number> = {};
      await Promise.all(goals.map(async (g) => {
        map[g.id] = await calculateGoalProgress(g);
      }));
      setGoalProgressMap(map);
    };

    if (goals.length > 0) {
      InteractionManager.runAfterInteractions(() => {
        loadGoalStats();
      });
    }
  }, [goals]);

  // Average Mission Progress
  const avgGoalProgress = useMemo(() => {
    if (goals.length === 0) return 0;
    const sum = goals.reduce((acc, g) => acc + (goalProgressMap[g.id] || 0), 0);
    return Math.round(sum / goals.length);
  }, [goals, goalProgressMap]);

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

        const allDone = goalHabits.every(h => dayData.completedIds.includes(h.id));
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

      // Count days where all habits were completed
      let completeDays = 0;
      historyData.forEach(day => {
        const allDone = goalHabits.every(h => day.completedIds.includes(h.id));
        if (allDone) completeDays++;
      });

      consistency[goal.id] = Math.round((completeDays / totalDays) * 100);
    });

    const avg = goals.length > 0
      ? Math.round(goals.reduce((sum, g) => sum + (consistency[g.id] || 0), 0) / goals.length)
      : 0;

    return { goalConsistency: consistency, avgConsistency: avg };
  }, [goals, habits, historyData]);

  // Quick habits (non-goal habits for today)
  const topHabits = habits.slice(0, 5);

  // Handlers
  const handleHabitToggle = async (habitId: string) => {
    selectionFeedback();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    setCompletions(prev => {
      const updated = { ...prev };
      if (updated[habitId]) delete updated[habitId];
      else updated[habitId] = true;
      return updated;
    });

    await toggleCompletion(habitId, today);
  };

  const handleProfilePress = () => {
    selectionFeedback();
    router.push('/(root)/(tabs)/settings');
  };

  return (
    <VoidShell>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={{ paddingBottom: 150, paddingHorizontal: 20 }}>

          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: isPremium ? 12 : 20 }}>
            {/* Profile Avatar with Pro Ring */}
            <TouchableOpacity onPress={handleProfilePress} style={{ position: 'relative' }}>
              {isPremium && (
                <LinearGradient
                  colors={['#3B82F6', '#8B5CF6', '#EC4899']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ position: 'absolute', width: 48, height: 48, borderRadius: 24, top: -4, left: -4 }}
                />
              )}
              <View style={{
                padding: 2,
                borderWidth: isPremium ? 0 : 1,
                borderColor: 'rgba(255,255,255,0.2)',
                borderRadius: 24,
                backgroundColor: colors.background // Ensure background covers ring if needed, or transparent
              }}>
                {profileAvatar ? (
                  <Image source={{ uri: profileAvatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                ) : (
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="person" size={20} color="rgba(255,255,255,0.6)" />
                  </View>
                )}
              </View>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => { mediumFeedback(); setShowAIAgent(true); }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(16, 185, 129, 0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                <Ionicons name="sparkles" size={20} color="#10B981" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { lightFeedback(); setShowNotifications(true); }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="notifications" size={20} color="#fff" />
                {unreadCount > 0 && <View style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }} />}
              </TouchableOpacity>
            </View>
          </View>

          {/* AI Greeting (Pro Only) */}
          {isPremium && greeting ? (
            <Animated.View entering={FadeInDown.duration(600)} style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Ionicons name="chatbubble-ellipses-outline" size={12} color={colors.primary} />
                <Text style={{ fontSize: 10, color: colors.primary, fontFamily: 'Lexend_400Regular', letterSpacing: 1 }}>AI COACH</Text>
              </View>
              <Text style={{ fontSize: 15, color: '#fff', fontFamily: 'Lexend_300Light', fontStyle: 'italic', lineHeight: 22 }}>"{greeting}"</Text>
            </Animated.View>
          ) : null}

          {/* Goals Progress Bar */}
          <Animated.View entering={FadeInDown.delay(100).duration(500)}>
            <GoalsProgressBar
              progress={avgGoalProgress}
              goalsCount={goals.length}
              onPress={() => setShowGoalsModal(true)}
            />
          </Animated.View>

          {/* Streak & Consistency Cards */}
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
          </Animated.View>

          {/* Quick Habits */}
          <Animated.View entering={FadeInDown.delay(300).duration(500)} style={{ marginTop: 24 }}>
            <VoidCard style={{ padding: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 16, color: '#fff', fontWeight: '700' }}>Today's Habits</Text>
                <TouchableOpacity onPress={() => router.push('/(root)/(tabs)/roadmap')}>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>See All</Text>
                </TouchableOpacity>
              </View>

              {topHabits.length > 0 ? topHabits.map((habit, i) => (
                <TouchableOpacity
                  key={habit.id}
                  onPress={() => handleHabitToggle(habit.id)}
                  activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: i < topHabits.length - 1 ? 1 : 0, borderBottomColor: 'rgba(255,255,255,0.05)' }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: completions[habit.id] ? habit.color + '30' : 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Ionicons name={completions[habit.id] ? 'checkmark' : (habit.icon as any) || 'ellipse'} size={18} color={completions[habit.id] ? habit.color || '#22C55E' : 'rgba(255,255,255,0.5)'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: completions[habit.id] ? 'rgba(255,255,255,0.5)' : '#fff', fontSize: 14, fontWeight: '500', textDecorationLine: completions[habit.id] ? 'line-through' : 'none' }}>{habit.name}</Text>
                    {habit.goalId && (
                      <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 }}>
                        {goals.find(g => g.id === habit.goalId)?.name || 'Goal'}
                      </Text>
                    )}
                  </View>
                  <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: completions[habit.id] ? habit.color || '#22C55E' : 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', backgroundColor: completions[habit.id] ? habit.color || '#22C55E' : 'transparent' }}>
                    {completions[habit.id] && <Ionicons name="checkmark" size={14} color="white" />}
                  </View>
                </TouchableOpacity>
              )) : (
                <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                  <Ionicons name="add-circle-outline" size={40} color="rgba(255,255,255,0.2)" />
                  <Text style={{ color: 'rgba(255,255,255,0.4)', marginTop: 12 }}>No habits yet</Text>
                  <TouchableOpacity onPress={() => DeviceEventEmitter.emit('show_habit_modal')} style={{ marginTop: 12, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}>
                    <Text style={{ color: 'white', fontSize: 13 }}>Create First Habit</Text>
                  </TouchableOpacity>
                </View>
              )}
            </VoidCard>
          </Animated.View>

        </ScrollView>

        {/* Modals */}
        <GoalsGridModal
          visible={showGoalsModal}
          onClose={() => setShowGoalsModal(false)}
          goals={goals}
          goalProgress={goalProgressMap}
        />
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
          goalConsistency={goalConsistency}
          avgConsistency={avgConsistency}
        />
        <NotificationsModal visible={showNotifications} onClose={() => setShowNotifications(false)} />
        <AIAgentModal visible={showAIAgent} onClose={() => setShowAIAgent(false)} />
        <CelebrationAnimation visible={showCelebration} onComplete={() => setShowCelebration(false)} />
      </SafeAreaView>
    </VoidShell>
  );
};

export default Home;
