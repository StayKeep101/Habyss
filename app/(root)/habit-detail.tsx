import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, StyleSheet, DeviceEventEmitter, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { Habit, getHabits, toggleCompletion, getCompletions, getLastNDaysCompletions } from '@/lib/habitsSQLite';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import { ScreenHeader } from '@/components/Layout/ScreenHeader';
import { ShareHabitModal } from '@/components/ShareHabitModal';
import { useHaptics } from '@/hooks/useHaptics';
import { PomodoroTimer } from '@/components/Habit/PomodoroTimer';
import { SpotifyPage } from '@/components/Habit/SpotifyPage';
import { HabitCreationModal } from '@/components/HabitCreationModal';
import { SpinningLogo } from '@/components/SpinningLogo';

const { width } = Dimensions.get('window');

export default function HabitDetailScreen() {
  const router = useRouter();
  const params = useGlobalSearchParams();
  const habitId = params.habitId as string;

  // Use consistent LOCAL date format (not UTC)
  const getLocalDateStr = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const dateStr = params.date as string || getLocalDateStr();
  const todayStr = getLocalDateStr();

  const { theme } = useTheme();
  const colors = Colors[theme];
  const { selectionFeedback, mediumFeedback } = useHaptics();

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
  const [history, setHistory] = useState<{ date: string; completed: boolean }[]>([]);
  const [currentPage, setCurrentPage] = useState(0);

  // Sharing state
  const [showShareModal, setShowShareModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    loadHabitDetails();

    // Listen for completion updates from other screens for instant sync
    const sub = DeviceEventEmitter.addListener('habit_completion_updated', ({ habitId: updatedId, date, completed: isCompleted }) => {
      if (updatedId === habitId && date === dateStr) {
        setCompleted(isCompleted);
      }
    });

    return () => sub.remove();
  }, [habitId, dateStr]);

  const loadHabitDetails = async () => {
    try {
      let currentHabit = habit;
      if (!currentHabit) {
        const habits = await getHabits();
        const found = habits.find(h => h.id === habitId);
        if (found) {
          setHabit(found);
          currentHabit = found;
        }
      }

      const completions = await getCompletions(dateStr);
      setCompleted(!!completions[habitId]);

      // Fetch history for charts (30 days)
      const last30 = await getLastNDaysCompletions(30);
      const habitHistory = last30.map(d => ({
        date: d.date,
        completed: d.completedIds.includes(habitId)
      }));
      // Sort by date ascending
      habitHistory.sort((a, b) => a.date.localeCompare(b.date));
      setHistory(habitHistory);

      // Simple streak calc
      let currentStreak = 0;
      for (let i = habitHistory.length - 1; i >= 0; i--) {
        if (habitHistory[i].completed) currentStreak++;
        else if (i === habitHistory.length - 1 && dateStr === todayStr) continue;
        else break;
      }
      setStreak(currentStreak);
    } finally {
      setLoading(false);
    }
  };

  const openShareModal = async () => {
    setShowShareModal(true);
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

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentPage(page);
  };

  // Only show loading if habit truly isn't available yet (fallback case)
  // In most cases, habit is initialized from params so this won't show
  if (loading && !habit) {
    return null; // Return nothing briefly while loading, prevents jarring spinner
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
            onPress={openShareModal}
            style={[styles.iconButton, { backgroundColor: colors.surfaceSecondary }]}
          >
            <Ionicons name="share-social" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              selectionFeedback();
              setShowEditModal(true);
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
        onMomentumScrollEnd={handleScroll}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {/* PAGE 1: Focus & Stats */}
        <ScrollView style={{ width: width }} contentContainerStyle={styles.pageContent}>

          <ScreenHeader title="PROTOCOL" subtitle="DETAILS & METRICS" />

          {/* Pomodoro Timer - HERO POSITION */}
          <View style={{ marginBottom: 24 }}>
            <PomodoroTimer
              defaultMinutes={habit.durationMinutes}
              habitId={habit.id}
              habitName={habit.name}
              noCard
            />
          </View>

          {/* Main Info Card */}
          <VoidCard glass style={styles.mainCard}>
            <View style={[styles.iconLarge, { backgroundColor: completed ? colors.success + '20' : colors.surfaceTertiary }]}>
              <Ionicons
                name={(habit.icon as any) || 'star'}
                size={40}
                color={completed ? colors.success : colors.textSecondary}
              />
            </View>
            <Text style={[styles.habitName, { color: colors.textPrimary }]}>
              {habit.name}
            </Text>
            <Text style={[styles.habitMeta, { color: colors.textSecondary }]}>
              {habit.category.toUpperCase()} • {habit.durationMinutes ? `${habit.durationMinutes} MIN` : 'NO DURATION'}
            </Text>

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

          {/* Performance Stats */}
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>PERFORMANCE</Text>
          <View style={styles.statsGrid}>
            {[
              { label: 'STREAK', value: `${streak} DAYS`, icon: 'flame', color: '#FFD93D' },
              { label: 'BEST', value: `${streak} DAYS`, icon: 'trophy', color: '#4ECDC4' },
              { label: 'VOLUME', value: habit.durationMinutes ? `${habit.durationMinutes * streak} MIN` : '0 MIN', icon: 'time', color: '#8BADD6' },
              { label: 'CYCLE', value: 'DAILY', icon: 'repeat', color: '#8B5CF6' }
            ].map((stat, i) => (
              <VoidCard key={i} style={styles.statCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Ionicons name={stat.icon as any} size={16} color={stat.color} />
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{stat.label}</Text>
                </View>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stat.value}</Text>
              </VoidCard>
            ))}
          </View>

          {/* Visualization Card */}
          <View style={{ marginBottom: 24 }}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>VISUALIZATION</Text>
            <VoidCard glass style={{ padding: 16, alignItems: 'center' }}>
              <HabitVisualization habit={habit} history={history} colors={colors} />
            </VoidCard>
          </View>

          {/* Description */}
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
        habitName={habit?.name || ''}
        onClose={() => setShowShareModal(false)}
      />
      <HabitCreationModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={() => {
          loadHabitDetails();
          setShowEditModal(false);
        }}
        goalId={habit.goalId}
        initialHabit={habit}
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
  paginationContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
    marginBottom: 32,
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
  habitMeta: {
    fontSize: 12,
    marginBottom: 24,
    textAlign: 'center',
    fontFamily: 'Lexend_400Regular',
    letterSpacing: 1,
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
    marginBottom: 24,
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
    fontSize: 16,
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

// --- Visualization Component ---
const HabitVisualization = ({ habit, history, colors }: { habit: Habit, history: { date: string; completed: boolean }[], colors: any }) => {
  // Simple block visualization for now
  return (
    <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
      {history.map((d, i) => (
        <View
          key={i}
          style={{
            width: 20,
            height: 20,
            borderRadius: 4,
            backgroundColor: d.completed ? colors.success : colors.surfaceSecondary
          }}
        />
      ))}
    </View>
  );
};
