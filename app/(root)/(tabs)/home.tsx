import { FontFamily } from '@/theme/designSystem';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {View, Text, ScrollView, RefreshControl} from 'react-native';
import { EchoLine } from '@/components/Home/EchoLine';
import { EchoCoachCard } from '@/components/Echo/EchoCoachCard';
import { useEchoMemory } from '@/hooks/useEchoMemory';
import { computeInsights } from '@/lib/echoInsights';
import { energyToday } from '@/lib/echoMemory';
import { useMyProfile } from '@/hooks/useMyProfile';
import { ClimbMomentOverlay } from '@/components/Home/ClimbMomentOverlay';
import { SleepCard } from '@/components/Home/SleepCard';
import { loadClimbState, nextMoment, saveClimbState, type ClimbMoment } from '@/lib/climbMoments';
import { afterPaint } from '@/lib/afterPaint';
import { s, ms } from '@/theme/scale';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/theme/colors';
import { VoidShell } from '@/components/ui/VoidShell';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { subscribeToHabits, getCompletions, Habit, isHabitScheduledForDate, syncHealthKitData } from '@/lib/habitsSQLite';
import { useGoalsInsights } from '@/hooks/useGoalInsights';
import { CelebrationAnimation } from '@/components/Celebrations/CelebrationAnimation';
import { useHaptics } from '@/hooks/useHaptics';
import { useSounds } from '@/hooks/useSounds';

import { useFocusEffect } from 'expo-router';
import { useAppSettings } from '@/context/AppSettingsContext';
import { useAccentGradient } from '@/context/AccentContext';
import { normalizeAIPersonality } from '@/lib/aiAgentService';
import { nextEchoLine, type EchoStats } from '@/lib/echoLines';
import { getName } from '@/lib/echo';



import { useTheme } from '@/context/ThemeContext';

import { GoalsProgressBar } from '@/components/Home/GoalsProgressBar';
import { DailyFocusCard } from '@/components/Home/DailyFocusCard';
import { ProgressAvatar } from '@/components/Home/ProgressAvatar';
import { MarksBar } from '@/components/Marks/MarksBar';
import { MarksModal } from '@/components/Marks/MarksModal';
import { useMarks } from '@/hooks/useMarks';
import { tallyDay } from '@/lib/dayComplete';
import { useDailyFocus, useDailyTarget } from '@/hooks/useDailyFocus';
import { bestStreakFrom, streakFrom } from '@/lib/dayComplete';
import { useHistory } from '@/hooks/useHistory';
import { useData } from '@/hooks/useData';
import { getData } from '@/lib/dataStore';
import { setTaskStatus, type Task } from '@/lib/tasks';
import { StreakCard } from '@/components/Home/StreakCard';
import { MomentumCard } from '@/components/Home/MomentumCard';
import { localDateKey } from '@/lib/habitSchedule';
import { MomentumModal } from '@/components/Home/MomentumModal';
import { RecoveryCard } from '@/components/Home/RecoveryCard';
import { RecoveryModal } from '@/components/Home/RecoveryModal';
import { momentum } from '@/lib/momentum';
import { recovery } from '@/lib/recovery';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { emit, on } from '@/lib/appEvents';

