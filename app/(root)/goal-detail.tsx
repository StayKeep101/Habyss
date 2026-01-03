import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, Alert, Dimensions, ImageBackground } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { HalfCircleProgress } from '@/components/Common/HalfCircleProgress';
import { SwipeableHabitItem } from '@/components/Home/SwipeableHabitItem';
import { CosmicView } from '@/components/Goal/CosmicView';
import { subscribeToHabits, Habit, removeHabitEverywhere } from '@/lib/habits';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';

// Optional: Conditionally require ImagePicker if needed, same logic as before
let ImagePicker: any = null;
try { ImagePicker = require('expo-image-picker'); } catch (e) { }

const { width } = Dimensions.get('window');
const HEADER_HEIGHT = 350;

const GoalDetail = () => {
  const router = useRouter();
  const { goalId } = useGlobalSearchParams();
  const { theme } = useTheme();
  const colors = Colors[theme];

  const [habits, setHabits] = useState<Habit[]>([]);
  const [goal, setGoal] = useState<Habit | null>(null);
  const [bgImage, setBgImage] = useState<string | null>(null);

  // Animation Shared Values
  const scrollY = useSharedValue(0);

  useEffect(() => {
    const loadBackground = async () => {
      const stored = await AsyncStorage.getItem(`goal_bg_${goalId}`);
      if (stored) setBgImage(stored);
    };
    loadBackground();

    const unsubPromise = subscribeToHabits((allHabits) => {
      setHabits(allHabits);
      const foundGoal = allHabits.find(h => h.id === goalId);
      if (foundGoal) {
        setGoal(foundGoal);
      }
    });
    return () => { unsubPromise.then(unsub => unsub()); };
  }, [goalId]);

  const associatedHabits = useMemo(() => {
    return habits.filter(h => h.goalId === goalId);
  }, [habits, goalId]);

  const progress = useMemo(() => {
    if (associatedHabits.length === 0) return 0;
    return 65; // Mock progress
  }, [associatedHabits]);

  const scrollHandler = useAnimatedScrollHandler(event => {
    scrollY.value = event.contentOffset.y;
  });

  const headerStyle = useAnimatedStyle(() => {
    return {
      height: HEADER_HEIGHT,
      transform: [
        {
          translateY: interpolate(scrollY.value, [-HEADER_HEIGHT, 0, HEADER_HEIGHT], [-HEADER_HEIGHT / 2, 0, HEADER_HEIGHT * 0.75])
        },
        {
          scale: interpolate(scrollY.value, [-HEADER_HEIGHT, 0, HEADER_HEIGHT], [2, 1, 1])
        }
      ]
    };
  });

  const handleEditGoal = () => {
    if (!goal) return;
    router.push({
      pathname: '/create',
      params: {
        id: goal.id,
        name: goal.name,
        category: goal.category,
        icon: goal.icon,
        isGoal: 'true',
        targetDate: goal.targetDate
      }
    });
  };

  const handleAddHabit = () => router.push({ pathname: '/create', params: { goalId: goalId as string } });

  const handleDeleteHabit = (habit: Habit) => {
    Alert.alert("Delete Habit", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => removeHabitEverywhere(habit.id) }
    ]);
  };

  const handleChangeBackground = async () => {
    if (!ImagePicker) return Alert.alert("Feature Unavailable", "Rebuild required.");

    Alert.alert(
      "Change Background",
      "Choose an option",
      [
        {
          text: "Take Photo",
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') return Alert.alert('Camera permission needed');

            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [16, 9],
              quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
              setBgImage(result.assets[0].uri);
              await AsyncStorage.setItem(`goal_bg_${goalId}`, result.assets[0].uri);
            }
          }
        },
        {
          text: "Choose from Library",
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') return Alert.alert('Library permission needed');

            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [16, 9],
              quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
              setBgImage(result.assets[0].uri);
              await AsyncStorage.setItem(`goal_bg_${goalId}`, result.assets[0].uri);
            }
          }
        },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  if (!goal) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Animated Header Background */}
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden', zIndex: 0 }, headerStyle]}>
        <ImageBackground
          source={bgImage ? { uri: bgImage } : require('@/assets/images/adaptive-icon.png')}
          style={{ flex: 1, backgroundColor: colors.primary }}
          imageStyle={{ opacity: 0.7 }}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} />
        </ImageBackground>
      </Animated.View>

      {/* Fixed Sticky Header Area (Back button) */}
      <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleChangeBackground} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="camera" size={20} color="white" />
        </TouchableOpacity>
      </SafeAreaView>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: HEADER_HEIGHT - 40, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <BlurView
          intensity={90}
          tint="dark"
          style={{
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            overflow: 'hidden',
            minHeight: 500,
            backgroundColor: colors.surface
          }}
        >
          <View style={{ paddingTop: 40, paddingHorizontal: 24, paddingBottom: 24 }}>

            {/* The Observatory (Cosmic View) */}
            <View style={{ marginBottom: 20 }}>
              <CosmicView goalName={goal.name} habits={associatedHabits} />
            </View>

            <View style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Target: {new Date(goal.targetDate || '').toLocaleDateString()}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleEditGoal} style={{ padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 }}>
                  <Ionicons name="pencil" size={20} color="white" />
                </TouchableOpacity>
              </View>

              {goal.description && (
                <Text style={{ color: colors.textSecondary, fontSize: 16, marginTop: 16, lineHeight: 24 }}>
                  {goal.description}
                </Text>
              )}

              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 30 }} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: 'white' }}>Mission Habits</Text>
                <TouchableOpacity onPress={handleAddHabit}>
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>+ Add New</Text>
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
                    onFocus={() => { }}
                  />
                ))
              ) : (
                <View style={{ padding: 40, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 20 }}>
                  <Text style={{ color: colors.textSecondary }}>No habits linked yet.</Text>
                </View>
              )}
            </View>

          </View>
        </BlurView>
      </Animated.ScrollView>
    </View>
  );
};

export default GoalDetail;
