import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, Alert, Dimensions, ImageBackground, StyleSheet, StatusBar } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { HalfCircleProgress } from '@/components/Common/HalfCircleProgress';
import { SwipeableHabitItem } from '@/components/Home/SwipeableHabitItem';
import { subscribeToHabits, Habit, removeHabitEverywhere, removeGoalWithLinkedHabits, calculateGoalProgressInstant, getLastNDaysCompletions } from '@/lib/habits';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter, LayoutAnimation } from 'react-native';
import { GoalStats } from '@/components/Goal/GoalStats';
import { getCompletions, toggleCompletion } from '@/lib/habits';
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
  const { goalId } = useGlobalSearchParams();
  const { theme } = useTheme();
  const colors = Colors[theme];

  const [habits, setHabits] = useState<Habit[]>([]);
  const [goal, setGoal] = useState<Habit | null>(null);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'habits' | 'stats'>('habits');
  const [completions, setCompletions] = useState<Record<string, boolean>>({});
  const [historyData, setHistoryData] = useState<{ date: string; completedIds: string[] }[]>([]);

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
    const loadBackground = async () => {
      const stored = await AsyncStorage.getItem(`goal_bg_${goalId}`);
      if (stored) setBgImage(stored);
    };
    loadBackground();

    const unsubPromise = subscribeToHabits((allHabits) => {
      setHabits(allHabits);
      const foundGoal = allHabits.find(h => h.id === goalId);
      if (foundGoal) setGoal(foundGoal);
    });

    const loadCompletions = async () => {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const c = await getCompletions(dateStr);
      setCompletions(c);
    };
    loadCompletions();

    // Load history data for accurate progress calculation
    const loadHistory = async () => {
      const data = await getLastNDaysCompletions(90);
      setHistoryData(data);
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
        onPress: async () => {
          if (goal) {
            await removeGoalWithLinkedHabits(goal.id);
            router.back();
          }
        }
      }
    ]);
  };

  const handleHabitPress = async (habit: Habit) => {
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
    await toggleCompletion(habit.id, dateStr);
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
          imageStyle={{ opacity: 0.4 }}
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.1)', '#000']}
            style={StyleSheet.absoluteFill}
            locations={[0, 0.9]}
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
        {/* Main Content Area */}
        <Animated.View entering={FadeIn.duration(500)} style={styles.contentContainer}>

          {/* Floating Progress Badge */}
          <View style={styles.progressBadgeContainer}>
            <VoidCard glass intensity={40} style={styles.progressBadge}>
              <HalfCircleProgress
                progress={progress}
                size={120}
                strokeWidth={12}
                color={goal.color || colors.primary}
                backgroundColor="rgba(255,255,255,0.05)"
                textColor="white"
                fontSize={28}
                showPercentage={true}
              />
            </VoidCard>
          </View>

          {/* Goal Info */}
          <View style={{ marginTop: 50, paddingHorizontal: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.goalTitle}>{goal.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} style={{ marginRight: 4 }} />
                  <Text style={styles.goalTarget}>Target: {goal.targetDate ? new Date(goal.targetDate).toLocaleDateString() : 'Ongoing'}</Text>
                  {daysLeft > 0 && <View style={[styles.daysTag, { backgroundColor: goal.color + '20' }]}><Text style={[styles.daysTagText, { color: goal.color }]}>{daysLeft} days left</Text></View>}
                </View>
              </View>
              {/* Edit/Delete Actions */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={handleEditGoal} style={[styles.miniActionBtn, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                  <Ionicons name="pencil" size={16} color="white" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDeleteGoal} style={[styles.miniActionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                  <Ionicons name="trash" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>

            {goal.description && (
              <Text style={styles.goalDescription}>{goal.description}</Text>
            )}
          </View>

          {/* Void Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity onPress={() => { mediumFeedback(); setActiveTab('habits'); }} style={{ flex: 1 }}>
              <VoidCard glass intensity={activeTab === 'habits' ? 50 : 10} style={[styles.tab, activeTab === 'habits' && { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                <Text style={[styles.tabText, activeTab === 'habits' && { color: 'white' }]}>Habits</Text>
              </VoidCard>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { mediumFeedback(); setActiveTab('stats'); }} style={{ flex: 1 }}>
              <VoidCard glass intensity={activeTab === 'stats' ? 50 : 10} style={[styles.tab, activeTab === 'stats' && { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                <Text style={[styles.tabText, activeTab === 'stats' && { color: 'white' }]}>Stats</Text>
              </VoidCard>
            </TouchableOpacity>
          </View>

          {/* Content Switching */}
          <View style={{ padding: 20 }}>
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
                          onPress={handleHabitPress}
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
          </View>

        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
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
  contentContainer: {
    minHeight: height,
    backgroundColor: '#050510', // Deep void background
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    marginTop: 20,
    paddingTop: 40,
    // Add a top border for glass Separation
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  progressBadgeContainer: {
    alignItems: 'center',
    marginTop: -100, // Pull up to overlap with header image
    marginBottom: 0,
  },
  progressBadge: {
    width: 140, height: 140,
    borderRadius: 70,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', // Darker backing
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  goalTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: 'white',
    fontFamily: 'Lexend',
    letterSpacing: -0.5,
  },
  goalTarget: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
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
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 20,
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
    color: 'white',
    fontFamily: 'Lexend',
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
  }
});

export default GoalDetail;