const Home = () => {
  const router = useRouter();
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { primary: accentColor } = useAccentGradient();
  const { lightFeedback, selectionFeedback } = useHaptics();
  const { playComplete, playLevelUp } = useSounds();
  const { horizontalPadding, sectionGap, topSpacing, tabBarClearance, isCompactWidth } = useResponsiveLayout();

  // Pro Hooks
  const { aiPersonality, greetingStyle } = useAppSettings();

  // Data state
  const [allHabits, setAllHabits] = useState<Habit[]>([]);
  // Seeded from the shared data loaded behind the splash, so Home opens with
  // today already filled in rather than empty and then jumping.
  const [completions, setCompletions] = useState<Record<string, boolean>>(() => {
    const seeded: Record<string, boolean> = {};
    for (const id of getData().history[localDateKey(new Date())] ?? []) seeded[id] = true;
    return seeded;
  });
  // Check-ins for the stats below, kept current by the shared loader.
  const { rows: historyData, reload: reloadHistory } = useHistory(90);
  const sharedData = useData();
  // Stats are now derived, removed explicit state

  // UI state
  const [showCelebration, setShowCelebration] = useState(false);
  const [showMomentumModal, setShowMomentumModal] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  // Your photo, from the one profile store (lib/profile.ts).
  const { avatar: profileAvatar } = useMyProfile();
  const [refreshing, setRefreshing] = useState(false);
  const [motivationalQuote, setMotivationalQuote] = useState('');

  // Echo's line: new on every visit and refresh. Stats are read from a ref so
  // the line always reflects the latest render without re-running the effect.
  const echoStatsRef = useRef<EchoStats>({ streak: 0, todayDone: 0, todayTotal: 0, weekConsistency: 0, goalsCount: 0, overallProgress: 0 });
  const showEchoLine = useCallback(async () => {
    const name = await getName();
    const personality = normalizeAIPersonality(aiPersonality || 'friendly');
    const stats = echoStatsRef.current;
    setMotivationalQuote(await nextEchoLine(personality, { ...stats, name }, greetingStyle));
  }, [aiPersonality, greetingStyle]);

  // Track previous streak for celebration


  // Pull-to-refresh handler - OPTIMIZED: reload all stats data here
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Sync HealthKit Data
    syncHealthKitData().catch(console.error);

    // A new line from Echo on every refresh.
    showEchoLine();
    // Reload completions for today
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const completionsData = await getCompletions(today);
    setCompletions(completionsData);
    // Reload history data for accurate stats (streak, consistency, goal progress)
    reloadHistory();
    setRefreshing(false);
  }, [showEchoLine, reloadHistory]);

  // Derived data
  const goals = useMemo(() => allHabits.filter(h => h.isGoal), [allHabits]);
  const habits = useMemo(() => allHabits.filter(h => !h.isGoal), [allHabits]);

  // Load initial data & Sync on Focus
  useFocusEffect(
    useCallback(() => {
      // A new line from Echo every time Home comes into view.
      showEchoLine();
    }, [showEchoLine])
  );


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
    const sub = on('habit_completion_updated', ({ habitId, date, completed }) => {
      // A restore or a sync says only that something changed, with no row to
      // patch. Reload, rather than dropping the event as this used to.
      if (!habitId || !date) { void loadCompletions(); return; }

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // Only update if the event matches TODAY (since Home only shows today)
      if (date === todayStr) {
        setCompletions(prev => ({
          ...prev,
          [habitId]: completed === true
        }));
      }
    });

    return () => sub.remove();
  }, []);

  // Sync HealthKit on focus/mount
  useFocusEffect(
    useCallback(() => {
      afterPaint(() => {
        syncHealthKitData().catch(e => console.log('HealthKit sync error:', e));
      });
    }, [])
  );

  const dailyTarget = useDailyTarget();

  // The same number as the goals overview and each goal's stats.
  const goalsData = useGoalsInsights();
  const { overall: avgGoalProgress, tasks: allTasks, skippedToday, today: todayKeyString } = goalsData;
  // Marks, from the same habits, tasks and history already loaded here.
  const marks = useMarks(goalsData);
  // Echo's one thing worth knowing today, counted from the same data (lib/echoInsights.ts).
  const echoMemory = useEchoMemory();
  const echoEnergy = energyToday(echoMemory, todayKeyString);
  const echoInsight = useMemo(() => computeInsights({
    habits: allHabits, tasks: allTasks, history: historyData, completions, today: todayKeyString,
    voice: normalizeAIPersonality(aiPersonality || 'friendly'), energy: echoEnergy, dismissed: echoMemory.dismissed,
    remembered: echoMemory.notes.map(note => note.key).filter((key): key is string => !!key),
  })[0], [allHabits, allTasks, historyData, completions, todayKeyString, aiPersonality, echoEnergy, echoMemory.dismissed, echoMemory.notes]);

  // The climb, as moments: your first foothold, then each new rank (lib/climbMoments.ts).
  const [climbMoment, setClimbMoment] = useState<ClimbMoment | null>(null);
  useEffect(() => {
    if (!sharedData.historyLoaded || !sharedData.tasksLoaded) return;
    const hasCompleted = Object.values(sharedData.history).some(ids => ids.length > 0)
      || sharedData.tasks.some(task => task.status === 'done');
    let alive = true;
    void loadClimbState().then(previous => {
      if (!alive) return;
      const { moment, state } = nextMoment(previous, marks.total, hasCompleted);
      void saveClimbState(state);
      if (moment) {
        setClimbMoment(moment);
        if (moment.kind === 'rankUp') playLevelUp();
      }
    });
    return () => { alive = false; };
  }, [marks.total, sharedData.historyLoaded, sharedData.tasksLoaded, sharedData.history, sharedData.tasks, playLevelUp]);
  const [showMarks, setShowMarks] = useState(false);


  /**
   * The streak, worked out the one way the app defines a finished day.
   *
   * Home used to count it per goal — a day counted only if every habit under
   * some goal was done, and tasks were not looked at at all. So finishing
   * today's three things moved nothing, and Home could sit on zero while the
   * card that appears when the day is won said three. Two answers to one
   * question is one too many; this is now the same `streakFrom` the card uses.
   */
  const { streak, bestStreak } = useMemo(() => {
    const today = localDateKey(new Date());
    // The whole shared history, so a run longer than any window still counts.
    const history = { ...sharedData.history, [today]: Object.keys(completions).filter(id => completions[id]) };
    const run = streakFrom(habits, allTasks, history, sharedData.skips, today, undefined, dailyTarget);
    return { streak: run.streak, bestStreak: bestStreakFrom(run.completedDates) };
  }, [habits, allTasks, sharedData.history, sharedData.skips, completions, dailyTarget]);
  // Goals finished: the trophies on your profile, counted as Marks counts them.
  const goalsCompleted = useMemo(
    () => Object.values(goalsData.insightsById).filter(insights => insights.series.some(point => point.actual >= 100)).length,
    [goalsData.insightsById],
  );

  // Friends see your total; sent a moment after it settles, and only when it moved.
  useEffect(() => {
    const timer = setTimeout(() => {
      const { publishMarks } = require('@/lib/marksSync') as typeof import('@/lib/marksSync');
      void publishMarks(marks.total, marks.series, { bestStreak, goalsCompleted });
    }, 3000);
    return () => clearTimeout(timer);
  }, [marks.total, marks.series, bestStreak, goalsCompleted]);

  // How hot the flame burns: how much of today is already done.
  const completionTier = useMemo(() => {
    const due = habits.filter(habit => !habit.isArchived && isHabitScheduledForDate(habit, new Date()));
    if (due.length === 0) return 0;
    return Math.floor(due.filter(habit => completions[habit.id]).length / due.length * 4);
  }, [habits, completions]);

  // What Echo is allowed to say about today: only what was recorded.
  const echoStats = useMemo<EchoStats>(() => {
    const scheduledToday = habits.filter(h => !h.isArchived && isHabitScheduledForDate(h, new Date()));
    const lastWeek = [...historyData].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
    const counts: Record<string, number> = {};
    lastWeek.forEach(day => day.completedIds?.forEach(id => { counts[id] = (counts[id] ?? 0) + 1; }));
    const best = habits.filter(h => (counts[h.id] ?? 0) >= 3).sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0))[0];
    return {
      streak,
      todayDone: scheduledToday.filter(h => completions[h.id]).length,
      todayTotal: scheduledToday.length,
      weekConsistency: lastWeek.length ? Math.round((lastWeek.filter(day => day.completedIds?.length).length / 7) * 100) : 0,
      bestHabit: best?.name,
      nextHabit: scheduledToday.find(h => !completions[h.id])?.name,
      goalsCount: goals.filter(g => !g.isArchived).length,
      overallProgress: avgGoalProgress,
    };
  }, [habits, historyData, completions, goals, avgGoalProgress, streak]);

  useEffect(() => { echoStatsRef.current = echoStats; }, [echoStats]);

  // Quick habits (non-goal habits for today)
  // Filter for ONLY habits scheduled for TODAY
  const topHabits = useMemo(() => {
    return habits.filter(h => isHabitScheduledForDate(h, new Date())).slice(0, 5);
  }, [habits]);

  // Are the habits getting stronger, and do they get back up when they slip?
  // Both read the same window; neither is a grade out of today.
  const trend = useMemo(() => momentum(habits, historyData, completions, 30), [habits, historyData, completions]);
  const bounce = useMemo(() => recovery(habits, historyData, completions, 90), [habits, historyData, completions]);

  // Today's promise, and ticking one of its rows off.
  const focus = useDailyFocus();

  // What today asked for, habits and the promise together: the number the ring
  // around the avatar draws.
  const dayTally = useMemo(
    () => tallyDay(allHabits, completions, skippedToday, allTasks, todayKeyString, focus.target),
    [allHabits, completions, skippedToday, allTasks, todayKeyString, focus.target],
  );

  const handleFocusToggle = (task: Task) => {
    const done = task.status === 'done';
    if (!done) playComplete();
    void setTaskStatus(task.id, done ? 'open' : 'done')
        .then(() => emit('tasks_changed'))
        .catch(() => undefined);
  };

  // Handlers
  const handleProfilePress = () => {
    selectionFeedback();
    router.push('/(root)/(tabs)/settings');
  };

  // Live Activity Init
  useEffect(() => {
    const initLiveActivity = async () => {
      const now = new Date();
      const activeHabits = habits.filter(h => isHabitScheduledForDate(h, now) && !h.isArchived);
      if (activeHabits.length > 0) {
        const completedCount = activeHabits.filter(h => completions[h.id]).length;
        const nextHabit = activeHabits.find(h => !completions[h.id]);
        const { LiveActivityService } = require('@/lib/liveActivityService');

        // Only start if we have habits
        await LiveActivityService.startDailyProgress({
          completed: completedCount,
          total: activeHabits.length,
          topHabitName: nextHabit?.name,
          streakDays: streak, // Use calculated streak
          profilePicture: profileAvatar || undefined,
          habits: activeHabits.map(h => ({
            id: h.id,
            name: h.name,
            isCompleted: !!completions[h.id]
          }))
        });
      }
    };

    // Run on mount and when data changes significantly (e.g. initial load)
    if (habits.length > 0) {
      initLiveActivity();
    }
  }, [habits.length, streak, profileAvatar]); // Minimized dependencies to avoid loops

  return (
    <VoidShell>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: tabBarClearance, paddingHorizontal: horizontalPadding }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={accentColor}
              colors={[accentColor]}
            />
          }
        >

          {/* Header Row
              Your picture, its ring for today, and your Marks beside it: who
              you are today and the record you have built, side by side. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(16), marginTop: topSpacing }}>
            {/* The ring is today: empty at nothing done, closed and green
                when the day is kept. */}
            <ProgressAvatar
              uri={profileAvatar}
              done={dayTally.done}
              total={dayTally.total}
              onPress={() => router.push('/(root)/profile')}
            />
            <MarksBar marks={marks} onPress={() => setShowMarks(true)} />
          </View>

          {/* Echo, full width below the header, where it reads as a line
              rather than squeezed into a column beside the picture. */}
          {motivationalQuote ? <EchoLine text={motivationalQuote} style={{ marginTop: sectionGap }} onPress={() => { lightFeedback(); router.push('/(root)/echo' as never); }} /> : null}
          {echoInsight || !echoEnergy ? (
            <View style={{ marginTop: sectionGap }}>
              <EchoCoachCard insight={echoInsight} energy={echoEnergy} today={todayKeyString} />
            </View>
          ) : null}

          {/* Spacer after header */}
          <View style={{ height: sectionGap }} />

          {/* Goals Progress Bar */}
          <Animated.View>
            <GoalsProgressBar
              progress={avgGoalProgress}
              goalsCount={goals.length}
              series={goalsData.overallSeries}
              onPress={() => router.push('/goals-overview')}
            />
          </Animated.View>

          {/* The day's promise, and the few things that would keep it. */}
          <Animated.View style={{ marginTop: sectionGap }}>
            <DailyFocusCard
              focus={focus}
              multiplier={marks.multiplier}
              onToggle={handleFocusToggle}
              onOpen={() => router.push('/task-stats')}
              onAdd={() => emit('show_task_form')}
            />
          </Animated.View>

          {/* 3-Column Stats Row: Streak | Consistency | Completion */}
          <Animated.View style={{ flexDirection: 'row', gap: isCompactWidth ? s(8) : s(12), marginTop: sectionGap }}>
            <StreakCard
              streak={streak}
              completionTier={completionTier}
              onPress={() => { lightFeedback(); router.push('/(root)/progress'); }}
            />
            <MomentumCard
              momentum={trend}
              onPress={() => { lightFeedback(); setShowMomentumModal(true); }}
            />
            <RecoveryCard
              recovery={bounce}
              onPress={() => { lightFeedback(); setShowRecoveryModal(true); }}
            />
          </Animated.View>

          {/* Under the three numbers: last night's sleep; good nights earn Marks. */}
          <View style={{ marginTop: sectionGap }}>
            <SleepCard />
          </View>


        </ScrollView>


        <MomentumModal
          visible={showMomentumModal}
          onClose={() => setShowMomentumModal(false)}
          habits={habits}
          history={historyData}
          completions={completions}
        />
        <RecoveryModal
          visible={showRecoveryModal}
          onClose={() => setShowRecoveryModal(false)}
          habits={habits}
          history={historyData}
          completions={completions}
        />
        <MarksModal visible={showMarks} onClose={() => setShowMarks(false)} marks={marks} />
        <ClimbMomentOverlay moment={climbMoment} onDone={() => setClimbMoment(null)} />
        <CelebrationAnimation visible={showCelebration} onComplete={() => setShowCelebration(false)} />
      </SafeAreaView>
    </VoidShell>
  );
};

export default Home;
