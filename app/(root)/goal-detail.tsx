import { FontFamily } from '@/constants/DesignSystem';
import { HabitSheet } from '@/components/Create/HabitSheet';
import { ViewSwitcher } from '@/components/Common/ViewSwitcher';
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ActionSheetIOS, Alert, Dimensions, Image, ImageBackground, Platform, StyleSheet, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { BlurView } from 'expo-blur';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { HalfCircleProgress } from '@/components/Common/HalfCircleProgress';
import { PanelCap } from '@/components/Goal/PanelCap';
import { Habit, removeHabitEverywhere, removeGoalWithLinkedHabits, toggleCompletion } from '@/lib/habitsSQLite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { ShareGoalModal } from '@/components/ShareGoalModal';
import { useGoalInsights } from '@/hooks/useGoalInsights';
import { GoalHabitRow, SectionLabel } from '@/components/Goal/GoalRows';
import { GoalStatsView } from '@/components/Goal/GoalStatsView';
import { GoalPlanView } from '@/components/Goal/GoalPlanView';
import { dateAt, friendlyDate } from '@/lib/goalInsights';
import { TaskItem, TASK_COLOR } from '@/components/Roadmap/TaskItem';
import { setTaskStatus, deleteTask, type Task } from '@/lib/tasks';

