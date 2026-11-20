import { FontFamily } from '@/theme/designSystem';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, ScrollView, RefreshControl, useWindowDimensions, Image, Pressable } from 'react-native';
import { EchoLine } from '@/components/Home/EchoLine';
import { CheckInPopup } from '@/components/Echo/CheckInPopup';
import { useEchoMemory } from '@/hooks/useEchoMemory';
import { answer as answerCheckIn, leadInFor, loadCheckIns, markAsked, pickQuestion, type CheckInKind } from '@/lib/checkIns';
import { coverYesterdayIfMissed, earnFreezeIfDue, loadFreezes } from '@/lib/streakFreeze';
import { useMyProfile } from '@/hooks/useMyProfile';
import { ClimbMomentOverlay } from '@/components/Home/ClimbMomentOverlay';
import { AscentArrival } from '@/components/Ascent/AscentArrival';
import { loadClimbState, nextMoment, saveClimbState, type ClimbMoment } from '@/lib/climbMoments';
import { afterPaint } from '@/lib/afterPaint';
import { s, ms } from '@/theme/scale';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/theme/colors';
import { VoidShell } from '@/components/ui/VoidShell';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { Extrapolation, interpolate, runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { focusLeave, focusTurn, setFocusStage } from '@/lib/focusStage';
import { EASE, FOCUS_ENTRY, FOCUS_EXIT, timingFor } from '@/theme/motion';
import { subscribeToHabits, getCompletions, Habit, isHabitScheduledForDate, syncHealthKitData } from '@/lib/habitsSQLite';
import { proveTick } from '@/lib/challengeProof';
import { useGoalsInsights } from '@/hooks/useGoalInsights';
import { CelebrationAnimation } from '@/components/Celebrations/CelebrationAnimation';
import { useHaptics } from '@/hooks/useHaptics';
import { useSounds } from '@/hooks/useSounds';

import { useFocusEffect } from 'expo-router';
import { useAppSettings } from '@/context/AppSettingsContext';
import { useAccent, useAccentGradient } from '@/context/AccentContext';
import { normalizeAIPersonality } from '@/lib/aiAgentService';
import { nextEchoLine, type EchoStats } from '@/lib/echoLines';
import { pressureLines, pressureSpeaks } from '@/lib/taskPressure';
import { loadSaid, noteSaid, pickFresh, shuffled } from '@/lib/echoRecent';
import { QUIET_FOR_MS } from '@/lib/echoHuman';
import type { TalkQuestion } from '@/lib/echoConversation';
import { ChoiceSheet } from '@/components/ui/ChoiceSheet';
import { upcomingDeadlines } from '@/lib/echoBrief';
import { useTaskPressure } from '@/hooks/useTaskPressure';
import { getName } from '@/lib/echo';
import { nextPatternLine } from '@/lib/echoPatterns';
import { useEchoPatterns } from '@/hooks/useEchoPatterns';



import { useTheme } from '@/context/ThemeContext';

import { GoalsProgressBar } from '@/components/Home/GoalsProgressBar';
import { DailyFocusCard } from '@/components/Home/DailyFocusCard';
import { ProgressAvatar } from '@/components/Home/ProgressAvatar';
import { ShardsCard } from '@/components/Shards/ShardsCard';
import { DayHourglass, GLASS_HEIGHT } from '@/components/Home/DayHourglass';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { Radius, Spacing } from '@/theme/designSystem';
import { homeStyles } from '@/styles/screens/home.styles';
import { TEMPLE } from '@/theme/hourglassArt';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShardsWallet } from '@/components/Shards/ShardsWallet';
import { useWallet } from '@/hooks/useWallet';
import { useMarks } from '@/hooks/useMarks';
import { useDailyFocus, useDailyTarget } from '@/hooks/useDailyFocus';
import { bestStreakFrom, streakFrom } from '@/lib/dayComplete';
import { useHistory } from '@/hooks/useHistory';
import { useData } from '@/hooks/useData';
import { getData } from '@/lib/dataStore';
import { setTaskStatus, type Task } from '@/lib/tasks';
import { StreakCard } from '@/components/Home/StreakCard';
import { useCoachTarget } from '@/hooks/useCoachTarget';
import { startTour } from '@/lib/coachMarks';
import { FocusWeekCard } from '@/components/Home/FocusWeekCard';
import { localDateKey } from '@/lib/habitSchedule';
import { echoWeek } from '@/lib/echoInsights';
import { MissedCard } from '@/components/Home/MissedCard';
import { MissedModal } from '@/components/Home/MissedModal';
import { missed as missedFrom } from '@/lib/missed';
import { useMovedTasks } from '@/hooks/useMovedTasks';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { emit, on } from '@/lib/appEvents';
import { RANKS } from '@/lib/marks';
import { useTimeOff, useTimeOffPeriods } from '@/hooks/useTimeOff';
import { TimeOffCard } from '@/components/Home/TimeOffCard';

