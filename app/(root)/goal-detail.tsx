import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, Alert, Dimensions, ImageBackground, StyleSheet } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { HalfCircleProgress } from '@/components/Common/HalfCircleProgress';
import { SwipeableHabitItem } from '@/components/Home/SwipeableHabitItem';
import { subscribeToHabits, Habit, removeHabitEverywhere, calculateGoalProgress } from '@/lib/habits';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { GoalStats } from '@/components/Goal/GoalStats';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';

let ImagePicker: any = null;
try { ImagePicker = require('expo-image-picker'); } catch (e) { }

const { height } = Dimensions.get('window');
const HEADER_HEIGHT = 300;

const GoalDetail = () => {
  const router = useRouter();
  const { goalId } = useGlobalSearchParams();
  const { theme } = useTheme();
  const colors = Colors[theme];

  const [habits, setHabits] = useState<Habit[]>([]);
  const [goal, setGoal] = useState<Habit | null>(null);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'habits' | 'stats'>('habits');

  const scrollY = useSharedValue(0);

  // Cockpit glow animation
  const glowOpacity = useSharedValue(0.5);

  useEffect(() => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

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
    return () => { unsubPromise.then(unsub => unsub()); };
  }, [goalId]);

  const associatedHabits = useMemo(() => habits.filter(h => h.goalId === goalId), [habits, goalId]);

  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let isMounted = true;
    if (goal) {
      calculateGoalProgress(goal).then(p => {
        if (isMounted) setProgress(p);
      });
    }
    return () => { isMounted = false; };
  }, [goal, habits]);

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
    Alert.alert("Delete Goal", "This will remove the goal but keep its habits. Continue?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          if (goal) {
            await removeHabitEverywhere(goal.id);
            router.back();
          }
        }
      }
    ]);
  };

  const handleAddHabit = () => {
    try {
      setTimeout(() => {
        DeviceEventEmitter.emit('show_habit_modal', { goalId: goalId as string });
      }, 50);
    } catch (error) {
      console.error('Error opening habit modal:', error);
      Alert.alert('Error', 'Could not open habit creation. Please try again.');
    }
  };

  const handleDeleteHabit = (habit: Habit) => {
    Alert.alert("Delete Habit", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => removeHabitEverywhere(habit.id) }
    ]);
  };

  const handleChangeBackground = async () => {
    if (!ImagePicker) {
      Alert.alert(
        "Feature Unavailable",
        "Photo picker requires a development build. Run 'npx expo run:ios' or 'npx expo run:android' to enable this feature."
      );
      return;
    }
    Alert.alert("Change Background", "Choose an option", [
      {
        text: "Take Photo",
        onPress: async () => {
          try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
              return;
            }
            // Add delay to prevent crash
            await new Promise(resolve => setTimeout(resolve, 100));
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [16, 9],
              quality: 0.7
            });
            if (!result.canceled && result.assets && result.assets[0]) {
              const uri = result.assets[0].uri;
              setBgImage(uri);
              await AsyncStorage.setItem(`goal_bg_${goalId}`, uri);
            }
          } catch (error: any) {
            console.error('Camera error:', error);
            Alert.alert('Camera Error', error?.message || 'Could not access camera. If using Expo Go, please create a development build.');
          }
        }
      },
      {
        text: "Choose from Library",
        onPress: async () => {
          try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Required', 'Photo library access is needed to select photos.');
              return;
            }
            // Add delay to prevent crash
            await new Promise(resolve => setTimeout(resolve, 100));
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions?.Images ?? 'images',
              allowsEditing: true,
              aspect: [16, 9],
              quality: 0.7
            });
            if (!result.canceled && result.assets && result.assets[0]) {
              const uri = result.assets[0].uri;
              setBgImage(uri);
              await AsyncStorage.setItem(`goal_bg_${goalId}`, uri);
            }
          } catch (error: any) {
            console.error('Library error:', error);
            Alert.alert('Photo Library Error', error?.message || 'Could not access photo library. If using Expo Go, please create a development build.');
          }
        }
      },
      { text: "Cancel", style: "cancel" }
    ]);
  };

  if (!goal) return null;

  const daysLeft = goal.targetDate ? Math.max(0, Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Fixed Header Background */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: HEADER_HEIGHT, zIndex: 0 }}>
        <ImageBackground
          source={bgImage ? { uri: bgImage } : require('@/assets/images/adaptive-icon.png')}
          style={{ flex: 1, backgroundColor: colors.primary }}
          imageStyle={{ opacity: 0.6 }}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', width: '100%' }} />
        </ImageBackground>
      </View>

      {/* Fixed Top Header - Lowered icons */}
      <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 }}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleChangeBackground} style={styles.headerBtn}>
          <Ionicons name="camera" size={20} color="white" />
        </TouchableOpacity>
      </SafeAreaView>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: HEADER_HEIGHT - 40, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Floating Progress Indicator */}
        <View style={{ alignItems: 'center', marginBottom: -60, zIndex: 100 }}>
          <View style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}>
            <HalfCircleProgress
              progress={progress}
              size={110}
              strokeWidth={10}
              color="white"
              backgroundColor="rgba(255,255,255,0.2)"
              textColor="white"
              fontSize={22}
              showPercentage={true}
            />
          </View>
        </View>

        <BlurView
          intensity={90}
          tint="dark"
          style={styles.contentContainer}
        >
          {/* Cockpit glow effect */}
          <Animated.View style={[styles.cockpitGlow, glowStyle]}>
            <LinearGradient
              colors={['transparent', goal.color ? goal.color + '20' : 'rgba(139, 92, 246, 0.15)', 'transparent']}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {/* Scanline overlay for cockpit aesthetic */}
          <View style={styles.scanlineOverlay} pointerEvents="none" />

          <View style={{ paddingTop: 70, paddingHorizontal: 20, paddingBottom: 24 }}>

            {/* Goal Header with Edit/Delete */}
            <View style={styles.goalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.goalTitle}>{goal.name}</Text>
                <Text style={styles.goalTarget}>Target: {new Date(goal.targetDate || '').toLocaleDateString()}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={handleEditGoal} style={styles.actionBtn}>
                  <Ionicons name="pencil" size={16} color="white" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDeleteGoal} style={[styles.actionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.3)' }]}>
                  <Ionicons name="trash" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>

            {goal.description && (
              <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 8, marginBottom: 16 }}>
                {goal.description}
              </Text>
            )}

            {/* Tab Selector */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                onPress={() => setActiveTab('habits')}
                style={[styles.tab, activeTab === 'habits' && styles.tabActive]}
              >
                <Ionicons name="list" size={18} color={activeTab === 'habits' ? 'white' : 'rgba(255,255,255,0.5)'} />
                <Text style={[styles.tabText, activeTab === 'habits' && styles.tabTextActive]}>Habits</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveTab('stats')}
                style={[styles.tab, activeTab === 'stats' && styles.tabActive]}
              >
                <Ionicons name="stats-chart" size={18} color={activeTab === 'stats' ? 'white' : 'rgba(255,255,255,0.5)'} />
                <Text style={[styles.tabText, activeTab === 'stats' && styles.tabTextActive]}>Stats</Text>
              </TouchableOpacity>
            </View>

            {/* Tab Content */}
            {activeTab === 'stats' ? (
              <GoalStats goal={goal} habits={associatedHabits} />
            ) : (
              <View style={{ marginTop: 20 }}>
                {/* Mission Habits Header with Add Button */}
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Mission Habits</Text>
                  <TouchableOpacity onPress={handleAddHabit} style={styles.addBtn}>
                    <Ionicons name="add" size={20} color="white" />
                  </TouchableOpacity>
                </View>

                {associatedHabits.length > 0 ? (
                  associatedHabits.map(habit => (
                    <SwipeableHabitItem
                      key={habit.id}
                      habit={habit}
                      onPress={() => router.push({ pathname: '/habit-detail', params: { habitId: habit.id } })}
                      onEdit={(h) => router.push({ pathname: '/create', params: { id: h.id, goalId: goalId as string } })}
                      onDelete={handleDeleteHabit}
                    />
                  ))
                ) : (
                  <TouchableOpacity onPress={handleAddHabit} style={styles.emptyState}>
                    <Ionicons name="add-circle-outline" size={40} color="rgba(255,255,255,0.3)" />
                    <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 12 }}>No habits linked yet</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 4 }}>Tap to add your first habit</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </BlurView>
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  contentContainer: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    minHeight: height * 0.7,
    backgroundColor: 'rgba(10,10,20,0.95)',
    borderTopWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  cockpitGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 250,
  },
  scanlineOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.03,
    backgroundColor: 'transparent',
    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  goalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  goalTarget: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 4,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  tabActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
  },
  tabText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: 'white',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.5)',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
});

export default GoalDetail;
