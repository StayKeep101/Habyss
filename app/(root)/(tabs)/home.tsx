import { FontFamily } from '@/theme/designSystem';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {View, Text, ScrollView, RefreshControl} from 'react-native';
import { EchoLine } from '@/components/Home/EchoLine';
import { CheckInPopup } from '@/components/Echo/CheckInPopup';
import { useEchoMemory } from '@/hooks/useEchoMemory';
import { answer as answerCheckIn, leadInFor, loadCheckIns, markAsked, pickQuestion, type CheckInKind } from '@/lib/checkIns';
import { coverYesterdayIfMissed, loadFreezes } from '@/lib/streakFreeze';
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
import { pressureLine, pressureSpeaks } from '@/lib/taskPressure';
import { useTaskPressure } from '@/hooks/useTaskPressure';
import { getName } from '@/lib/echo';
import { nextPatternLine } from '@/lib/echoPatterns';
import { useEchoPatterns } from '@/hooks/useEchoPatterns';



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
import { useCoachTarget } from '@/hooks/useCoachTarget';
import { startTour } from '@/lib/coachMarks';
import { useAccess } from '@/hooks/useAccess';
import { FocusCard } from '@/components/Home/FocusCard';
import { localDateKey } from '@/lib/habitSchedule';
import { echoWeek } from '@/lib/echoInsights';
import { MissedCard } from '@/components/Home/MissedCard';
import { MissedModal } from '@/components/Home/MissedModal';
import { missed as missedFrom } from '@/lib/missed';
import { useMovedTasks } from '@/hooks/useMovedTasks';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { emit, on } from '@/lib/appEvents';
import { RANKS } from '@/lib/marks';

