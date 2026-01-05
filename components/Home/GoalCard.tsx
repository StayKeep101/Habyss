import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { Habit } from '@/lib/habits';
import { Ionicons } from '@expo/vector-icons';

interface GoalCardProps {
  goal: Habit;
  progress: number;
  onPress: () => void;
}

export const GoalCard: React.FC<GoalCardProps> = ({ goal, progress, onPress }) => {
  const { theme } = useTheme();
  const colors = Colors[theme];

  const daysLeft = goal.targetDate
    ? Math.max(0, Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.card}>
      {/* Icon */}
      <View style={[styles.iconBox, { backgroundColor: (goal.color || '#8B5CF6') + '20' }]}>
        <Ionicons name={(goal.icon as any) || 'flag'} size={18} color={goal.color || '#8B5CF6'} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>{goal.name}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={10} color={colors.textTertiary} />
          <Text style={[styles.deadline, { color: colors.textTertiary }]}>
            {goal.targetDate ? formatDate(goal.targetDate) : 'No deadline'}
          </Text>
          {daysLeft !== null && (
            <View style={[styles.daysChip, daysLeft < 7 && { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
              <Text style={[styles.daysText, daysLeft < 7 && { color: '#EF4444' }]}>{daysLeft}d</Text>
            </View>
          )}
        </View>
        {/* Progress Bar */}
        <View style={styles.progressRow}>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { backgroundColor: goal.color || '#8B5CF6', width: `${Math.max(progress, 3)}%` }]} />
          </View>
          <Text style={[styles.progressText, { color: goal.color || '#8B5CF6' }]}>{progress}%</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  deadline: {
    fontSize: 10,
  },
  daysChip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 4,
  },
  daysText: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
