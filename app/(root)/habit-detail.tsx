import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, StyleSheet, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { Habit, getHabits, toggleCompletion, getCompletions } from '@/lib/habits';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import { ScreenHeader } from '@/components/Layout/ScreenHeader';
import { FriendsService, Friend } from '@/lib/friendsService';
import { useHaptics } from '@/hooks/useHaptics';

export default function HabitDetailScreen() {
  const router = useRouter();
  const params = useGlobalSearchParams();
  const habitId = params.habitId as string;
  const dateStr = params.date as string || new Date().toISOString().split('T')[0];

  const { theme } = useTheme();
  const colors = Colors[theme];
  const { selectionFeedback } = useHaptics();

  // Initialize with passed params to avoid loading state
  const [habit, setHabit] = useState<Habit | null>(() => {
    if (params.initialName) {
      return {
        id: habitId,
        name: params.initialName as string,
        category: params.initialCategory as any,
        icon: params.initialIcon as string,
        durationMinutes: params.initialDuration ? Number(params.initialDuration) : undefined,
        createdAt: '', // Not critical for display
      } as Habit;
    }
    return null;
  });

  const [completed, setCompleted] = useState(params.initialCompleted === 'true');
  const [loading, setLoading] = useState(!habit); // Only load if we didn't get params
  const [streak, setStreak] = useState(0);

  // Sharing state
  const [showShareModal, setShowShareModal] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [sharedWith, setSharedWith] = useState<string[]>([]);
  const [loadingShare, setLoadingShare] = useState(false);

  useEffect(() => {
    loadHabitDetails();
  }, [habitId, dateStr]);

  const loadHabitDetails = async () => {
    try {
      if (!habit) {
        const habits = await getHabits();
        const found = habits.find(h => h.id === habitId);
        if (found) setHabit(found);
      }

      const completions = await getCompletions(dateStr);
      setCompleted(!!completions[habitId]);

      setStreak(0);
    } finally {
      setLoading(false);
    }
  };

  const openShareModal = async () => {
    setShowShareModal(true);
    setLoadingShare(true);
    try {
      const [friendsList, sharedWithList] = await Promise.all([
        FriendsService.getFriends(),
        FriendsService.getHabitSharedWith(habitId)
      ]);
      setFriends(friendsList);
      setSharedWith(sharedWithList.map(f => f.id));
    } catch (error) {
      console.error('Error loading share data:', error);
    } finally {
      setLoadingShare(false);
    }
  };

  const toggleShare = async (friendId: string) => {
    selectionFeedback();
    const isCurrentlyShared = sharedWith.includes(friendId);

    if (isCurrentlyShared) {
      await FriendsService.unshareHabit(habitId, friendId);
      setSharedWith(prev => prev.filter(id => id !== friendId));
    } else {
      await FriendsService.shareHabitWithFriend(habitId, friendId);
      setSharedWith(prev => [...prev, friendId]);
    }
  };

  const handleToggle = async () => {
    if (!habit) return;
    setCompleted(prev => !prev);
    await toggleCompletion(habit.id, dateStr);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
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

  return (
    <VoidShell>
      <ScrollView contentContainerStyle={styles.scrollContent}>

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
              style={[styles.iconButton, { backgroundColor: colors.primary + '20' }]}
            >
              <Ionicons name="share-social" size={22} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => Alert.alert('Options', 'Edit or Delete functionality to be implemented')}
              style={[styles.iconButton, { backgroundColor: colors.surfaceSecondary }]}
            >
              <Ionicons name="ellipsis-horizontal" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScreenHeader title="PROTOCOL" subtitle="DETAILS & METRICS" />

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

        {/* Stats Grid */}
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

        {/* Description */}
        <VoidCard style={styles.descCard}>
          <Text style={[styles.descTitle, { color: colors.textPrimary }]}>DIRECTIVE</Text>
          <Text style={[styles.descText, { color: colors.textSecondary }]}>
            Consistency is key. You've set this protocol to improve your {habit.category}.
            Maintain your streak to achieve optimal results.
          </Text>
        </VoidCard>

      </ScrollView>

      {/* Share Modal */}
      <Modal
        visible={showShareModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                SHARE WITH CREW
              </Text>
              <TouchableOpacity onPress={() => setShowShareModal(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {loadingShare ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 40 }} />
            ) : friends.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No friends yet
                </Text>
                <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
                  Add friends in the Community tab to share habits
                </Text>
              </View>
            ) : (
              <FlatList
                data={friends}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: 400 }}
                renderItem={({ item }) => {
                  const isShared = sharedWith.includes(item.id);
                  return (
                    <TouchableOpacity
                      onPress={() => toggleShare(item.id)}
                      style={[
                        styles.friendItem,
                        { borderColor: isShared ? colors.primary : colors.border }
                      ]}
                    >
                      <View style={[styles.friendAvatar, { backgroundColor: colors.surfaceTertiary }]}>
                        <Text style={{ fontSize: 16, color: colors.textSecondary }}>
                          {item.username[0]?.toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.friendName, { color: colors.textPrimary }]}>
                          {item.username}
                        </Text>
                        {isShared && (
                          <Text style={{ color: colors.primary, fontSize: 10, fontFamily: 'SpaceMono-Regular' }}>
                            SHARING
                          </Text>
                        )}
                      </View>
                      <View style={[
                        styles.shareToggle,
                        { backgroundColor: isShared ? colors.primary : 'transparent', borderColor: colors.primary }
                      ]}>
                        {isShared && <Ionicons name="checkmark" size={16} color="#000" />}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </VoidShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: 60,
    paddingBottom: 100,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
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
    fontFamily: 'SpaceGrotesk-Bold',
  },
  habitMeta: {
    fontSize: 12,
    marginBottom: 24,
    textAlign: 'center',
    fontFamily: 'SpaceMono-Regular',
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
    fontFamily: 'SpaceMono-Regular',
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 16,
    letterSpacing: 1,
    fontFamily: 'SpaceMono-Regular',
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
    fontFamily: 'SpaceMono-Regular',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'SpaceGrotesk-Bold',
  },
  descCard: {
    padding: 20,
  },
  descTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    fontFamily: 'SpaceMono-Regular',
    letterSpacing: 1,
  },
  descText: {
    fontSize: 14,
    lineHeight: 22,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: 'SpaceMono-Regular',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    fontFamily: 'SpaceMono-Regular',
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'SpaceGrotesk-Bold',
  },
  shareToggle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