import { useHaptics } from '@/hooks/useHaptics';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import Animated, {
    useAnimatedScrollHandler,
    useSharedValue,
    useAnimatedStyle, FadeIn,
} from 'react-native-reanimated';
import { VoidCard } from '@/components/Layout/VoidCard';
import { emit } from '@/lib/appEvents';

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
function heroFrame(aspect: number, screenWidth: number) {
    const height = Math.round(screenWidth / Math.max(0.2, aspect));
    return { height, top: Math.round(HERO_WINDOW / 2 - height / 2) };
}
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
  const [bgImage, setBgImage] = useState<string | null>(null);

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

  const heroBox = useMemo(() => heroFrame(aspect, width), [aspect]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [view, setView] = useState<'today' | 'stats' | 'plan'>('today');
  // Shared goals are not available yet; kept so the owner-only actions stay gated.
  const [isSharedGoal] = useState(false);

  const { selectionFeedback, lightFeedback } = useHaptics();
  const { playComplete } = useSoundEffects();
  const insets = useSafeAreaInsets();

  const scrollY = useSharedValue(0);

  // Header Animation - Defined early to avoid hook errors
  const headerStyle = useAnimatedStyle(() => {
    return {
      opacity: 1 - Math.min(1, scrollY.value / 200),
      transform: [{ translateY: scrollY.value * 0.5 }]
    };
  });

  useEffect(() => {
    if (!goalId) return;
    let isActive = true;
    AsyncStorage.getItem(`goal_bg_${goalId}`).then(stored => { if (stored && isActive) setBgImage(stored); });
    return () => { isActive = false; };
  }, [goalId]);

  const progress = insights?.progress ?? 0;

  // What this goal asks of today: habits scheduled today, tasks due today
  // (kept after ticking, so the list does not jump), and anything overdue.
  const todayHabits = useMemo(
    () => (insights?.habits ?? []).filter(summary => summary.scheduledToday || summary.doneToday),
    [insights],
  );
  const todayTasks = useMemo(
    () => (insights ? [
      ...insights.tasks.upcoming.filter(task => task.dueDate === today),
      ...insights.tasks.completed.filter(task => task.dueDate === today),
    ] : []),
    [insights, today],
  );
  const overdueTasks = insights?.tasks.overdue ?? [];
  const todayTotal = todayHabits.length + todayTasks.length;
  const todayDone = todayHabits.filter(summary => summary.doneToday).length
    + todayTasks.filter(task => task.status === 'done').length;
  const nextUp = insights?.upNext.find(item => item.date > today) ?? null;

  const scrollHandler = useAnimatedScrollHandler(event => {
    scrollY.value = event.contentOffset.y;
  });

  const handleEditGoal = () => {
    if (!goal) return;
    // The same sheet the goal was created in, so editing asks the same questions.
    emit('show_goal_quick_add', { goal });
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

  const openTask = (task?: Task) => {
    lightFeedback();
    emit('show_task_form', task ? { task } : { goalId: goal?.id });
  };

  const addHabitToGoal = () => {
    lightFeedback();
    emit('show_habit_modal', { goalId: goal?.id });
  };

  /**
   * One menu instead of four buttons competing with the goal's own name.
   * A shared goal is someone else's, so it only offers what it can do.
   */
  const openGoalMenu = () => {
    lightFeedback();
    const actions: { label: string; destructive?: boolean; run: () => void }[] = [
      { label: 'Change cover photo', run: handleChangeBackground },
    ];
    if (!isSharedGoal) {
      actions.push(
        { label: 'Share with a friend', run: () => setShowShareModal(true) },
        { label: 'Edit goal', run: handleEditGoal },
        { label: 'Delete goal', destructive: true, run: handleDeleteGoal },
      );
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({
        title: goal?.name,
        options: [...actions.map(action => action.label), 'Cancel'],
        cancelButtonIndex: actions.length,
        destructiveButtonIndex: actions.findIndex(action => action.destructive),
        userInterfaceStyle: theme === 'light' ? 'light' : 'dark',
      }, index => actions[index]?.run());
      return;
    }

    Alert.alert(goal?.name ?? 'Goal', undefined, [
      ...actions.map(action => ({ text: action.label, style: action.destructive ? 'destructive' as const : undefined, onPress: action.run })),
      { text: 'Cancel', style: 'cancel' as const },
    ], { cancelable: true });
  };

  /**
   * The two buttons change what this page is showing rather than opening
   * another one: Today, the numbers, or the whole plan. Tapping the button
   * you are already on brings Today back.
   */
  const showView = (next: 'today' | 'stats' | 'plan') => {
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

  const handleDeleteHabit = (habit: Habit) => {
    Alert.alert("Delete Habit", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => removeHabitEverywhere(habit.id) }
    ]);
  };

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
            if (!result.canceled && result.assets[0]) {
              setBgImage(result.assets[0].uri);
              await AsyncStorage.setItem(`goal_bg_${goalId}`, result.assets[0].uri);
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
            if (!result.canceled && result.assets[0]) {
              setBgImage(result.assets[0].uri);
              await AsyncStorage.setItem(`goal_bg_${goalId}`, result.assets[0].uri);
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
          <Text style={{ color: colors.primary }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!goal) return null;

  // Header Animation moved to top

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={theme === 'light' ? 'dark-content' : 'light-content'} />

      {/* The goal's picture, shown whole and unshaded. The only shadow on it
          is the one the panel casts. */}
      <View style={styles.heroClip} pointerEvents="none">
        <ImageBackground
          source={bgImage ? { uri: bgImage } : require('@/assets/images/adaptive-icon.png')}
          style={{ position: 'absolute', top: heroBox.top, left: 0, right: 0, height: heroBox.height }}
          resizeMode="cover"
        />
      </View>

      {/* Navigation Header */}
      <SafeAreaView style={styles.navHeader} edges={['top']}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.blurBtn}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <Ionicons name="chevron-back" size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Goal options" onPress={openGoalMenu} style={styles.blurBtn}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <Ionicons name="ellipsis-horizontal" size={20} color="white" />
        </TouchableOpacity>
      </SafeAreaView>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        // The dome takes the space the arc used to overlap into, sitting a
        // little lower than the old floating arc did.
        contentContainerStyle={{ paddingTop: HEADER_HEIGHT - 46 - BUMP, paddingBottom: 140 }}
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
                <Text style={[styles.dashboardLabel, { color: colors.textTertiary }]}>GOAL</Text>
                <Text style={[styles.goalTitle, { color: colors.text }]}>{goal.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} style={{ marginRight: 4 }} />
                  <Text style={[styles.goalTarget, { color: colors.textTertiary }]}>Target: {insights && goal.targetDate ? dateAt(insights.endDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : 'Ongoing'}</Text>
                  {daysLeft > 0 && <View style={[styles.daysTag, { backgroundColor: (goal.color || accentColor) + '20' }]}><Text style={[styles.daysTagText, { color: goal.color || accentColor }]}>{daysLeft} days left</Text></View>}
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

          {view !== 'today' ? (
            <Animated.View key={view} entering={FadeIn.duration(220)} style={styles.swapped}>
              {view === 'stats'
                ? <GoalStatsView goalId={goal.id} embedded />
                : <GoalPlanView goalId={goal.id} embedded />}
            </Animated.View>
          ) : (
          /* Today: only what this goal asks of the user today. The numbers and
             the whole plan replace it in place, from the buttons below. */
          <Animated.View key="today" entering={FadeIn.duration(220)}>
          <VoidCard glass style={[styles.mainPanel, { backgroundColor: theme === 'light' ? colors.surfaceSecondary : undefined }]}>
            <View style={styles.todayHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Today</Text>
                <Text style={[styles.todayDate, { color: colors.textTertiary }]}>
                  {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                </Text>
              </View>
              {todayTotal > 0 ? (
                <View style={[styles.todayCount, { backgroundColor: (goal.color || accentColor) + '1F' }]}>
                  <Text style={[styles.todayCountText, { color: goal.color || accentColor }]}>{todayDone}/{todayTotal} done</Text>
                </View>
              ) : null}
            </View>

            {overdueTasks.length > 0 ? (
              <>
                <SectionLabel tone={colors.error}>Overdue</SectionLabel>
                {overdueTasks.map(task => (
                  <TaskItem key={task.id} task={task} today={today} onToggle={toggleTask} onPress={() => openTask(task)} onEdit={() => openTask(task)} onDelete={removeTask} />
                ))}
              </>
            ) : null}

            {todayHabits.length > 0 ? (
              <>
                <SectionLabel>Habits</SectionLabel>
                {todayHabits.map(summary => (
                  <GoalHabitRow
                    key={summary.habit.id}
                    summary={summary}
                    color={goal.color || accentColor}
                    detail={summary.streak > 1 ? `${summary.schedule} · ${summary.streak} in a row` : summary.schedule}
                    onToggle={() => handleHabitPress(summary.habit)}
                    onPress={() => router.push({ pathname: '/habit-detail', params: { habitId: summary.habit.id } })}
                    onLongPress={() => setEditingHabit(summary.habit)}
                  />
                ))}
              </>
            ) : null}

            {todayTasks.length > 0 ? (
              <>
                <SectionLabel>Tasks</SectionLabel>
                {todayTasks.map(task => (
                  <TaskItem key={task.id} task={task} today={today} onToggle={toggleTask} onPress={() => openTask(task)} onEdit={() => openTask(task)} onDelete={removeTask} />
                ))}
              </>
            ) : null}

            {todayTotal === 0 && overdueTasks.length === 0 ? (
              <View style={styles.restDay}>
                <Ionicons name={insights?.status === 'empty' ? 'map-outline' : 'moon-outline'} size={26} color={colors.textTertiary} />
                <Text style={[styles.restTitle, { color: colors.textPrimary }]}>
                  {insights?.status === 'empty' ? 'Build the plan' : 'Nothing due today'}
                </Text>
                <Text style={[styles.restBody, { color: colors.textTertiary }]}>
                  {insights?.status === 'empty'
                    ? 'Add the habits you will repeat and the tasks you must finish to reach this goal.'
                    : nextUp
                      ? `Next: ${nextUp.title}, ${friendlyDate(nextUp.date, today).toLowerCase()}${nextUp.time ? ` at ${nextUp.time}` : ''}.`
                      : 'Your plan has nothing scheduled. Add a habit or task in Roadmap.'}
                </Text>
              </View>
            ) : null}

            {!isSharedGoal ? (
              <View style={styles.addRow}>
                <TouchableOpacity accessibilityRole="button" onPress={addHabitToGoal} style={[styles.addPill, { borderColor: colors.border }]}>
                  <Ionicons name="repeat" size={15} color={goal.color || accentColor} />
                  <Text style={[styles.addText, { color: colors.textSecondary }]}>Habit</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" onPress={() => openTask()} style={[styles.addPill, { borderColor: colors.border }]}>
                  <Ionicons name="checkbox-outline" size={15} color={TASK_COLOR} />
                  <Text style={[styles.addText, { color: colors.textSecondary }]}>Task</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </VoidCard>
          </Animated.View>
          )}

          </View>
        </Animated.View>
      </Animated.ScrollView>
      {/* Today, the numbers, or the whole plan — without leaving the page. */}
      <View pointerEvents="box-none" style={[styles.floatingRow, { bottom: insets.bottom + 16 }]}>
        <ViewSwitcher
          options={[
            { id: 'today', label: 'Today', icon: 'today-outline' },
            { id: 'stats', label: 'Stats', icon: 'stats-chart-outline' },
            { id: 'plan', label: 'Roadmap', icon: 'map-outline' },
          ]}
          value={view}
          onChange={showView}
          accent={goal.color || accentColor}
        />
      </View>


      {editingHabit && <HabitSheet visible habit={editingHabit} goalId={editingHabit.goalId} onClose={() => setEditingHabit(null)} />}
      <ShareGoalModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        goalId={goal.id}
        goalName={goal.name}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  heroClip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  navHeader: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 50,
  },
  blurBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center'
  },
  heroOverlay: {
    position: 'absolute',
    top: 88,
    left: 0,
    right: 0,
    zIndex: 5,
  },
  heroContent: {
    paddingHorizontal: 24,
  },
  heroEyebrow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 14,
  },
  heroEyebrowText: {
    fontSize: 10,
    letterSpacing: 1.2,
    fontFamily: FontFamily.semibold,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
    maxWidth: '88%',
    fontFamily: FontFamily.regular,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  heroStatPill: {
    minWidth: 86,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  heroStatValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: FontFamily.bold,
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.64)',
    fontSize: 10,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: FontFamily.medium,
  },
  panelWrap: {
    marginTop: 20,
    // The picture is no longer dimmed, so the panel has to separate itself
    // from it the way a real card would — by casting onto it.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.34,
    shadowRadius: 22,
    elevation: 16,
  },
  contentContainer: {
    minHeight: height,
    // backgroundColor set inline; the cap above draws the rounded top edge.
    paddingTop: 8,
  },
  progressBadgeContainer: {
    // Sits inside the dome, sharing its centre. Above the panel, so the ends
    // of the arc rest on its edge instead of being cut off by it.
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 2,
    elevation: 2,
  },
  goalTitle: {
    fontSize: 28,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.5,
  },
  dashboardLabel: {
    fontSize: 10,
    letterSpacing: 1.6,
    marginBottom: 8,
    fontFamily: FontFamily.medium,
  },
  goalTarget: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
  },
  daysTag: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  daysTagText: {
    fontSize: 10,
    fontFamily: FontFamily.bold,
  },
  goalDescription: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FontFamily.regular,
  },
  dashboardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 22,
  },
  dashboardCard: {
    width: (width - 52) / 2,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 22,
  },
  dashboardCardLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    fontFamily: FontFamily.medium,
  },
  dashboardCardValue: {
    fontSize: 28,
    marginTop: 8,
    fontFamily: FontFamily.bold,
  },
  dashboardCardHint: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
    fontFamily: FontFamily.regular,
  },
  miniActionBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 30,
    gap: 12,
  },
  tab: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'transparent'
  },
  tabText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: FontFamily.semibold,
  },
  todayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  todayDate: { fontSize: 13, fontFamily: FontFamily.regular, marginTop: 2 },
  todayCount: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  todayCountText: { fontSize: 12, fontFamily: FontFamily.semibold },
  restDay: { alignItems: 'center', paddingVertical: 26, gap: 6 },
  restTitle: { fontSize: 16, fontFamily: FontFamily.semibold },
  restBody: { fontSize: 13, lineHeight: 19, fontFamily: FontFamily.regular, textAlign: 'center', paddingHorizontal: 12 },
  addRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  addPill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 999, borderWidth: 1, borderStyle: 'dashed' },
  addText: { fontSize: 13, fontFamily: FontFamily.medium },
  floatingRow: { position: 'absolute', left: 20, right: 20 },
  sectionTitle: {
    fontSize: 18,
    fontFamily: FontFamily.bold,
  },
  swapped: { paddingBottom: 8 },
  mainPanel: {
    margin: 20,
    marginTop: 18,
    padding: 20,
    borderRadius: 26,
  },
  addBtn: {
    width: 32, height: 32,
    borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  emptyCard: {
    padding: 30,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 20,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  sharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  }
});

export default GoalDetail;
