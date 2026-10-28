import { FontFamily } from '@/theme/designSystem';
import { HabitSheet } from '@/components/Create/HabitSheet';
import { GoalSheet } from '@/components/Create/GoalSheet';
import { ViewSwitcher } from '@/components/ui/ViewSwitcher';
import { BottomFade } from '@/components/ui/BottomFade';
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, Alert, Dimensions, Image, ImageBackground, Platform, StatusBar, StyleSheet } from 'react-native';
import { MorphMenu, type MorphMenuItem } from '@/components/ui/MorphMenu';
import { IconButton } from '@/components/ui/IconButton';
import { CountUp } from '@/components/ui/Motion';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { HalfCircleProgress } from '@/components/ui/HalfCircleProgress';
import { PanelCap } from '@/components/Goal/PanelCap';
import { Habit, removeGoalWithLinkedHabits, toggleCompletion } from '@/lib/habitsSQLite';
import { cachedCover, resolveCover, setGoalCover } from '@/lib/goalCover';
import { ShareGoalModal } from '@/components/Social/ShareGoalModal';
import { useGoalInsights } from '@/hooks/useGoalInsights';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { GoalPlanBoard } from '@/components/Goal/GoalPlanBoard';
import { TaskFormModal } from '@/components/Tasks/TaskFormModal';
import { useRetained } from '@/hooks/useRetained';
import { LogProgressSheet, type LogMode } from '@/components/Goal/LogProgressSheet';
import { MilestoneSheet } from '@/components/Goal/MilestoneSheet';
import { useMilestones } from '@/hooks/useMilestones';
import { addMilestones, splitIntoMilestones, updateMilestone, type Milestone } from '@/lib/goalMilestones';
import { GoalStatsView } from '@/components/Goal/GoalStatsView';
import { GoalPace } from '@/components/Goal/GoalPace';
import { dateAt } from '@/lib/goalInsights';
import { setTaskStatus, deleteTask, updateTask, type Task } from '@/lib/tasks';
import { useTasks } from '@/hooks/useTasks';
import { DragDropProvider } from '@/components/ui/DragDrop';
import { GoalTodoList, startNewSection } from '@/components/Goal/GoalTodoList';
import { PlanDaySheet } from '@/components/Goal/PlanDaySheet';
import { plannableDays, unplanned } from '@/lib/goalTodo';

import { useHaptics } from '@/hooks/useHaptics';
import { useRemoveHabit } from '@/hooks/useRemoveHabit';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import Animated, {
    useAnimatedRef,
    useAnimatedScrollHandler,
    useSharedValue,
    useAnimatedStyle, FadeIn,
} from 'react-native-reanimated';
import { emit } from '@/lib/appEvents';
import { styles } from '@/styles/screens/goal-detail.styles';

let ImagePicker: any = null;
try { ImagePicker = require('expo-image-picker'); } catch (e) { }

const { height, width } = Dimensions.get('window');
const HEADER_HEIGHT = 380; // Taller header for better visual
/** How far the panel's dome rises over the progress arc. */
const BUMP = 86;

/**
 * Framing the goal's photograph.
 *
 * Only the strip above the panel is ever seen, so a picture told to `cover`
 * the whole screen shows its top third there and buries the subject behind the
 * panel — which is why every goal looked like the sky above whatever it was
 * about.
 *
 * The fix is not a bigger canvas, which is just a heavier crop. The picture is
 * laid out at its *own* proportions, exactly as wide as the screen, so nothing
 * is enlarged and nothing is cut off the sides — then hung so its middle falls
 * in the strip you can actually see.
 *
 * Because the height comes from the image's own aspect ratio rather than from
 * a number picked per device, it frames the same way on every phone.
 */
const HERO_WINDOW = HEADER_HEIGHT - BUMP;
/** Portrait-ish, used only until the real picture has been measured. */
const ASSUMED_ASPECT = 3 / 4;

/**
 * Where to hang a picture of this aspect so its middle lands in the strip.
 *
 * The width is the screen's and the height is whatever the picture's own
 * proportions make it — so it is never enlarged, which was the complaint.
 * Because both numbers come from the image and the screen width rather than
 * from a constant chosen per device, it frames identically on every phone.
 *
 * Nothing forces it to reach the bottom of the screen. Everything below the
 * strip is behind the panel, which is opaque and the same colour as what is
 * behind the picture, so covering it would buy nothing and cost a crop.
 */
