import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet, DeviceEventEmitter, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { Habit, getHabits, toggleCompletion, getCompletions, getLastNDaysCompletions, getHabitStats, inferTrackingStyle } from '@/lib/habitsSQLite';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import { ScreenHeader } from '@/components/Layout/ScreenHeader';
import { ShareHabitModal } from '@/components/ShareHabitModal';
import { useRoutines } from '@/constants/RoutineContext';
import { useFocusTime } from '@/constants/FocusTimeContext';

import { useHaptics } from '@/hooks/useHaptics';
import { PomodoroTimer } from '@/components/Habit/PomodoroTimer';
import { SpotifyPage } from '@/components/Habit/SpotifyPage';
import { SpinningLogo } from '@/components/SpinningLogo';
import { HabitGraphRenderer } from '@/components/Habit/HabitGraphRenderer';
import { DetailedHeatmap } from '@/components/Habit/DetailedHeatmap';

const { width } = Dimensions.get('window');

export default function HabitDetailScreen() {
  const router = useRouter();
  const params = useGlobalSearchParams();
  const habitIdParam = params.habitId;
  const habitId = Array.isArray(habitIdParam) ? habitIdParam[0] : habitIdParam;

  // Use consistent LOCAL date format (not UTC)
  const getLocalDateStr = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const dateParam = params.date;
  const dateStr = (Array.isArray(dateParam) ? dateParam[0] : dateParam) || getLocalDateStr();
  const todayStr = getLocalDateStr();

  const { theme } = useTheme();
  const colors = Colors[theme];
  const { selectionFeedback, mediumFeedback } = useHaptics();
  const { getRoutinesForHabit } = useRoutines();
  const { activeHabitId, isRunning: isFocusRunning } = useFocusTime();

  // Initialize with passed params to avoid loading state
  const [habit, setHabit] = useState<Habit | null>(() => {
    if (params.initialName) {
      return {
        id: habitId,
        name: params.initialName as string,
        category: params.initialCategory as any,
        icon: params.initialIcon as string,
        durationMinutes: params.initialDuration ? Number(params.initialDuration) : undefined,
        createdAt: '',
      } as Habit;
    }
    return null;
  });

  const [completed, setCompleted] = useState(params.initialCompleted === 'true');
  const [loading, setLoading] = useState(!habit);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [completionRate, setCompletionRate] = useState(0);
  const [totalCompletions, setTotalCompletions] = useState(0);
  const [history, setHistory] = useState<{ date: string; completed: boolean }[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [counterValue, setCounterValue] = useState(0);

  useEffect(() => {
    if (!habitId) return;
    loadHabitDetails();

    // Listen for completion updates from other screens for instant sync
    const completionSub = DeviceEventEmitter.addListener('habit_completion_updated', ({ habitId: updatedId, date, completed: isCompleted }) => {
      if (updatedId === habitId && date === dateStr) {
        setCompleted(isCompleted);
        loadHabitDetails();
      }
    });

    // Listen for habit updates (e.g., from the global edit modal)
    const habitUpdateSub = DeviceEventEmitter.addListener('habit_updated', ({ habitId: updatedId }) => {
      if (updatedId === habitId) {
        loadHabitDetails(); // Reload all details for this habit
      }
    });

    return () => {
      completionSub.remove();
      habitUpdateSub.remove();
    };
  }, [habitId, dateStr]);

  const loadHabitDetails = async () => {
    if (!habitId) {
      setLoading(false);
      return;
    }

    try {
      let currentHabit = habit;
      if (!currentHabit) {
        const habits = await getHabits();
        const found = habits.find(h => h.id === habitId);
        if (found) {
          setHabit(found);
          currentHabit = found;
        }
      } else {
        // Reload fresh data even if we had initial params
        const habits = await getHabits();
        const found = habits.find(h => h.id === habitId);
        if (found) {
          setHabit(found);
          currentHabit = found;
        }
      }

      const completions = await getCompletions(dateStr);
      setCompleted(!!completions[habitId]);

      // Fetch history for charts (366 days for full year heatmap)
      const last366 = await getLastNDaysCompletions(366);
      const habitHistory = last366.map(d => ({
        date: d.date,
        completed: d.completedIds.includes(habitId)
      }));
      // Sort by date ascending
      habitHistory.sort((a, b) => a.date.localeCompare(b.date));
      setHistory(habitHistory);

      // Fetch real stats
      const stats = await getHabitStats(habitId);
      setStreak(stats.currentStreak);
      setBestStreak(stats.bestStreak);
      setCompletionRate(stats.completionRate);
      setTotalCompletions(stats.totalCompletions);

      // Set initial counter value for counter-based habits
      if (currentHabit && completed) {
        setCounterValue(currentHabit.goalValue || 1);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    if (!habit) return;

    // Only allow completion for today
    if (dateStr !== todayStr) {
      Alert.alert('Cannot Modify', 'You can only mark habits complete for today.');
      return;
    }

    // Haptic feedback for satisfying interaction
    mediumFeedback();

    setCompleted(prev => !prev);
    // Fire and forget for instant response
    toggleCompletion(habit.id, dateStr).catch(console.error);
  };

  const handleCounterIncrement = useCallback(() => {
    if (!habit) return;
    if (dateStr !== todayStr) return;

    selectionFeedback();
    const newValue = Math.min(counterValue + 1, habit.goalValue || 999);
    setCounterValue(newValue);

    // Mark complete when target is reached
    if (newValue >= (habit.goalValue || 1) && !completed) {
      setCompleted(true);
      toggleCompletion(habit.id, dateStr).catch(console.error);
    }
  }, [habit, counterValue, completed, dateStr, todayStr]);

  const handleCounterDecrement = useCallback(() => {
    if (!habit) return;
    if (dateStr !== todayStr) return;

    selectionFeedback();
    const newValue = Math.max(counterValue - 1, 0);
    setCounterValue(newValue);

    // Un-mark complete if below target
    if (newValue < (habit.goalValue || 1) && completed) {
      setCompleted(false);
      toggleCompletion(habit.id, dateStr).catch(console.error);
    }
  }, [habit, counterValue, completed, dateStr, todayStr]);

  // Determine tracking style
  const trackingStyle = habit ? inferTrackingStyle(habit.unit, habit.goalValue) : 'boolean';

  // Only show loading if habit truly isn't available yet (fallback case)
  if (loading && !habit) return null;

  if (!habitId) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <Text style={{ color: colors.textSecondary }}>Habit is unavailable</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: colors.primary }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!habit) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <Text style={{ color: colors.textSecondary }}>Habit not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: colors.primary }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Last 7 days for quick view
  const last7Days = history.slice(-7);
  const habitColor = habit.color || colors.primary;
  const linkedRoutines = habit ? getRoutinesForHabit(habit.id) : [];
  const isFocusActiveForHabit = activeHabitId === habit.id && isFocusRunning;

  return (
    <VoidShell>
      {/* Header - Fixed */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.iconButton, { backgroundColor: colors.surfaceSecondary }]}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity
            onPress={() => {
              selectionFeedback();
              setShowShareModal(true);
            }}
            style={[styles.iconButton, { backgroundColor: colors.surfaceSecondary }]}
          >
            <Ionicons name="share-outline" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              selectionFeedback();
              DeviceEventEmitter.emit('show_habit_modal', { initialHabit: habit, goalId: habit.goalId });
            }}
            style={[styles.iconButton, { backgroundColor: colors.surfaceSecondary }]}
          >
            <Ionicons name="pencil" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const page = Math.round(event.nativeEvent.contentOffset.x / width);
          setCurrentPage(page);
        }}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {/* PAGE 1: Focus & Stats */}
        <ScrollView style={{ width: width }} contentContainerStyle={styles.pageContent}>

          <ScreenHeader title={habit.name.toUpperCase()} subtitle="PROTOCOL DETAILS" />

          <VoidCard style={styles.contextCard}>
            <View style={styles.contextRow}>
              <View>
                <Text style={[styles.contextLabel, { color: colors.textTertiary }]}>SCHEDULE</Text>
                <Text style={[styles.contextValue, { color: colors.textPrimary }]}>
                  {habit.startTime ? `${habit.startTime}${habit.durationMinutes ? ` · ${habit.durationMinutes} min` : ''}` : 'Anytime'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.contextLabel, { color: colors.textTertiary }]}>FOCUS</Text>
                <Text style={[styles.contextValue, { color: isFocusActiveForHabit ? habitColor : colors.textSecondary }]}>
                  {isFocusActiveForHabit ? 'Running now' : 'Idle'}
                </Text>
              </View>
            </View>
            <View style={[styles.routinePills, { marginTop: 14 }]}>
              {linkedRoutines.length > 0 ? linkedRoutines.map((routine) => (
                <View key={routine.id} style={[styles.routinePill, { backgroundColor: habitColor + '14', borderColor: habitColor + '28' }]}>
                  <Text style={[styles.routinePillText, { color: colors.textPrimary }]}>{routine.emoji} {routine.name}</Text>
                </View>
              )) : (
                <View style={[styles.routinePill, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <Text style={[styles.routinePillText, { color: colors.textSecondary }]}>Not inside a routine yet</Text>
                </View>
              )}
            </View>
          </VoidCard>

          {/* === CONTEXT-SENSITIVE PRIMARY INPUT === */}

          {/* TIMER: Only for time-based habits */}
          {trackingStyle === 'timer' && (
            <View style={{ marginBottom: 24 }}>
              <PomodoroTimer
                defaultMinutes={habit.durationMinutes}
                habitId={habit.id}
                habitName={habit.name}
                noCard
                fullSizeRunning
              />
            </View>
          )}

          {/* COUNTER: For numeric/countable habits (glasses, pages, reps, etc.) */}
          {trackingStyle === 'counter' && (
            <VoidCard style={styles.counterCard}>
              <View style={[styles.iconLarge, { backgroundColor: completed ? colors.success + '20' : habitColor + '15' }]}>
                <Ionicons
                  name={(habit.icon as any) || 'star'}
                  size={40}
                  color={completed ? colors.success : habitColor}
                />
              </View>
              <Text style={[styles.counterProgress, { color: colors.textPrimary }]}>
                {counterValue}
                <Text style={{ color: colors.textTertiary, fontSize: 20 }}> / {habit.goalValue || 1}</Text>
              </Text>
              <Text style={[styles.counterUnit, { color: colors.textSecondary }]}>
                {habit.unit || 'count'}
              </Text>

              <View style={styles.counterControls}>
                <TouchableOpacity
                  onPress={handleCounterDecrement}
                  style={[styles.counterBtn, { backgroundColor: colors.surfaceTertiary }]}
                  disabled={counterValue <= 0}
                >
                  <Ionicons name="remove" size={28} color={counterValue <= 0 ? colors.textTertiary : colors.textPrimary} />
                </TouchableOpacity>

                <View style={[styles.counterValueDisplay, { backgroundColor: completed ? colors.success + '15' : habitColor + '10', borderColor: completed ? colors.success + '40' : habitColor + '30' }]}>
                  <Text style={[styles.counterValueText, { color: completed ? colors.success : habitColor }]}>
                    {completed ? '✓ Complete' : `${Math.round((counterValue / (habit.goalValue || 1)) * 100)}%`}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={handleCounterIncrement}
                  style={[styles.counterBtn, { backgroundColor: habitColor + '20' }]}
                >
                  <Ionicons name="add" size={28} color={habitColor} />
                </TouchableOpacity>
              </View>
            </VoidCard>
          )}

          {/* BOOLEAN: Simple toggle for yes/no habits */}
          {trackingStyle === 'boolean' && (
            <VoidCard style={styles.mainCard}>
              <View style={[styles.iconLarge, { backgroundColor: completed ? colors.success + '20' : habitColor + '15' }]}>
                <Ionicons
                  name={(habit.icon as any) || 'star'}
                  size={40}
                  color={completed ? colors.success : habitColor}
                />
              </View>
              <Text style={[styles.habitName, { color: colors.textPrimary }]}>
                {habit.name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 }}>
                <View style={{ backgroundColor: colors.surfaceTertiary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                    <Text style={{ fontSize: 10, fontFamily: 'Lexend_400Regular', color: colors.textSecondary, letterSpacing: 1 }}>
                    {(habit.category || 'general').toUpperCase()}
                  </Text>
                </View>
                {habit.frequency && (
                  <View style={{ backgroundColor: colors.surfaceTertiary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                    <Text style={{ fontSize: 10, fontFamily: 'Lexend_400Regular', color: colors.textSecondary, letterSpacing: 1 }}>
                      {habit.frequency.toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                onPress={handleToggle}
                style={[styles.actionButton, { backgroundColor: completed ? colors.success : colors.primaryDark }]}
                activeOpacity={0.8}
              >
                <Ionicons name={completed ? "checkmark-circle" : "ellipse-outline"} size={20} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.actionButtonText}>
                  {completed ? 'PROTOCOL COMPLETE' : 'EXECUTE PROTOCOL'}
                </Text>
              </TouchableOpacity>
            </VoidCard>
          )}

          {/* === THIS WEEK — Quick 7-day view === */}
          <View style={{ marginBottom: 20 }}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>THIS WEEK</Text>
            <VoidCard style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {last7Days.map((day, i) => {
                  const dayDate = new Date(day.date + 'T12:00:00');
                  const dayLabel = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][dayDate.getDay()];
                  const isToday = day.date === todayStr;
                  return (
                    <View key={day.date} style={{ alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 10, color: isToday ? habitColor : colors.textTertiary, fontFamily: 'Lexend_400Regular', fontWeight: isToday ? '700' : '400' }}>
                        {dayLabel}
                      </Text>
                      <View style={{
                        width: 32, height: 32, borderRadius: 16,
                        backgroundColor: day.completed ? habitColor + '20' : 'transparent',
                        borderWidth: isToday ? 2 : 1,
                        borderColor: day.completed ? habitColor : (isToday ? habitColor + '50' : colors.border),
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        {day.completed ? (
                          <Ionicons name="checkmark" size={16} color={habitColor} />
                        ) : (
                          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textTertiary + '30' }} />
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </VoidCard>
          </View>

          {/* === PERFORMANCE STATS — Always visible === */}
          <View style={{ marginBottom: 20 }}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>PERFORMANCE</Text>
            <View style={styles.statsGrid}>
              {[
                { label: 'STREAK', value: `${streak}`, suffix: 'DAYS', icon: 'flame', color: '#FFD93D' },
                { label: 'BEST', value: `${bestStreak}`, suffix: 'DAYS', icon: 'trophy', color: '#4ECDC4' },
                { label: 'RATE', value: `${completionRate}`, suffix: '%', icon: 'trending-up', color: '#8BADD6' },
                { label: 'TOTAL', value: `${totalCompletions}`, suffix: 'DONE', icon: 'checkmark-done', color: '#8B5CF6' }
              ].map((stat, i) => (
                <VoidCard key={i} style={styles.statCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Ionicons name={stat.icon as any} size={16} color={stat.color} />
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{stat.label}</Text>
                  </View>
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                    {stat.value}
                    <Text style={{ fontSize: 10, color: colors.textTertiary }}> {stat.suffix}</Text>
                  </Text>
                </VoidCard>
              ))}
            </View>
          </View>

          {/* === VISUALIZATION === */}
          <View style={{ marginBottom: 24 }}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>VISUALIZATION</Text>
            <HabitGraphRenderer
              graphStyle={habit.graphStyle || 'bar'}
              color={habitColor}
              goalValue={habit.goalValue || 1}
              unit={habit.unit || 'count'}
              completionData={history}
              currentStreak={streak}
              todayValue={completed ? (habit.goalValue || 1) : 0}
            />
          </View>

          {/* === HEATMAP === */}
          <VoidCard style={{ padding: 16, marginBottom: 24 }} glass intensity={20}>
            <DetailedHeatmap
              completionData={history}
              color={habitColor}
              description="YEARLY CONSISTENCY"
            />
          </VoidCard>

          {/* === DESCRIPTION === */}
          <VoidCard style={styles.descCard}>
            <Text style={[styles.descTitle, { color: colors.textPrimary }]}>DIRECTIVE</Text>
            <Text style={[styles.descText, { color: colors.textSecondary }]}>
              Consistency is key. You've set this protocol to improve your {habit.category}.
              Maintain your streak to achieve optimal results.
            </Text>
          </VoidCard>

          {/* Bottom Padding for scroll */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* PAGE 2: Spotify / Audio */}
        <View style={{ width: width, flex: 1 }}>
          <SpotifyPage habitId={habitId} />
        </View>

      </ScrollView>

      {/* Share Modal */}
      <ShareHabitModal
        visible={showShareModal}
        habitId={habitId}
        habitName={habit.name}
        onClose={() => setShowShareModal(false)}
      />
    </VoidShell>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 40,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  pageContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  contextCard: {
    padding: 18,
    marginBottom: 20,
  },
  contextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  contextLabel: {
    fontSize: 10,
    letterSpacing: 1.3,
    fontFamily: 'Lexend_400Regular',
  },
  contextValue: {
    fontSize: 15,
    fontFamily: 'Lexend',
    marginTop: 4,
  },
  routinePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  routinePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  routinePillText: {
    fontSize: 11,
    fontFamily: 'Lexend_400Regular',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainCard: {
    alignItems: 'center',
    padding: 32,
    marginBottom: 24,
  },
  counterCard: {
    alignItems: 'center',
    padding: 28,
    marginBottom: 24,
  },
  iconLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  habitName: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
    textAlign: 'center',
    fontFamily: 'Lexend',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
    fontFamily: 'Lexend_400Regular',
    letterSpacing: 0.5,
  },
  // Counter styles
  counterProgress: {
    fontSize: 48,
    fontWeight: '900',
    fontFamily: 'Lexend',
    marginBottom: 4,
  },
  counterUnit: {
    fontSize: 13,
    fontFamily: 'Lexend_400Regular',
    letterSpacing: 1,
    marginBottom: 24,
    textTransform: 'uppercase',
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  counterBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValueDisplay: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  counterValueText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Lexend',
  },
  // Stats
  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 16,
    letterSpacing: 1,
    fontFamily: 'Lexend_400Regular',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    padding: 16,
    marginBottom: 16,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 8,
    letterSpacing: 1,
    fontFamily: 'Lexend_400Regular',
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: 'Lexend',
  },
  descCard: {
    padding: 20,
  },
  descTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    fontFamily: 'Lexend_400Regular',
    letterSpacing: 1,
  },
  descText: {
    fontSize: 14,
    lineHeight: 22,
  },
});