/** A colour with no opacity, so a fade to it never passes through grey. */
const clearOf = (color: string) => (/^#[0-9a-f]{6}$/i.test(color) ? `${color}00` : 'transparent');

const Home = () => {
  const router = useRouter();
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { horizontalPadding, sectionGap, topSpacing, tabBarClearance } = useResponsiveLayout();
  // The floating stats bar's height: worked out from the first frame (the picture is the tallest
  // thing in it), then measured; the cards begin under it.
  const insets = useSafeAreaInsets();
  const [measuredHeader, setHeaderHeight] = useState(0);
  const headerHeight = measuredHeader || insets.top + topSpacing + s(64) + Spacing.lg;
  const homeScrollY = useSharedValue(0);
  const onHomeScroll = useAnimatedScrollHandler(event => { homeScrollY.set(event.contentOffset.y); });
  // The temple scene (assets/images/scenes/temple.jpg, 1199 × 1312) at the screen's width: the hourglass
  // stands on its podium's top step, and the cards start just below the stairs.
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const sceneScale = screenWidth / TEMPLE.width;
  const sceneHeight = TEMPLE.height * sceneScale;
  const stepY = TEMPLE.step * sceneScale;
  const panelTop = TEMPLE.stairsEnd * sceneScale + Spacing.md;
  // As you scroll, the temple and its hourglass dissolve into the night: no panel edge sliding over
  // them, just the picture fading, eased so it starts and ends softly (smoothstep).
  const fadeOver = panelTop * 0.9;
  const sceneFade = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, homeScrollY.get() / fadeOver));
    return { opacity: 1 - t * t * (3 - 2 * t) };
  });
  const { primary: accentColor } = useAccentGradient();
  const { rankShown } = useAccent();
  const { lightFeedback, selectionFeedback, successFeedback } = useHaptics();
  const { playComplete, playLevelUp } = useSounds();

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
  // Your Marks, for links that open the hourglasses (read outside render).
  const marksTotalRef = useRef(0);
  // Your photo, from the one profile store (lib/profile.ts).
  const { avatar: profileAvatar } = useMyProfile();
  const [refreshing, setRefreshing] = useState(false);
  const [motivationalQuote, setMotivationalQuote] = useState('');
  // The line on screen, and a count of lines said, so each one types itself out afresh.
  const quoteRef = useRef('');
  const [lineTurn, setLineTurn] = useState(0);
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
  // Goals as the overview has them, for what is due soon (read inside showEchoLine).
  const goalsDataRef = useRef<ReturnType<typeof useGoalsInsights> | null>(null);
  const echoStatsRef = useRef<EchoStats>({ streak: 0, todayDone: 0, todayTotal: 0, weekConsistency: 0, goalsCount: 0, overallProgress: 0 });
  // What Echo last said and when: coming back to Home a moment later is not a new conversation.
  const lastShownRef = useRef<{ at: number } | null>(null);
  // Echo's question of the day, asked once its line has typed out (lib/echoConversation.ts).
  const [talk, setTalk] = useState<TalkQuestion | null>(null);
  const pendingTalk = useRef<TalkQuestion | null>(null);
  const showEchoLine = useCallback(async (options?: { glance?: boolean }) => {
    // Restraint: a glance back within a few minutes keeps what was said (lib/echoHuman.ts).
    if (options?.glance && lastShownRef.current && Date.now() - lastShownRef.current.at < QUIET_FOR_MS) return;
    const name = await getName();
    const personality = normalizeAIPersonality(aiPersonality || 'friendly');
    const stats = echoStatsRef.current;
    const today = localDateKey(new Date());
    // Echo talks like a person, not a loop: every line it said lately is remembered
    // (lib/echoRecent.ts), so a refresh never brings one back and never raises the
    // same thing twice in a row. Most pressing first: behind on tasks, then what is
    // happening now (lib/echoSays.ts), then something from your record, then the bank.
    const said = await loadSaid();
    const say = (line: string, topic: string) => {
      quoteRef.current = line; setLineTurn(turn => turn + 1); setMotivationalQuote(line);
      lastShownRef.current = { at: Date.now() };
      void noteSaid(line, topic);
    };
    const human = require('@/lib/echoHuman') as typeof import('@/lib/echoHuman');
    const saidToday = (prefix: string) => said.some(item => item.topic.startsWith(prefix) && localDateKey(new Date(item.at)) === today);
    const pressure = pressureRef.current;
    if (pressureSpeaks(pressure)) {
      const level = pressure.level === 4 && !pressure.demonAllowed ? { ...pressure, level: 3 as const } : pressure;
      const fresh = pickFresh(shuffled(pressureLines(level, personality)).map(line => ({ topic: 'pressure', line })), said);
      if (fresh) { say(fresh.line, fresh.topic); return; }
    }
    const { buildBrief, echoSays } = require('@/lib/echoSays') as typeof import('@/lib/echoSays');
    const goals = goalsDataRef.current;
    const deadlines = !goals ? [] : upcomingDeadlines(
      goals.goals.map(goal => ({ title: goal.name, daysLeft: goals.insightsById[goal.id]?.daysLeft ?? null, progress: goals.insightsById[goal.id]?.progress ?? 0 })),
      getData().tasks, localDateKey(new Date()));
    const brief = await buildBrief({ name: name ?? undefined, streak: stats.streak, deadlines }).catch(() => null);
    // The lines Echo says when your apps have had you a while, kept current with the day (lib/echoScroll.ts).
    if (brief) (require('@/lib/echoScroll') as typeof import('@/lib/echoScroll')).sendScrollLines(personality, brief).catch(() => undefined);

    // Once a day, something only someone who knows you would say: back after a gap,
    // yesterday's answer, something you told Echo, the help that works for you.
    const talkLib = require('@/lib/echoConversation') as typeof import('@/lib/echoConversation');
    if (!saidToday('callback:')) {
      const memoryLib = require('@/lib/echoMemory') as typeof import('@/lib/echoMemory');
      const memory = await memoryLib.loadMemory().catch(() => memoryLib.EMPTY_MEMORY);
      const yesterday = localDateKey(new Date(Date.now() - 86400000));
      const callback = human.callbackLine({
        voice: personality, name: name ?? undefined, notes: memory.notes,
        bestHelp: memoryLib.helpRanking(memory.helps)[0],
        daysAway: await talkLib.daysAwayBefore(today).catch(() => 0),
        yesterdayAnswer: await talkLib.yesterdayAnswer(yesterday).catch(() => undefined),
        waiting: brief?.onNow?.title ?? brief?.next?.title,
      });
      if (callback) { say(callback.line, callback.topic); return; }
    }

    // One real question a day, asked once this line has typed out; the answer comes back tomorrow.
    if (!pressureSpeaks(pressure)) {
      const question = await talkLib.dueQuestion(new Date(), today).catch(() => null);
      if (question) {
        void talkLib.markAsked(today);
        pendingTalk.current = question;
        say(question.text, 'talk');
        return;
      }
    }

    // Smarter Echo (opt-in): opening Habyss in the morning or evening, Claude writes the line
    // from a short summary of today and what you told Echo (lib/echoCloud.ts).
    const hour = new Date().getHours();
    if (brief && (hour < 12 || hour >= 17)) {
      const { getEchoConfig } = require('@/lib/echo') as typeof import('@/lib/echo');
      const config = await getEchoConfig().catch(() => null);
      if (config?.cloudVoice) {
        const { talkingPoints } = require('@/lib/echoBrief') as typeof import('@/lib/echoBrief');
        const { currentMemory } = require('@/lib/echoMemory') as typeof import('@/lib/echoMemory');
        const points = talkingPoints(brief);
        const line = await (require('@/lib/echoCloud') as typeof import('@/lib/echoCloud')).cloudOpeningLine(true, today, {
          voice: personality, name: name ?? undefined,
          facts: [...points.slice(0, 4).map(point => point.facts), hour < 12 ? 'It is morning.' : 'It is evening.'],
          remembered: currentMemory().notes.filter(note => note.source === 'you').slice(0, 4).map(note => note.text),
          said: said.slice(0, 5).map(item => item.line),
        }).catch(() => null);
        if (line) { say(line, `cloud:${points[0]?.kind ?? 'open'}`); return; }
      }
    }

    const specific = brief ? await echoSays(personality, brief, said).catch(() => null) : null;
    if (specific) {
      // Not every reaction is a full sentence: now and then just a word or a nudge.
      const kind = specific.topic.split(':')[0];
      const short = human.SHORT[personality] ?? human.SHORT.normal;
      const brief_ = (kind === 'early' || kind === 'dayDone') ? short.praise : kind === 'onNow' ? short.nudge : null;
      if (brief_ && Math.random() < 0.25) {
        const word = pickFresh(shuffled(brief_).map(line => ({ topic: specific.topic, line })), said, 0);
        if (word) { say(word.line, word.topic); return; }
      }
      say(specific.line, specific.topic);
      return;
    }
    // Now and then, an opinion Echo holds for good: the same ones, week after week.
    if (!saidToday('opinion') && Math.random() < 0.15) {
      const opinion = pickFresh(shuffled(human.OPINIONS[personality] ?? human.OPINIONS.normal).map(line => ({ topic: 'opinion', line })), said, 0);
      if (opinion) { say(opinion.line, opinion.topic); return; }
    }
    // Now and then, something Echo found in your record instead.
    const found = nextPatternLine(echoPatternsRef.current);
    if (found && !said.some(item => item.line === found)) { say(found, 'pattern'); return; }
    say(await nextEchoLine(personality, { ...stats, name, patterns: echoPatternsRef.current.map(pattern => pattern.text) }, greetingStyle), 'bank');
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
  const habits = useMemo(() => allHabits.filter(h => !h.isGoal), [allHabits]);

  // Load initial data & Sync on Focus
  useFocusEffect(
    useCallback(() => {
      // A new line from Echo every time Home comes into view, once the tab has
      // been drawn: changing it re-renders Home, which held up the switch.
      const later = afterPaint(() => { void showEchoLine({ glance: true }); });
      // Echo keeps up with the day while you are here: when a habit or task changes (a tick,
      // something added, an early finish), and every few minutes as the clock moves on.
      let soon: ReturnType<typeof setTimeout> | undefined;
      const again = () => { if (soon) clearTimeout(soon); soon = setTimeout(() => { void showEchoLineRef.current?.(); }, 2000); };
      const { onAny } = require('@/lib/appEvents') as typeof import('@/lib/appEvents');
      const off = onAny(['tasks_changed', 'habit_completion_updated', 'habit_created', 'habit_updated', 'habit_deleted'], again);
      const tick = setInterval(again, 5 * 60_000);
      return () => { later.cancel(); off(); clearInterval(tick); if (soon) clearTimeout(soon); };
    }, [showEchoLine])
  );


  // Straight after onboarding, once: the tour on the real screens, like a
  // game's (Home's cards, a first goal, Roadmap, friends), not a page.
  const streakRef = useCoachTarget<View>('streak');
  const todayRef = useCoachTarget<View>('today-focus');
  const focusRef = useCoachTarget<View>('focus-today');
  const missedRef = useCoachTarget<View>('missed');
  const goalsRef = useCoachTarget<View>('goals');
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { takeTutorialDue } = require('@/lib/tutorial') as typeof import('@/lib/tutorial');
    void takeTutorialDue().then(due => {
      if (due) timer = setTimeout(startTour, 900);
    });
    // Asked for again from Settings → How Habyss works.
    const again = on('start_walkthrough', startTour);
    return () => { if (timer) clearTimeout(timer); again.remove(); };
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
      // In the evening, Echo may ask you to save a friend's streak (lib/freezeAsk.ts), once a day per friend.
      const ask = setTimeout(() => { void (require('@/lib/freezeAsk') as typeof import('@/lib/freezeAsk')).maybeAskForFreeze(); }, 2500);
      return () => clearTimeout(ask);
    }, [])
  );

  const dailyTarget = useDailyTarget();

  // The same number as the goals overview and each goal's stats.
  const goalsData = useGoalsInsights();
  goalsDataRef.current = goalsData;
  const { overall: avgGoalProgress, tasks: allTasks, skippedToday, today: todayKeyString } = goalsData;
  // Marks, from the same habits, tasks and history already loaded here.
  const marks = useMarks(goalsData);
  marksTotalRef.current = marks.total;
  // Shards, the currency: the same record with Shards' rules (lib/shards.ts), plus what bets moved.
  const wallet = useWallet(marks, goalsData.loaded);

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
      // "Kept" exactly as the streak counts it (shared habits, skips and all).
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const kept = new Set(streakFrom(allHabits, allTasks, history, sharedData.skips, localDateKey(yesterday), 1).completedDates);
      const didOn = (day: string) => kept.has(day);
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
  // The app dresses for your rank (theme/rankLooks.ts): only once Marks are fully counted.
  useEffect(() => {
    if (!sharedData.historyLoaded || !sharedData.tasksLoaded || !goalsData.loaded) return;
    const { rankFor } = require('@/lib/marks') as typeof import('@/lib/marks');
    (require('@/lib/rankLook') as typeof import('@/lib/rankLook')).setRankLook(rankFor(marks.total).rank.name);
  }, [marks.total, sharedData.historyLoaded, sharedData.tasksLoaded, goalsData.loaded]);
  // The Developer page can play the moment for any rank, to see it.
  useEffect(() => {
    const sub = on('preview_climb', ({ rank }) => {
      const index = RANKS.findIndex(item => item.name === rank);
      if (index > 0) { setClimbMoment({ kind: 'rankUp', rank, index }); playLevelUp(); }
    });
    return () => sub.remove();
  }, [playLevelUp]);
  const [showWallet, setShowWallet] = useState(false);
  // habyss:///home?open=missed (or wallet, or glasses): a link straight to one of Home's sheets.
  const { open: openSheet } = useLocalSearchParams<{ open?: string }>();
  useEffect(() => {
    if (openSheet === 'missed') setShowMissed(true);
    if (openSheet === 'wallet') setShowWallet(true);
    if (openSheet === 'glasses') {
      const { currentRankLook } = require('@/lib/rankLook') as typeof import('@/lib/rankLook');
      emit('glass_open', { rank: currentRankLook().rank ?? 'Lost', marks: marksTotalRef.current });
    }
  }, [openSheet]);


  /**
   * The streak, worked out the one way the app defines a finished day.
   *
   * Home used to count it per goal — a day counted only if every habit under
   * some goal was done, and tasks were not looked at at all. So finishing
   * today's three things moved nothing, and Home could sit on zero while the
   * card that appears when the day is won said three. Two answers to one
   * question is one too many; this is now the same `streakFrom` the card uses.
   */
  // Days off keep the run: counted again when time off starts or ends.
  const timeOffPeriods = useTimeOffPeriods();
  const timeOff = useTimeOff();
  const { streak, bestStreak } = useMemo(() => {
    const today = localDateKey(new Date());
    // The whole shared history, so a run longer than any window still counts.
    const history = { ...sharedData.history, [today]: Object.keys(completions).filter(id => completions[id]) };
    const run = streakFrom(habits, allTasks, history, sharedData.skips, today, undefined, dailyTarget);
    return { streak: run.streak, bestStreak: bestStreakFrom(run.completedDates) };
  }, [habits, allTasks, sharedData.history, sharedData.skips, completions, dailyTarget, timeOffPeriods]);
  // Every 7th day in a row earns a streak freeze (the server allows one a week).
  useEffect(() => { void earnFreezeIfDue(streak); }, [streak]);
  // Goals finished: the trophies on your profile.
  const goalsCompleted = goalsData.finished.length;

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
      goalsCount: goalsData.goals.length,
      overallProgress: avgGoalProgress,
    };
  }, [habits, historyData, completions, goalsData.goals, avgGoalProgress, streak]);


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

  const handleFocusToggle = async (task: Task) => {
    const done = task.status === 'done';
    if (!done && !(await proveTick({ kind: 'task', task }, localDateKey(new Date())))) return;
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

  // Into Focus from here (lib/focusStage.ts): the hourglass turns over, then the page drops
  // away while the bar rises out (the tab bar sinks with them), leaving only the scene that
  // Focus opens on. Coming back, Home settles into place again, the hourglass turning back.
  const reduceMotion = useReducedMotion();
  useFocusEffect(useCallback(() => {
    if (focusLeave.get() > 0 || focusTurn.get() > 0) {
      focusLeave.set(withTiming(0, timingFor(FOCUS_EXIT.return, EASE.enter)));
      focusTurn.set(withTiming(0, timingFor(FOCUS_EXIT.return, EASE.move)));
    }
    setFocusStage(go => {
      if (reduceMotion) { go(); return; }
      // Worked out here, in JavaScript: the callbacks below run on the UI thread, where calling a
      // helper like timingFor crashes the app natively (Jest never sees it).
      const turnTiming = timingFor(FOCUS_ENTRY.flip, EASE.move);
      const leaveTiming = timingFor(FOCUS_ENTRY.leave, EASE.exit);
      focusTurn.set(withTiming(1, turnTiming, turned => {
        'worklet';
        if (!turned) return;
        focusLeave.set(withTiming(1, leaveTiming, left => { 'worklet'; if (left) runOnJS(go)(); }));
      }));
    });
    return () => setFocusStage(null);
  }, [reduceMotion]));
  const pageLeave = useAnimatedStyle(() => ({ transform: [{ translateY: focusLeave.get() * screenHeight }] }));
  const barLeave = useAnimatedStyle(() => ({
    opacity: 1 - focusLeave.get(),
    transform: [{ translateY: -focusLeave.get() * Math.max(1, headerHeight) }],
  }));

  return (
    <VoidShell>
      {/* Transit-style: your rank's scene is the map, fixed behind everything (components/Home/DuneScene.tsx). */}
      <Animated.View style={[homeStyles.scene, sceneFade]} pointerEvents="none">
        <Image source={TEMPLE.image} style={{ width: screenWidth, height: sceneHeight }} accessibilityIgnoresInvertColors />
        {/* Its foot melts into the page's colour. */}
        <LinearGradient colors={[clearOf(colors.background), colors.background]} style={[homeStyles.sceneFoot, { top: sceneHeight * 0.72, height: sceneHeight * 0.28 }]} />
      </Animated.View>
      {/* The day's hourglass on the podium's top step: it never moves; the cards rise over it. */}
      <Animated.View pointerEvents="none" style={[homeStyles.glassStage, { top: stepY - GLASS_HEIGHT / 2, left: horizontalPadding, right: horizontalPadding }, sceneFade]}>
        <DayHourglass marks={marks.total} />
      </Animated.View>
      <Animated.ScrollView
        onScroll={onHomeScroll}
        scrollEventThrottle={16}
        // The page stops at the bar's edge: nothing scrolls under your picture and the stats,
        // so Echo's line can never run into them. The fade under the bar softens the edge.
        style={pageLeave}
        automaticallyAdjustContentInsets={false}
        // The page scrolls up under the bar's fade (it starts below it), so there is no hard line where it stops.
        contentContainerStyle={{ paddingTop: panelTop }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={accentColor}
            colors={[accentColor]}
            progressViewOffset={headerHeight}
          />
        }
      >
          {/* Tap the hourglass for every hourglass: the glass sits under the page, so the page takes the tap where it stands. */}
          <Pressable accessibilityRole="button" accessibilityLabel="See every hourglass"
            onPress={() => { lightFeedback(); emit('glass_open', { rank: rankShown ?? 'Lost', marks: marks.total }); }}
            style={[homeStyles.glassTap, { top: stepY - GLASS_HEIGHT, width: GLASS_HEIGHT, height: GLASS_HEIGHT, marginLeft: -GLASS_HEIGHT / 2 }]} />
          {/* The panel: everything of the day, rising over the scene; the hourglass on its edge. */}
          <View style={[homeStyles.panel, { paddingHorizontal: horizontalPadding, paddingBottom: tabBarClearance, minHeight: screenHeight - headerHeight }]}>
            {/* Its top edge is a shadow of its own colour, melting into the night. */}

          {/* Echo, full width below the header, where it reads as a line
              rather than squeezed into a column beside the picture. */}
          {motivationalQuote ? <EchoLine key={lineTurn} text={motivationalQuote} mood={taskPressureNow.demonAllowed ? taskPressureNow.level : Math.min(3, taskPressureNow.level)} style={{ marginTop: sectionGap }}
            onDone={() => {
              const kind = pendingQuestion.current; if (kind) { pendingQuestion.current = null; setTimeout(() => setQuestion(kind), 400); }
              const asked = pendingTalk.current; if (asked) { pendingTalk.current = null; setTimeout(() => setTalk(asked), 500); }
            }} /> : null}

          {/* Spacer after header */}
          <View style={{ height: sectionGap }} />

          {/* Goals Progress Bar */}
          <Animated.View>
            <View ref={goalsRef} collapsable={false}>
            <GoalsProgressBar
              progress={avgGoalProgress}
              goalsCount={goalsData.goals.length}
              series={goalsData.overallSeries}
              onPress={() => router.push('/goals-overview')}
            />
          </View>
          </Animated.View>

          {/* Off sick or on vacation: what is running, that the streak is safe, and "I'm back". */}
          {timeOff ? <View style={{ marginTop: sectionGap }}><TimeOffCard /></View> : null}

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

            {/* This week's focus, a bar a day: the Focus page's week, at a glance. Measured by the walkthrough. */}
            <View ref={focusRef} collapsable={false} style={{ marginTop: sectionGap }}>
              <FocusWeekCard onOpen={() => { lightFeedback(); router.push('/(root)/focus-stats' as never); }} />
            </View>





          </View>
      </Animated.ScrollView>

      {/* The floating stats bar: your picture and the three stats, fixed over everything, the cards passing under. */}
      {/* Plain dark behind the picture and the stats, no shadow: the page stops at its edge
          and slips under a short fade into it, so there is never a hard line. */}
      <Animated.View style={[homeStyles.bar, { paddingTop: insets.top }, barLeave]} pointerEvents="box-none"
        onLayout={event => setHeaderHeight(event.nativeEvent.layout.height)}>
        {/* No background: the page colour at the very top (the status bar reads on it), fading out
            by the bar's foot, so the sky shows behind your picture and stats, as on Community. */}
        <LinearGradient pointerEvents="none" colors={[colors.background, `${colors.background}99`, `${colors.background}00`]} locations={[0, 0.45, 1]} style={homeStyles.barFade} />
          {/* Header Row
              Your picture with your Marks (XP) as its ring, and your Shards (the
              currency) beside it as a holding: who you are, and what you have. */}
          {/* Slim: just under the status bar and close below, so the scene shows as much as it can. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(12), paddingTop: Spacing.xs, paddingBottom: Spacing.xs, paddingHorizontal: horizontalPadding }}>
            {/* The ring is today: empty at nothing done, closed and green
                when the day is kept. */}
            <ProgressAvatar
              uri={profileAvatar}
              marks={marks}
              onPress={() => router.push('/(root)/profile')}
            />
            {/* Beside it, three stats as icon and figure: Shards, streak, missed. */}
            {/* Three stats, each its own pill: they are three different things. */}
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: s(8) }}>
              <MatteSurface radius={Radius.pill} level="control" elevation="floating" style={homeStyles.statPill}>
                <ShardsCard wallet={wallet} onPress={() => setShowWallet(true)} />
              </MatteSurface>
              {/* Measured by the first-run walkthrough ("Keep the streak"). */}
              <View ref={streakRef} collapsable={false}>
                <MatteSurface radius={Radius.pill} level="control" elevation="floating" style={homeStyles.statPill}>
                  <StreakCard streak={streak} completionTier={completionTier}
                    onPress={() => { lightFeedback(); router.push('/(root)/progress'); }} />
                </MatteSurface>
              </View>
              <View ref={missedRef} collapsable={false}>
                <MatteSurface radius={Radius.pill} level="control" elevation="floating" style={homeStyles.statPill}>
                  <MissedCard missed={missed} onPress={() => { lightFeedback(); setShowMissed(true); }} />
                </MatteSurface>
              </View>
            </View>
          </View>

      </Animated.View>

      <SafeAreaView style={homeStyles.overlays} edges={['top']} pointerEvents="box-none">
        {/* Echo's quick questions. */}
        {/* Echo's question of the day, answered in a word or a line; it comes back tomorrow. */}
        <ChoiceSheet visible={!!talk} title={talk?.text ?? ''} onClose={() => setTalk(null)}
          ask={talk ? { placeholder: talk.placeholder, label: talk.text, save: 'Tell Echo', onSave: answer => {
            const asked = talk; setTalk(null); successFeedback();
            void (require('@/lib/echoConversation') as typeof import('@/lib/echoConversation')).saveAnswer(localDateKey(new Date()), asked, answer);
            const voice = normalizeAIPersonality(aiPersonality || 'friendly');
            const reply = (require('@/lib/echoHuman') as typeof import('@/lib/echoHuman')).heardLine(voice, asked.id);
            quoteRef.current = reply; setLineTurn(turn => turn + 1); setMotivationalQuote(reply);
            // Smarter Echo answers what you actually said, when it is on and quick enough.
            void (async () => {
              const config = await (require('@/lib/echo') as typeof import('@/lib/echo')).getEchoConfig().catch(() => null);
              const better = await (require('@/lib/echoCloud') as typeof import('@/lib/echoCloud')).cloudReply(!!config?.cloudVoice, {
                voice, name: (await getName()) ?? undefined, facts: [], remembered: [], said: [reply], reply: { question: asked.text, answer },
              }).catch(() => null);
              if (better && quoteRef.current === reply) { quoteRef.current = better; setLineTurn(turn => turn + 1); setMotivationalQuote(better); }
            })();
          } } : undefined} />
        <CheckInPopup kind={question} onClose={() => setQuestion(null)}
          onAnswer={(kind, value) => { void answerCheckIn(kind, value); setQuestion(null); successFeedback(); }} />

        <MissedModal
          visible={showMissed}
          onClose={() => setShowMissed(false)}
          missed={missed}
          habits={habits}
        />
        <ShardsWallet visible={showWallet} onClose={() => setShowWallet(false)} wallet={wallet} multiplier={marks.multiplier} perfectRun={marks.perfectRun} />
        <ClimbMomentOverlay moment={climbMoment} onDone={() => setClimbMoment(null)} />
        {/* The end of the Ascent: rising out of its light, then the first step. */}
        <AscentArrival />
        <CelebrationAnimation visible={showCelebration} onComplete={() => setShowCelebration(false)} />
      </SafeAreaView>
    </VoidShell>
  );
};

export default Home;