function heroFrame(aspect: number, screenWidth: number, window = HERO_WINDOW) {
    const height = Math.round(screenWidth / Math.max(0.2, aspect));
    return { height, top: Math.round(window / 2 - height / 2) };
}
/**
 * A subtle two-tone gradient picked from the goal's id: different for each
 * goal, identical every time the same goal opens. Deep and low-saturated, so it
 * sits in the dark theme rather than shouting over it.
 */
function coverGradient(id: string, light: boolean): [string, string, string] {
    let hash = 0;
    for (let index = 0; index < id.length; index++) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
    const hue = hash % 360;
    const shift = 30 + (hash >> 9) % 50;
    return light
        ? [`hsl(${hue}, 45%, 86%)`, `hsl(${(hue + shift) % 360}, 40%, 80%)`, `hsl(${(hue + shift) % 360}, 30%, 94%)`]
        : [`hsl(${hue}, 42%, 26%)`, `hsl(${(hue + shift) % 360}, 38%, 14%)`, `hsl(${(hue + shift) % 360}, 30%, 7%)`];
}

/** The panel with the progress arc covers this much of the page when it opens; the cover shows above it. */
const PANEL_SHARE = 0.75;
/** The panel's own gap above its dome (styles.panelWrap.marginTop). */
const PANEL_GAP = 20;

/** HalfCircleProgress leaves this much box below its arc's baseline. */
const ARC_BASELINE = 5;

