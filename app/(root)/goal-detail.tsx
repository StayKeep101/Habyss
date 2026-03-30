import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, Alert, Dimensions, ImageBackground, StyleSheet, StatusBar } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { HalfCircleProgress } from '@/components/Common/HalfCircleProgress';
import { SwipeableHabitItem } from '@/components/Home/SwipeableHabitItem';
import { subscribeToHabits, Habit, removeHabitEverywhere, removeGoalWithLinkedHabits, calculateGoalProgressInstant, getLastNDaysCompletions } from '@/lib/habitsSQLite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter, LayoutAnimation } from 'react-native';
import { GoalStats } from '@/components/Goal/GoalStats';
import { ShareGoalModal } from '@/components/ShareGoalModal';
import { getCompletions, toggleCompletion } from '@/lib/habitsSQLite';

import { useHaptics } from '@/hooks/useHaptics';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withRepeat,
  Easing,
  SlideInDown,
  FadeInDown,
  FadeIn
} from 'react-native-reanimated';
import { VoidCard } from '@/components/Layout/VoidCard';

let ImagePicker: any = null;
try { ImagePicker = require('expo-image-picker'); } catch (e) { }

const { height, width } = Dimensions.get('window');
const HEADER_HEIGHT = 380; // Taller header for better visual

