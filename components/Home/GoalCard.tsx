import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { Habit } from '@/lib/habits';
import { HalfCircleProgress } from '@/components/Common/HalfCircleProgress';
import { VoidCard } from '@/components/Layout/VoidCard';

interface GoalCardProps {
  goal: Habit;
  progress: number;
  onPress: () => void;
}

export const GoalCard: React.FC<GoalCardProps> = ({ goal, progress, onPress }) => {
  const { theme } = useTheme();
  const colors = Colors[theme];

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ marginBottom: 16 }}>
      <VoidCard style={{ padding: 20 }}>
        <View style={styles.container}>
          <View style={styles.leftContent}>
            <View style={[styles.iconContainer, { backgroundColor: colors.surfaceTertiary }]}>
              <Text style={styles.icon}>{goal.icon || '🎯'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.title, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {goal.name}
              </Text>
              <View style={styles.metaRow}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>ACTIVE</Text>
                </View>
                <Text style={[styles.targetText, { color: colors.textSecondary }]}>
                  T-{Math.ceil((new Date(goal.targetDate || '').getTime() - Date.now()) / (1000 * 60 * 60 * 24))} DAYS
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.progressContainer}>
            <HalfCircleProgress
              progress={progress}
              size={50}
              strokeWidth={5}
              color={goal.color || colors.primary}
              backgroundColor={colors.surfaceTertiary}
              textColor={colors.textPrimary}
            />
          </View>
        </View>
      </VoidCard>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  icon: {
    fontSize: 24,
  },
  title: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk-Bold',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.3)',
  },
  badgeText: {
    color: '#4ECDC4',
    fontSize: 8,
    fontFamily: 'SpaceMono-Regular',
    fontWeight: 'bold',
  },
  targetText: {
    fontSize: 10,
    fontFamily: 'SpaceMono-Regular',
    letterSpacing: 0.5,
  },
  progressContainer: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  }
});