const GoalDetail = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const goalIdParam = params.goalId;
  const goalId = Array.isArray(goalIdParam) ? goalIdParam[0] : goalIdParam;
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { primary: accentColor } = useAccentGradient();

  const { goal, completions, setCompletion, insights, today } = useGoalInsights(goalId);
  // Undefined until known, so the first frame never flashes the placeholder
  // over a cover that is about to appear.
  const [bgImage, setBgImage] = useState<string | null | undefined>(() => (goalId ? cachedCover(goalId) : null));

  // The picture's own proportions decide how it is hung, so it frames the same
  // way on every phone instead of being cropped to a number chosen per device.
  const [aspect, setAspect] = useState(ASSUMED_ASPECT);
  useEffect(() => {
    if (!bgImage) { setAspect(ASSUMED_ASPECT); return; }
    let alive = true;
    Image.getSize(
      bgImage,
      (w, h) => { if (alive && w > 0 && h > 0) setAspect(w / h); },
      () => { if (alive) setAspect(ASSUMED_ASPECT); },
    );
    return () => { alive = false; };
  }, [bgImage]);

  /** This sheet's height, so the ⋯ menu opens exactly on its button. */
  const [pageHeight, setPageHeight] = useState<number | undefined>(undefined);
  // And its width: on an iPad the sheet is narrower than the screen.
  const [pageWidth, setPageWidth] = useState<number | undefined>(undefined);
  // The panel's dome starts a quarter of the way down, so the panel fills the
  // bottom three quarters; the cover is framed in the strip left above it.
  const panelTop = Math.round((pageHeight ?? height) * (1 - PANEL_SHARE));
  const heroBox = useMemo(() => heroFrame(aspect, pageWidth ?? width, panelTop + BUMP / 2), [aspect, panelTop, pageWidth]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  // A new habit made from this page belongs to this goal.
  const [addingHabit, setAddingHabit] = useState(false);
  const [view, setView] = useState<'plan' | 'todo' | 'stats'>('plan');
  // The checkpoints between today and the goal's end (lib/goalMilestones.ts).
  const milestones = useMilestones(goal?.id);
  const [milestoneSheet, setMilestoneSheet] = useState<{ milestone: Milestone | null } | null>(null);
  // Kept while the sheet slides away.
  const shownMilestoneSheet = useRetained(milestoneSheet);
  const goalEnd = insights && goal?.targetDate ? insights.endDate : undefined;
  /** "Read 24 books by Dec 31" split into Book 1 … Book 24, evenly through the time left. */
  const splitPlan = useMemo(() => {
    if (!goal || !goalEnd) return [];
    let target = insights?.measure.total ?? 0;
    let unit: string | null = insights?.measure.unit ?? null;
    try {
      const spec = goal.goalSpec ? JSON.parse(goal.goalSpec) : null;
      if (spec?.target > 0) { target = Number(spec.target); unit = spec.metric_unit ?? unit; }
    } catch { /* the measure above will do */ }
    const verb = goal.name.trim().split(/\s+/)[0];
    return splitIntoMilestones({ target, unit, verb: /^\d/.test(verb) ? undefined : verb, start: today, end: goalEnd });
  }, [goal, goalEnd, insights, today]);
  // Offered inside New milestone (not the ⋯ menu): the whole plan in one tap, while there are none yet.
  const split = goal && splitPlan.length > 1 && milestones.length === 0 ? {
    count: splitPlan.length,
    detail: `${splitPlan[0].title} by ${dateAt(splitPlan[0].dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, then evenly to the end`,
    onSplit: () => addMilestones(goal.id, splitPlan),
  } : undefined;
  const toggleMilestone = (milestone: Milestone) => {
    void updateMilestone(milestone, { done: !milestone.doneAt }).catch(() => Alert.alert('Not saved', 'That milestone could not be updated. Try again.'));
  };
  // Shared goals are not available yet; kept so the owner-only actions stay gated.
  const [isSharedGoal] = useState(false);

  const { selectionFeedback, lightFeedback } = useHaptics();
  const { playComplete } = useSoundEffects();
  const insets = useSafeAreaInsets();

  const scrollY = useSharedValue(0);

  // Header Animation - Defined early to avoid hook errors
  /**
   * The picture always reaches past the panel's edge, and pulling the page
   * down stretches it with the pull (the way iOS headers do), so its bottom
   * edge is never seen above the panel.
   */
  const coverReach = panelTop + BUMP + 40;
  const heroStretch = useAnimatedStyle(() => ({
    height: Math.max(heroBox.height, coverReach - heroBox.top) + Math.max(0, -scrollY.value),
  }), [heroBox, coverReach]);
  const coverStretch = useAnimatedStyle(() => ({ height: coverReach + Math.max(0, -scrollY.value) }), [coverReach]);
  const fadeFollow = useAnimatedStyle(() => ({ transform: [{ translateY: Math.max(0, -scrollY.value) }] }));

  const headerStyle = useAnimatedStyle(() => {
    return {
      opacity: 1 - Math.min(1, scrollY.value / 200),
      transform: [{ translateY: scrollY.value * 0.5 }]
    };
  });

  // Re-resolved whenever the goal row changes, which is how a cover somebody
  // else on the goal set arrives.
  useEffect(() => {
    if (!goal) return;
    let isActive = true;
    resolveCover(goal).then(uri => { if (isActive) setBgImage(uri); }).catch(() => { if (isActive) setBgImage(null); });
    return () => { isActive = false; };
  }, [goal?.id, goal?.goalSpec]);

  // Opening a goal is when its shared plan is most worth having fresh.
  useEffect(() => {
    const { refreshShared } = require('@/lib/cloudSync') as typeof import('@/lib/cloudSync');
    void refreshShared().catch(() => 0);
  }, [goalId]);

  const progress = insights?.progress ?? 0;

  const scrollHandler = useAnimatedScrollHandler(event => {
    scrollY.value = event.contentOffset.y;
  });

  const [editingGoal, setEditingGoal] = useState(false);

  /**
   * Opens the same sheet the goal was created in, mounted *here*.
   *
   * It used to emit `show_goal_quick_add`, which raises the copy of the sheet
   * mounted at the root — and this screen is itself a modal route. Asking iOS
   * to present a second modal from a view controller that already has one
   * presented froze the app rather than warning about it, and the
   * `SocketStream write error ... 1 32` in the console was the dev server's
   * socket giving up on a JavaScript thread that had stopped answering.
   *
   * The habit sheet below this has always been mounted locally for the same
   * reason; the goal was simply the one that got away.
   */
  const handleEditGoal = () => {
    if (!goal) return;
    setEditingGoal(true);
  };


  const toggleTask = async (task: Task) => {
    selectionFeedback();
    try {
      await setTaskStatus(task.id, task.status === 'done' ? 'open' : 'done');
      emit('tasks_changed');
    } catch { Alert.alert('Could not save task', 'Please try again.'); }
  };

  const removeTask = (task: Task) => {
    Alert.alert('Delete task', `Delete "${task.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try { await deleteTask(task.id); emit('tasks_changed'); }
          catch { Alert.alert('Could not delete task', 'Your task is still saved. Please try again.'); }
        },
      },
    ]);
  };

  /**
   * The task sheet, mounted on this page. Asking the copy at the root for it
   * (show_task_form) presented a second modal over this modal route, which
   * iOS answers by freezing the app; the goal and habit sheets are mounted
   * here for the same reason.
   */
  const [taskForm, setTaskForm] = useState<{ task: Task | null; key: number; dueDate?: string } | null>(null);
  // Progress written straight onto the goal: how it counts follows what it is.
  const [logging, setLogging] = useState(false);
  const logSpec = (() => { try { return goal?.goalSpec ? JSON.parse(goal.goalSpec) : null; } catch { return null; } })();
  const logMode: LogMode = logSpec?.aggregation === 'max' ? 'best' : logSpec?.aggregation === 'latest' ? 'latest' : 'sum';
  const canLog = !!logSpec && (logSpec.target > 0 || logSpec.delta_from_baseline !== null && logSpec.delta_from_baseline !== undefined) && logSpec.kind !== 'complete';
  const logUnit = String(logSpec?.metric_unit ?? '').replace(/^minutes$/, 'min');
  const openTask = (task?: Task, dueDate?: string) => {
    lightFeedback();
    setTaskForm({ task: task ?? null, key: Date.now(), dueDate });
  };

  /**
   * The to-do list: the goal's tasks, under headings, each planned on a day
   * (here, or by dragging it onto a day on the plan) from today to the
   * deadline.
   */
  const allTasks = useTasks();
  const goalTasks = useMemo(() => allTasks.filter(task => task.goalId === goalId), [allTasks, goalId]);
  const todos = useMemo(() => unplanned(goalTasks), [goalTasks]);
  const planRange = plannableDays(today, goal?.targetDate && insights ? insights.endDate : null);
  const [planning, setPlanning] = useState<Task | null>(null);
  const planTodo = (task: Task, day: string | null, fromSheet = true) => {
    lightFeedback();
    setPlanning(null);
    // The sheet closes first and the day is saved once it has gone: saving
    // redraws the plan, and doing that while the sheet was still sliding away
    // is what froze the app.
    const save = () => void updateTask(task.id, { dueDate: day }).then(() => emit('tasks_changed'))
      .catch(() => Alert.alert('Not planned', 'That to-do could not be saved. Try again.'));
    if (fromSheet) setTimeout(save, 260); else save();
  };
  // Carrying a to-do: the page holds still, and scrolls along at its edges.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const [carrying, setCarrying] = useState(false);
  const scrollBy = React.useCallback((dy: number) => {
    scrollRef.current?.scrollTo({ y: Math.max(0, scrollY.value + dy), animated: false });
  }, [scrollRef, scrollY]);
  const dropTodo = React.useCallback((taskId: string, day: string) => {
    const task = goalTasks.find(item => item.id === taskId);
    if (task) planTodo(task, day, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalTasks]);

  /**
   * One menu instead of four buttons competing with the goal's own name.
   * A shared goal is someone else's, so it only offers what it can do.
   */
  /** The goal's options, in the menu the ⋯ button grows into: first what fits the page you are on. */
  const goalMenu: MorphMenuItem[] = [
    // On the to-do list: a new heading, and a to-do with a day already.
    ...(!isSharedGoal && view === 'todo' ? [
      { label: 'New section', icon: 'list-outline' as const, onPress: () => { lightFeedback(); if (goal) startNewSection(goal.id); } },
      { label: 'Add task with a day', icon: 'checkbox-outline' as const, onPress: () => openTask(undefined, today) },
    ] : []),
    // Anything added from here is filed under this goal straight away.
    ...(!isSharedGoal && view !== 'todo' ? [
      { label: 'Add habit', icon: 'repeat-outline' as const, onPress: () => { lightFeedback(); setAddingHabit(true); } },
      { label: 'Add task', icon: 'checkbox-outline' as const, onPress: () => openTask() },
      { label: 'Add milestone', icon: 'flag-outline' as const, onPress: () => { lightFeedback(); setMilestoneSheet({ milestone: null }); } },
      ...(canLog ? [{ label: 'Log progress', icon: 'create-outline' as const, onPress: () => { lightFeedback(); setLogging(true); } }] : []),
    ] : []),
    { label: 'Change cover photo', icon: 'image-outline', onPress: () => handleChangeBackground() },
    ...(!isSharedGoal ? [
      { label: 'Share with a friend', icon: 'person-add-outline' as const, onPress: () => setShowShareModal(true) },
      { label: 'Edit goal', icon: 'create-outline' as const, onPress: () => handleEditGoal() },
      { label: 'Delete goal', icon: 'trash-outline' as const, destructive: true, onPress: () => handleDeleteGoal() },
    ] : []),
  ];

  /**
   * The two buttons change what this page is showing rather than opening
   * another one: Today, the numbers, or the whole plan. Tapping the button
   * you are already on brings Today back.
   */
  const showView = (next: 'plan' | 'todo' | 'stats') => {
    lightFeedback();
    setView(next);
  };

  const handleDeleteGoal = () => {
    Alert.alert("Delete Goal", "This deletes the goal and its habits and tasks. Continue?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete All", style: "destructive",
        onPress: () => {
          if (goal) {
            // Navigate back instantly — delete fires in background
            router.back();
            removeGoalWithLinkedHabits(goal.id).catch(console.error);
          }
        }
      }
    ]);
  };

  const handleHabitPress = (habit: Habit) => {
    const isCompleted = !completions[habit.id];
    // A tap ticks anything; a second tap takes it back.
    if (isCompleted) {
      playComplete();
      selectionFeedback();
    } else {
      lightFeedback();
    }
    setCompletion(habit.id, isCompleted);
    // Fire and forget for instant response
    toggleCompletion(habit.id, today).catch(() => {
      setCompletion(habit.id, !isCompleted);
      Alert.alert('Could not save progress', 'Your check-in was not saved. Please try again.');
    });
  };

  const askRemoveHabit = useRemoveHabit();
  const handleDeleteHabit = (habit: Habit) => askRemoveHabit(habit);

  const handleChangeBackground = async () => {
    if (!ImagePicker) {
      Alert.alert("Feature Unavailable", "Run expo run:ios/android for this feature.");
      return;
    }
    Alert.alert("Change Background", "Choose an option", [
      {
        text: "Take Photo",
        onPress: async () => {
          try {
            // ... existing logic ...
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') return Alert.alert('Permission Required');
            const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [16, 9], quality: 0.7 });
            if (!result.canceled && result.assets[0] && goal) {
              setBgImage(await setGoalCover(goal, result.assets[0].uri));
            }
          } catch (e) { }
        }
      },
      {
        text: "Choose from Library",
        onPress: async () => {
          try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') return Alert.alert('Permission Required');
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [16, 9], quality: 0.7 });
            if (!result.canceled && result.assets[0] && goal) {
              setBgImage(await setGoalCover(goal, result.assets[0].uri));
            }
          } catch (e) { }
        }
      },
      { text: "Cancel", style: "cancel" }
    ]);
  };

  // Same count as Stats and Roadmap; date-only targets stay on their calendar day.
  const daysLeft = insights?.daysLeft ?? 0;

  if (!goalId) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <Text style={{ color: colors.textSecondary }}>Goal is unavailable</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: accentColor }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!goal) return null;

  // Header Animation moved to top

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} onLayout={event => { setPageHeight(event.nativeEvent.layout.height); setPageWidth(event.nativeEvent.layout.width); }}>
      <StatusBar barStyle={theme === 'light' ? 'dark-content' : 'light-content'} />

      {/* The goal's picture, shown whole and unshaded. The only shadow on it
          is the one the panel casts. */}
      <View style={styles.heroClip} pointerEvents="none">
        {/* No photo: a quiet gradient of its own, the same every time this
            goal opens, rather than the app icon blown up behind it. */}
        {bgImage === null ? (
          <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0 }, coverStretch]}>
            <LinearGradient
              colors={coverGradient(goal.id, theme === 'light')}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        ) : null}
        {bgImage ? (
          <Animated.View style={[{ position: 'absolute', top: heroBox.top, left: 0, right: 0 }, heroStretch]}>
            <ImageBackground source={{ uri: bgImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          </Animated.View>
        ) : null}
        {/* The picture settles into the page above the panel's edge, so the two
            meet softly instead of at a hard line; it follows the edge down a pull. */}
        <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: panelTop + BUMP - 150, height: 150 }, fadeFollow]}>
          <LinearGradient colors={[`${colors.background}00`, `${colors.background}8C`]} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>

      {/* Navigation Header */}
      {/* A fixed distance from the sheet's top edge. A safe-area view here
          reported the full status-bar inset on the first open and nothing
          afterwards, so the buttons sat low the first time only. */}
      <View style={[styles.navHeader, Platform.OS === 'android' && { paddingTop: insets.top + 8 }]}>
        <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} diameter={40} size={24} />
        <MorphMenu items={goalMenu} title={goal?.name} titleIcon="flag" label="Goal options" diameter={40} pageHeight={pageHeight} />
      </View>

      <DragDropProvider onDrop={dropTodo} onDragging={setCarrying} scrollBy={scrollBy} style={styles.dragLayer}>
      <Animated.ScrollView
        ref={scrollRef}
        scrollEnabled={!carrying}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        // The dome takes the space the arc used to overlap into, sitting a
        // little lower than the old floating arc did.
        contentContainerStyle={{ paddingTop: Math.max(0, panelTop - PANEL_GAP), paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Content Area. The panel's top edge domes up around the progress
            arc, so nothing shows through the gap inside it. */}
        <Animated.View entering={FadeIn.duration(500)} style={styles.panelWrap}>
          <PanelCap width={width} bump={BUMP} corner={40} color={colors.background} border={colors.border} />

          <View style={[styles.progressBadgeContainer, { height: BUMP }]}>
            {/* The arc's own baseline sits 5 points above its box, so the box
                hangs that far past the panel edge: both semicircles then share
                one centre and the ring of background around the arc is even. */}
            <View style={{ marginBottom: -ARC_BASELINE }}>
              <HalfCircleProgress
                progress={progress}
                size={140}
                strokeWidth={12}
                color={goal.color || accentColor}
                backgroundColor={colors.surfaceSecondary}
                textColor={colors.text}
                fontSize={28}
                showPercentage={true}
              />
            </View>
          </View>

          <View style={[styles.contentContainer, { backgroundColor: colors.background }]}>

          {/* Dashboard Header */}
          <View style={{ marginTop: 24, paddingHorizontal: 20 }}>
            <View style={{ gap: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.goalTitle, { color: colors.text }]}>{goal.name}</Text>
                {/* The date, quietly: it is context, not the headline. */}
                <View style={styles.targetRow}>
                  <Ionicons name="calendar-outline" size={12} color={colors.textTertiary} />
                  <Text style={[styles.goalTarget, { color: colors.textTertiary }]}>
                    {insights && goal.targetDate ? dateAt(insights.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Ongoing'}
                  </Text>
                  {daysLeft > 0 ? <CountUp style={[styles.goalTarget, { color: colors.textTertiary }]} value={`· ${daysLeft} days left`} /> : null}
                </View>
              </View>
              {/* Everything a goal can do lives behind the ⋯ in the header. */}
              {isSharedGoal ? (
                <View style={[styles.sharedBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                  <Ionicons name="people" size={14} color="#10B981" />
                  <Text style={{ color: '#10B981', fontSize: 11,  marginLeft: 4, fontFamily: FontFamily.semibold }}>Shared</Text>
                </View>
              ) : null}
            </View>

            {goal.description && (
              <Text style={[styles.goalDescription, { color: colors.textSecondary }]}>{goal.description}</Text>
            )}
          </View>

          {/* Today, Stats and Roadmap all start the same distance under the
              description, each with the same heading, so switching between
              them moves nothing but the content. */}
          {/* Plan (a day, a week, a month or all of it) and Stats start the
              same distance under the description, so switching moves only
              the content. */}
          <Animated.View key={view} entering={FadeIn.duration(220)} style={[styles.tabBody, styles.swapped]}>
            {view === 'stats' ? <GoalStatsView goalId={goal.id} embedded /> : view === 'todo' ? (
              <View style={styles.todoBody}>
                <GoalTodoList goalId={goal.id} tasks={goalTasks} today={today} color={goal.color || accentColor} readOnly={isSharedGoal}
                  onOpenTask={task => openTask(task)} onPlan={task => { lightFeedback(); setPlanning(task); }} onToggle={task => void toggleTask(task)} />
              </View>
            ) : insights ? (
              <GoalPlanBoard
                goalId={goal.id} insights={insights} milestones={milestones} today={today}
                color={goal.color || accentColor} readOnly={isSharedGoal}
                pace={insights.measure.total > 0 ? <GoalPace measure={insights.measure} color={goal.color || accentColor} /> : undefined}
                onToggleTask={task => void toggleTask(task)}
                onOpenTask={openTask}
                onRemoveTask={removeTask}
                onToggleHabit={handleHabitPress}
                onOpenHabit={habit => router.push({ pathname: '/habit-detail', params: { habitId: habit.id } })}
                onEditHabit={habit => setEditingHabit(habit)}
                onToggleMilestone={toggleMilestone}
                onOpenMilestone={milestone => setMilestoneSheet({ milestone })}
                onLog={canLog && !isSharedGoal ? () => { lightFeedback(); setLogging(true); } : undefined}
                todos={todos} planUntil={planRange.to}
                onPlanTodo={(task, day) => planTodo(task, day, false)}
                onChooseDay={task => setPlanning(task)}
              />
            ) : null}
          </Animated.View>

          </View>
        </Animated.View>
      </Animated.ScrollView>
      </DragDropProvider>
      {/* The page dims into this behind the switcher, as it does behind the tab bar. */}
      <BottomFade height={insets.bottom + 16 + 64 + 56} />
      {/* Today, the numbers, or the whole plan — without leaving the page. */}
      <View pointerEvents="box-none" style={[styles.floatingRow, { bottom: insets.bottom + 16 }]}>
        <ViewSwitcher
          options={[
            // In the order a goal is worked: write down what it needs, plan it on days, see how far it has come.
            { id: 'todo', label: 'To-do', icon: 'list-outline' },
            { id: 'plan', label: 'Plan', icon: 'map-outline' },
            { id: 'stats', label: 'Stats', icon: 'stats-chart-outline' },
          ]}
          value={view}
          onChange={showView}
          accent={goal.color || accentColor}
        />
      </View>


      {goal && canLog ? (
        <LogProgressSheet visible={logging} goalId={goal.id} goalName={goal.name} unit={logUnit} mode={logMode} onClose={() => setLogging(false)} />
      ) : null}
      {taskForm && goal ? (
        <TaskFormModal key={taskForm.key} visible task={taskForm.task} goalId={goal.id} dueDate={taskForm.dueDate}
          onClose={() => setTaskForm(null)} onSaved={() => emit('tasks_changed')} />
      ) : null}
      {goal && insights ? (
        <PlanDaySheet task={planning} insights={insights} milestones={milestones} today={today} from={planRange.from} to={planRange.to}
          color={goal.color || accentColor} onPlan={planTodo} onClose={() => setPlanning(null)} />
      ) : null}
      {goal ? (
        <MilestoneSheet visible={!!milestoneSheet} goalId={goal.id} goalEnd={goalEnd} milestone={shownMilestoneSheet?.milestone ?? null} split={split} onClose={() => setMilestoneSheet(null)} />
      ) : null}
      {editingHabit && <HabitSheet visible habit={editingHabit} goalId={editingHabit.goalId} onClose={() => setEditingHabit(null)} />}
      {addingHabit && <HabitSheet visible goalId={goal.id} onClose={() => setAddingHabit(false)} onSaved={() => setAddingHabit(false)} />}
      {editingGoal && goal && (
        <GoalSheet visible goal={goal} onClose={() => setEditingGoal(false)} onSaved={() => setEditingGoal(false)} />
      )}
      <ShareGoalModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        goalId={goal.id}
        goalName={goal.name}
      />
    </View>
  );
};


export default GoalDetail;