const GoalDetail = () => {
  const router = useRouter();
  const params = useGlobalSearchParams();
  const goalIdParam = params.goalId;
  const goalId = Array.isArray(goalIdParam) ? goalIdParam[0] : goalIdParam;
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { primary: accentColor } = useAccentGradient();

  const [habits, setHabits] = useState<Habit[]>([]);
  const [goal, setGoal] = useState<Habit | null>(null);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'habits' | 'stats'>('stats');
  const [completions, setCompletions] = useState<Record<string, boolean>>({});
  const [historyData, setHistoryData] = useState<{ date: string; completedIds: string[] }[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isSharedGoal, setIsSharedGoal] = useState(false);

  const { selectionFeedback, lightFeedback, mediumFeedback } = useHaptics();
  const { playComplete } = useSoundEffects();

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

    const loadBackground = async () => {
      const stored = await AsyncStorage.getItem(`goal_bg_${goalId}`);
      if (stored && isActive) setBgImage(stored);
    };
    loadBackground();

    const unsubPromise = subscribeToHabits((allHabits) => {
      if (!isActive) return;
      setHabits(allHabits);
      const foundGoal = allHabits.find(h => h.id === goalId);
      if (foundGoal) {
        setGoal(foundGoal);
        setIsSharedGoal(false);
      }
    });

    // Shared goals disabled in local-only mode

    const loadCompletions = async () => {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const c = await getCompletions(dateStr);
      if (isActive) setCompletions(c);
    };
    loadCompletions();

    // Load history data for accurate progress calculation
    const loadHistory = async () => {
      const data = await getLastNDaysCompletions(90);
      if (isActive) setHistoryData(data);
    };
    loadHistory();

    const sub = DeviceEventEmitter.addListener('habit_completion_updated', ({ habitId, date, completed }) => {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      if (date === todayStr) {
        setCompletions(prev => ({ ...prev, [habitId]: completed }));
      }
    });

    return () => {
      isActive = false;
      unsubPromise.then(unsub => unsub());
      sub.remove();
    };
  }, [goalId]);

  const associatedHabits = useMemo(() => habits.filter(h => h.goalId === goalId), [habits, goalId]);

  // Optimized History Map
  const historyMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    historyData.forEach(d => map[d.date] = d.completedIds);
    return map;
  }, [historyData]);

  // Helper: Calculate required completions for a habit until target date
  const calculateRequiredCompletions = (habit: Habit): number => {
    if (!goal?.targetDate) return 0;
    const today = new Date();
    const target = new Date(goal.targetDate);
    if (target <= today) return 0;

    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (habit.frequency === 'daily') {
      return diffDays;
    } else if (habit.frequency === 'weekly') {
      const weeks = Math.ceil(diffDays / 7);
      const daysPerWeek = habit.taskDays?.length || 7;
      return Math.ceil(weeks * daysPerWeek);
    } else if (habit.frequency === 'monthly') {
      const months = Math.ceil(diffDays / 30);
      return months;
    }
    return diffDays;
  };

  // Count completions for a habit from history
  const getHabitCompletionCount = (habitId: string): number => {
    return historyData.filter(day => day.completedIds.includes(habitId)).length;
  };

  const [progress, setProgress] = useState(0);

  // Calculate progress using instant method with history data
  useEffect(() => {
    if (goal && habits.length > 0 && historyData.length > 0) {
      const p = calculateGoalProgressInstant(goal, habits, completions, historyMap);
      setProgress(p);
    }
  }, [goal, habits, completions, historyMap]);

  const scrollHandler = useAnimatedScrollHandler(event => {
    scrollY.value = event.contentOffset.y;
  });

  const handleEditGoal = () => {
    if (!goal) return;
    router.push({
      pathname: '/create',
      params: { id: goal.id, name: goal.name, description: goal.description || '', category: goal.category, icon: goal.icon, isGoal: 'true' }
    });
  };

  const handleDeleteGoal = () => {
    Alert.alert("Delete Goal", "This will delete the goal AND all habits linked to it. Continue?", [
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
    setCompletions(prev => ({ ...prev, [habit.id]: isCompleted }));
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    // Fire and forget for instant response
    toggleCompletion(habit.id, dateStr).catch(console.error);
  };

  const handleAddHabit = () => {
    selectionFeedback();
    // Directly emit without timeout for snappier response
    DeviceEventEmitter.emit('show_habit_modal', { goalId: goalId as string });
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

  const daysLeft = useMemo(() => {
    if (!goal?.targetDate) return 0;
    const target = new Date(goal.targetDate);
    const today = new Date();
    // Reset times to midnight for accurate day difference
    target.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diff = target.getTime() - today.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [goal?.targetDate]);

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
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar barStyle="light-content" />

      {/* Background Image with Overlay */}
      <View style={StyleSheet.absoluteFill}>
        <ImageBackground
          source={bgImage ? { uri: bgImage } : require('@/assets/images/adaptive-icon.png')}
          style={{ flex: 1 }}
          resizeMode="cover"
          imageStyle={styles.heroImage}
        >
          <LinearGradient
            colors={theme === 'light'
              ? ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.74)', colors.background]
              : ['rgba(0,0,0,0.06)', 'rgba(0,0,0,0.38)', '#040507']}
            style={StyleSheet.absoluteFill}
            locations={[0, 0.38, 0.95]}
          />
        </ImageBackground>
      </View>

      {/* Navigation Header */}
      <SafeAreaView style={styles.navHeader} edges={['top']}>
        <TouchableOpacity onPress={() => router.back()} style={styles.blurBtn}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <Ionicons name="chevron-back" size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleChangeBackground} style={styles.blurBtn}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <Ionicons name="camera-outline" size={20} color="white" />
        </TouchableOpacity>
      </SafeAreaView>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: HEADER_HEIGHT - 60, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.heroOverlay, headerStyle]}>
          <View style={styles.heroContent}>
            <View style={[styles.heroEyebrow, { backgroundColor: (goal.color || accentColor) + '18', borderColor: (goal.color || accentColor) + '30' }]}>
              <Ionicons name={(goal.icon as any) || 'flag'} size={14} color={goal.color || accentColor} />
              <Text style={[styles.heroEyebrowText, { color: goal.color || accentColor }]}>{goal.category.toUpperCase()}</Text>
            </View>

            <Text style={styles.heroTitle}>{goal.name}</Text>
            <Text style={styles.heroSubtitle}>
              {goal.description || 'Track the outcome, monitor momentum, and steer the supporting habits from one place.'}
            </Text>

            <View style={styles.heroStatsRow}>
              <View style={styles.heroStatPill}>
                <Text style={styles.heroStatValue}>{associatedHabits.length}</Text>
                <Text style={styles.heroStatLabel}>habits</Text>
              </View>
              <View style={styles.heroStatPill}>
                <Text style={styles.heroStatValue}>{progress}%</Text>
                <Text style={styles.heroStatLabel}>progress</Text>
              </View>
              <View style={styles.heroStatPill}>
                <Text style={styles.heroStatValue}>{daysLeft > 0 ? daysLeft : 'Now'}</Text>
                <Text style={styles.heroStatLabel}>{daysLeft > 0 ? 'days left' : 'deadline'}</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Main Content Area */}
        <Animated.View entering={FadeIn.duration(500)} style={[styles.contentContainer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>

          {/* Floating Progress */}
          <View style={styles.progressBadgeContainer}>
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

          {/* Dashboard Header */}
          <View style={{ marginTop: 50, paddingHorizontal: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dashboardLabel, { color: colors.textTertiary }]}>GOAL DASHBOARD</Text>
                <Text style={[styles.goalTitle, { color: colors.text }]}>{goal.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} style={{ marginRight: 4 }} />
                  <Text style={[styles.goalTarget, { color: colors.textTertiary }]}>Target: {goal.targetDate ? new Date(goal.targetDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Ongoing'}</Text>
                  {daysLeft > 0 && <View style={[styles.daysTag, { backgroundColor: (goal.color || accentColor) + '20' }]}><Text style={[styles.daysTagText, { color: goal.color || accentColor }]}>{daysLeft} days left</Text></View>}
                </View>
              </View>
              {/* Edit/Delete Actions - Only show for owned goals */}
              {!isSharedGoal ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={() => setShowShareModal(true)} style={[styles.miniActionBtn, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                    <Ionicons name="share-social" size={16} color="#3B82F6" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleEditGoal} style={[styles.miniActionBtn, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                    <Ionicons name="pencil" size={16} color="white" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleDeleteGoal} style={[styles.miniActionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                    <Ionicons name="trash" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={[styles.sharedBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                  <Ionicons name="people" size={14} color="#10B981" />
                  <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '600', marginLeft: 4, fontFamily: 'Lexend' }}>Shared</Text>
                </View>
              )}
            </View>

            {goal.description && (
              <Text style={[styles.goalDescription, { color: colors.textSecondary }]}>{goal.description}</Text>
            )}
          </View>

          <View style={styles.dashboardGrid}>
            <VoidCard glass style={[styles.dashboardCard, { backgroundColor: theme === 'light' ? colors.surfaceSecondary : undefined }]}>
              <Text style={[styles.dashboardCardLabel, { color: colors.textTertiary }]}>Completion</Text>
              <Text style={[styles.dashboardCardValue, { color: goal.color || accentColor }]}>{progress}%</Text>
              <Text style={[styles.dashboardCardHint, { color: colors.textSecondary }]}>live goal score</Text>
            </VoidCard>
            <VoidCard glass style={[styles.dashboardCard, { backgroundColor: theme === 'light' ? colors.surfaceSecondary : undefined }]}>
              <Text style={[styles.dashboardCardLabel, { color: colors.textTertiary }]}>Attached Habits</Text>
              <Text style={[styles.dashboardCardValue, { color: colors.text }]}>{associatedHabits.length}</Text>
              <Text style={[styles.dashboardCardHint, { color: colors.textSecondary }]}>systems driving this goal</Text>
            </VoidCard>
            <VoidCard glass style={[styles.dashboardCard, { backgroundColor: theme === 'light' ? colors.surfaceSecondary : undefined }]}>
              <Text style={[styles.dashboardCardLabel, { color: colors.textTertiary }]}>Completed Today</Text>
              <Text style={[styles.dashboardCardValue, { color: colors.text }]}>{associatedHabits.filter(habit => completions[habit.id]).length}</Text>
              <Text style={[styles.dashboardCardHint, { color: colors.textSecondary }]}>checked habits now</Text>
            </VoidCard>
            <VoidCard glass style={[styles.dashboardCard, { backgroundColor: theme === 'light' ? colors.surfaceSecondary : undefined }]}>
              <Text style={[styles.dashboardCardLabel, { color: colors.textTertiary }]}>Runway</Text>
              <Text style={[styles.dashboardCardValue, { color: colors.text }]}>{goal.targetDate ? daysLeft : 'Open'}</Text>
              <Text style={[styles.dashboardCardHint, { color: colors.textSecondary }]}>{goal.targetDate ? 'days remaining' : 'no deadline set'}</Text>
            </VoidCard>
          </View>


          {/* Void Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity onPress={() => { mediumFeedback(); setActiveTab('habits'); }} style={{ flex: 1 }}>
              <VoidCard glass intensity={activeTab === 'habits' ? 50 : 10} style={[styles.tab, activeTab === 'habits' && { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={[styles.tabText, activeTab === 'habits' ? { color: colors.text } : { color: colors.textTertiary }]}>Habits</Text>
              </VoidCard>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { mediumFeedback(); setActiveTab('stats'); }} style={{ flex: 1 }}>
              <VoidCard glass intensity={activeTab === 'stats' ? 50 : 10} style={[styles.tab, activeTab === 'stats' && { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={[styles.tabText, activeTab === 'stats' ? { color: colors.text } : { color: colors.textTertiary }]}>Dashboard</Text>
              </VoidCard>
            </TouchableOpacity>
          </View>

          {/* Content Switching */}
          <VoidCard glass style={[styles.mainPanel, { backgroundColor: theme === 'light' ? colors.surfaceSecondary : undefined }]}>
            {activeTab === 'stats' ? (
              <Animated.View entering={FadeInDown}>
                <GoalStats goal={goal} habits={associatedHabits} />
              </Animated.View>
            ) : (
              <Animated.View entering={FadeIn}>
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.sectionTitle}>Checklist</Text>
                </View>

                {associatedHabits.length > 0 ? (
                  associatedHabits.map(habit => {
                    const required = calculateRequiredCompletions(habit);
                    const completed = getHabitCompletionCount(habit.id);
                    return (
                      <View key={habit.id}>
                        <SwipeableHabitItem
                          habit={{ ...habit, completed: !!completions[habit.id] }}
                          onPress={() => router.push({ pathname: '/habit-detail', params: { habitId: habit.id } })}
                          onToggle={() => handleHabitPress(habit)}
                          onEdit={(h) => router.push({ pathname: '/create', params: { id: h.id, goalId: goalId as string } })}
                          onDelete={handleDeleteHabit}
                          size="standard"
                        />
                        {goal?.targetDate && required > 0 && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 16, marginTop: -4, marginBottom: 8 }}>
                            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>
                              {completed}/{required} completions
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })
                ) : (
                  <VoidCard glass style={styles.emptyCard}>
                    <Ionicons name="add-circle-outline" size={32} color="rgba(255,255,255,0.4)" />
                    <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 8, fontFamily: 'Lexend' }}>Create your first habit</Text>
                  </VoidCard>
                )}
              </Animated.View>
            )}
          </VoidCard>

        </Animated.View>
      </Animated.ScrollView>
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
  heroImage: {
    opacity: 0.56,
    transform: [{ scale: 1.02 }],
  },
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
    fontFamily: 'Lexend_600SemiBold',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 33,
    lineHeight: 38,
    fontFamily: 'Lexend_700Bold',
    maxWidth: '82%',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
    maxWidth: '88%',
    fontFamily: 'Lexend_400Regular',
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
    fontFamily: 'Lexend_700Bold',
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.64)',
    fontSize: 10,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: 'Lexend_500Medium',
  },
  contentContainer: {
    minHeight: height,
    // backgroundColor set inline
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    marginTop: 20,
    paddingTop: 40,
    // Add a top border for glass Separation
    borderTopWidth: 1,
    // borderTopColor set inline
  },
  progressBadgeContainer: {
    alignItems: 'center',
    marginTop: -80, // Pull up to overlap with header image
    marginBottom: 0,
  },
  goalTitle: {
    fontSize: 28,
    fontWeight: '900',
    fontFamily: 'Lexend',
    letterSpacing: -0.5,
  },
  dashboardLabel: {
    fontSize: 10,
    letterSpacing: 1.6,
    marginBottom: 8,
    fontFamily: 'Lexend_500Medium',
  },
  goalTarget: {
    fontSize: 13,
    fontFamily: 'Lexend_400Regular',
  },
  daysTag: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  daysTagText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Lexend',
  },
  goalDescription: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Lexend_400Regular',
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
    fontFamily: 'Lexend_500Medium',
  },
  dashboardCardValue: {
    fontSize: 28,
    marginTop: 8,
    fontFamily: 'Lexend_700Bold',
  },
  dashboardCardHint: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
    fontFamily: 'Lexend_400Regular',
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
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Lexend',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Lexend',
  },
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