const Home = () => {
  const router = useRouter();
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { primary: accentColor } = useAccentGradient();
  const { lightFeedback, selectionFeedback, successFeedback } = useHaptics();
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
  const [showMissed, setShowMissed] = useState(false);
  // Your photo, from the one profile store (lib/profile.ts).
  const { avatar: profileAvatar } = useMyProfile();
  const [refreshing, setRefreshing] = useState(false);
  const [motivationalQuote, setMotivationalQuote] = useState('');
  // One of Echo's quick questions, asked now and then after a pull down.
  const [question, setQuestion] = useState<CheckInKind | null>(null);
  /** The question waiting for Echo's line to finish typing. */
  const pendingQuestion = useRef<CheckInKind | null>(null);

  // Echo's line: new on every visit and refresh. Stats are read from a ref so
  // the line always reflects the latest render without re-running the effect.
  const echoPatterns = useEchoPatterns();
  const taskPressureNow = useTaskPressure();
  const pressureRef = useRef(taskPressureNow);
  useEffect(() => { pressureRef.current = taskPressureNow; }, [taskPressureNow]);
  // Echo's mood moves with the level: a new level is a new line.
  const pressureLevel = taskPressureNow.level;
  const lastLevel = useRef(pressureLevel);
  useEffect(() => {
    if (lastLevel.current === pressureLevel) return;
    lastLevel.current = pressureLevel;
    void showEchoLineRef.current?.();
  }, [pressureLevel]);
  const echoPatternsRef = useRef(echoPatterns);
  useEffect(() => { echoPatternsRef.current = echoPatterns; }, [echoPatterns]);
  const echoStatsRef = useRef<EchoStats>({ streak: 0, todayDone: 0, todayTotal: 0, weekConsistency: 0, goalsCount: 0, overallProgress: 0 });
  const showEchoLine = useCallback(async () => {
    const name = await getName();
    const personality = normalizeAIPersonality(aiPersonality || 'friendly');
    const stats = echoStatsRef.current;
    // Behind on tasks: that comes before any stat, more worried
    // the further behind, up to demon mode (lib/taskPressure.ts).
    const pressure = pressureRef.current;
    if (pressureSpeaks(pressure)) {
      const line = pressureLine(pressure.level === 4 && !pressure.demonAllowed ? { ...pressure, level: 3 } : pressure, personality);
      if (line) { setMotivationalQuote(line); return; }
    }
    // Now and then, something Echo found in your record instead.
    const found = nextPatternLine(echoPatternsRef.current);
    if (found) { setMotivationalQuote(found); return; }
    setMotivationalQuote(await nextEchoLine(personality, { ...stats, name, patterns: echoPatternsRef.current.map(pattern => pattern.text) }, greetingStyle));
  }, [aiPersonality, greetingStyle]);
  const showEchoLineRef = useRef(showEchoLine);
  useEffect(() => { showEchoLineRef.current = showEchoLine; }, [showEchoLine]);

  // Track previous streak for celebration


  // Pull-to-refresh handler - OPTIMIZED: reload all stats data here
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Sync HealthKit Data
    syncHealthKitData().catch(console.error);

    // Sometimes Echo asks something instead (when is learned from when you
    // answer): it says so on its line first, then the pop-up opens once the
    // line has finished typing.
    const kind = pickQuestion(await loadCheckIns(), new Date());
    if (kind) {
      void markAsked(kind);
      pendingQuestion.current = kind;
      setMotivationalQuote(leadInFor(kind, normalizeAIPersonality(aiPersonality || 'friendly')));
    } else {
      // A new line from Echo on every refresh.
      showEchoLine();
    }
    // Reload completions for today
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const completionsData = await getCompletions(today);
    setCompletions(completionsData);
    // Reload history data for accurate stats (streak, consistency, goal progress)
    reloadHistory();
    setRefreshing(false);
  }, [showEchoLine, reloadHistory, aiPersonality]);

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


  // Straight after onboarding, once: the tour on the real screens, like a
  // game's (Home's cards, a first goal, Roadmap, friends), not a page.
  const streakRef = useCoachTarget<View>('streak');
  const todayRef = useCoachTarget<View>('today-focus');
  const focusRef = useCoachTarget<View>('focus-today');
  const missedRef = useCoachTarget<View>('missed');
  const goalsRef = useCoachTarget<View>('goals');
  // Only once the app is open to you: not under the free-week screen.
  const { access } = useAccess();
  const open = access.kind === 'owned' || access.kind === 'trial';
  useEffect(() => {
    if (!open) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { takeTutorialDue } = require('@/lib/tutorial') as typeof import('@/lib/tutorial');
    void takeTutorialDue().then(due => {
      if (due) timer = setTimeout(startTour, 900);
    });
    // Asked for again from Settings → How Habyss works.
    const again = on('start_walkthrough', startTour);
    return () => { if (timer) clearTimeout(timer); again.remove(); };
  }, [open]);

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

  // One-go goals ("run 21 km"): their training habit steps up each week (lib/peakPlan.ts).
  useEffect(() => {
    if (!goalsData.loaded) return;
    void (require('@/lib/peakPlan') as typeof import('@/lib/peakPlan')).syncPeakPlans(
      allHabits.filter(habit => habit.isGoal), allHabits, todayKeyString,
      patch => (require('@/lib/habitsSQLite') as typeof import('@/lib/habitsSQLite')).updateHabit(patch),
    ).catch(() => undefined);
  }, [goalsData.loaded, allHabits, todayKeyString]);

  // A streak freeze someone gave you covers yesterday if it was missed.
  useEffect(() => {
    if (!sharedData.historyLoaded) return;
    void loadFreezes().then(() => {
      const history = sharedData.history;
      const doneDays = new Set(allTasks.filter(task => task.status === 'done' && task.completedAt).map(task => localDateKey(new Date(task.completedAt!))));
      const didOn = (day: string) => (history[day] ?? []).length > 0 || doneDays.has(day);
      const before = new Date(); before.setDate(before.getDate() - 2);
      const run = streakFrom(allHabits, allTasks, history, sharedData.skips, localDateKey(before)).streak;
      return coverYesterdayIfMissed(didOn, run);
    }).catch(() => undefined);
  }, [sharedData.historyLoaded, sharedData.history, sharedData.skips, allHabits, allTasks]);

  // The climb, as moments: your first foothold, then each new rank (lib/climbMoments.ts).
  const [climbMoment, setClimbMoment] = useState<ClimbMoment | null>(null);
  useEffect(() => {
    // Only once everything Marks are counted from has loaded: a total read
    // half-loaded looked like a fall and then a climb on every launch.
    if (!sharedData.historyLoaded || !sharedData.tasksLoaded || !goalsData.loaded) return;
    const hasCompleted = Object.values(sharedData.history).some(ids => ids.length > 0)
      || sharedData.tasks.some(task => task.status === 'done');
    let alive = true;
    // Sleep and the misses of deleted things arrive a moment later and can
    // lower the total, so it is read once it has held still for a beat.
    const settle = setTimeout(() => void loadClimbState().then(previous => {
      if (!alive) return;
      const { moment, state } = nextMoment(previous, marks.total, hasCompleted);
      void saveClimbState(state);
      if (moment) {
        setClimbMoment(moment);
        if (moment.kind === 'rankUp') playLevelUp();
      }
    }), 2500);
    return () => { alive = false; clearTimeout(settle); };
  }, [marks.total, sharedData.historyLoaded, sharedData.tasksLoaded, goalsData.loaded, sharedData.history, sharedData.tasks, playLevelUp]);
  // The Developer page can play the moment for any rank, to see it.
  useEffect(() => {
    const sub = on('preview_climb', ({ rank }) => {
      const index = RANKS.findIndex(item => item.name === rank);
      if (index > 0) { setClimbMoment({ kind: 'rankUp', rank, index }); playLevelUp(); }
    });
    const ask = on('preview_question', ({ kind }) => {
      pendingQuestion.current = kind;
      setMotivationalQuote(leadInFor(kind, normalizeAIPersonality(aiPersonality || 'friendly')));
    });
    return () => { sub.remove(); ask.remove(); };
  }, [playLevelUp, aiPersonality]);
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
    const scheduledToday = habits.filter(h => !h.isArchived && !h.isGoal && isHabitScheduledForDate(h, new Date()));
    // The last 7 calendar days, counted in lib/echoInsights.ts.
    const week = echoWeek(habits, historyData, completions, localDateKey(new Date()));
    return {
      streak,
      todayDone: scheduledToday.filter(h => completions[h.id]).length,
      todayTotal: scheduledToday.length,
      weekConsistency: week.weekConsistency,
      bestHabit: week.bestHabit,
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
  // What went undone, day by day, and whether that is more than last week.
  const moves = useMovedTasks();
  const missed = useMemo(() => missedFrom({ habits, history: historyData, completions, tasks: allTasks, moves, today: todayKeyString }), [habits, historyData, completions, allTasks, moves, todayKeyString]);

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
              multiplier={marks.multiplier}
              onPress={() => router.push('/(root)/profile')}
            />
            <MarksBar marks={marks} onPress={() => setShowMarks(true)} />
          </View>

          {/* Echo, full width below the header, where it reads as a line
              rather than squeezed into a column beside the picture. */}
          {motivationalQuote ? <EchoLine text={motivationalQuote} mood={taskPressureNow.demonAllowed ? taskPressureNow.level : Math.min(3, taskPressureNow.level)} style={{ marginTop: sectionGap }}
            onDone={() => { const kind = pendingQuestion.current; if (kind) { pendingQuestion.current = null; setTimeout(() => setQuestion(kind), 400); } }} /> : null}

          {/* Spacer after header */}
          <View style={{ height: sectionGap }} />

          {/* Goals Progress Bar */}
          <Animated.View>
            <View ref={goalsRef} collapsable={false}>
            <GoalsProgressBar
              progress={avgGoalProgress}
              goalsCount={goals.length}
              series={goalsData.overallSeries}
              onPress={() => router.push('/goals-overview')}
            />
          </View>
          </Animated.View>

          {/* The day's promise, and the few things that would keep it. */}
          <Animated.View style={{ marginTop: sectionGap }}>
            <View ref={todayRef} collapsable={false}>
            <DailyFocusCard
              focus={focus}
              multiplier={marks.multiplier}
              onToggle={handleFocusToggle}
              onOpen={() => router.push('/task-stats')}
              onAdd={() => emit('show_task_form')}
            />
          </View>
          </Animated.View>

          {/* 3-Column Stats Row: Streak | Consistency | Completion */}
          <Animated.View style={{ flexDirection: 'row', gap: isCompactWidth ? s(8) : s(12), marginTop: sectionGap }}>
            {/* Measured by the first-run walkthrough ("Keep the streak"). */}
            <View ref={streakRef} collapsable={false} style={{ flex: 1 }}>
              <StreakCard
                streak={streak}
                completionTier={completionTier}
                onPress={() => { lightFeedback(); router.push('/(root)/progress'); }}
              />
            </View>
            {/* Focus in place of "Kept": time focused today, this week under it. */}
            <View ref={focusRef} collapsable={false} style={{ flex: 1 }}>
              <FocusCard onPress={() => { lightFeedback(); router.push('/(root)/focus-stats' as never); }} />
            </View>
            <View ref={missedRef} collapsable={false} style={{ flex: 1 }}>
              <MissedCard
                missed={missed}
                onPress={() => { lightFeedback(); setShowMissed(true); }}
              />
            </View>
          </Animated.View>

          {/* Under the three numbers: last night's sleep; good nights earn Marks. */}
          <View style={{ marginTop: sectionGap }}>
            <SleepCard />
          </View>


        </ScrollView>


        {/* Echo's quick questions. */}
        <CheckInPopup kind={question} onClose={() => setQuestion(null)}
          onAnswer={(kind, value) => { void answerCheckIn(kind, value); setQuestion(null); successFeedback(); }} />

        <MissedModal
          visible={showMissed}
          onClose={() => setShowMissed(false)}
          missed={missed}
          habits={habits}
        />
        <MarksModal visible={showMarks} onClose={() => setShowMarks(false)} marks={marks} />
        <ClimbMomentOverlay moment={climbMoment} onDone={() => setClimbMoment(null)} />
        <CelebrationAnimation visible={showCelebration} onComplete={() => setShowCelebration(false)} />
      </SafeAreaView>
    </VoidShell>
  );
};

export default Home;
