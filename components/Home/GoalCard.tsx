import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { Habit } from '@/lib/habitsSQLite';
import { Ionicons } from '@expo/vector-icons';
import { useAccentGradient } from '@/constants/AccentContext';

import { RoadMapCardSize } from '@/constants/AppSettingsContext';

import { VoidCard } from '../Layout/VoidCard';

interface GoalCardProps {
  goal: Habit;
  progress: number;
  onPress: () => void;
  size: RoadMapCardSize;
  isExpanded: boolean;
  onToggleExpand: () => void;
  linkedHabitsCount: number;
  sharedWith?: { id: string; avatarUrl?: string; username?: string }[];
}

export const GoalCard: React.FC<GoalCardProps> = ({
  goal, progress, onPress, size, isExpanded, onToggleExpand, linkedHabitsCount, sharedWith
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const isLight = theme === 'light';
  const { primary } = useAccentGradient();
  const defaultColor = primary;

  const daysLeft = goal.targetDate
    ? Math.max(0, Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Dynamic Styles based on Size
  const isSmall = size === 'small';
  const isBig = size === 'big';

  const padding = isSmall ? 8 : (isBig ? 16 : 12);
  const iconSize = isSmall ? 14 : (isBig ? 24 : 18);
  const iconBoxSize = isSmall ? 28 : (isBig ? 48 : 36);
  const titleSize = isSmall ? 12 : (isBig ? 18 : 14);
  const barHeight = isSmall ? 3 : (isBig ? 6 : 4);

  return (
    <TouchableOpacity onPress={onToggleExpand} activeOpacity={0.8} style={{ flex: 1 }}>
      <VoidCard glass intensity={isLight ? 20 : (isBig ? 80 : 60)} style={[styles.card, { padding }, isLight && { backgroundColor: colors.surfaceSecondary }]}>
        {/* NavigationTrigger (Icon) */}
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            onPress();
          }}
          activeOpacity={0.6}
          style={[styles.iconBox, {
            width: iconBoxSize, height: iconBoxSize,
            backgroundColor: (goal.color || defaultColor) + '20'
          }]}
        >
          <Ionicons name={(goal.icon as any) || 'flag'} size={iconSize} color={goal.color || defaultColor} />
          {/* Subtle indicator that this is clickable for details */}
          <View style={{ position: 'absolute', bottom: -4, right: -4, backgroundColor: colors.surface, borderRadius: 6, padding: 1 }}>
            <Ionicons name="open-outline" size={8} color={colors.textTertiary} />
          </View>
        </TouchableOpacity>

        {/* Content (Expands) */}
        <View style={styles.content}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: isBig ? 6 : 2 }}>
            <Text style={[styles.name, { color: colors.textPrimary, fontSize: titleSize }]} numberOfLines={1}>{goal.name}</Text>
            {daysLeft !== null && (
              <View style={[styles.daysChip, { backgroundColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }, daysLeft < 7 && { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                <Text style={[styles.daysText, { color: colors.textSecondary }, daysLeft < 7 && { color: '#EF4444' }]}>{daysLeft}d</Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.progressBg, { height: barHeight, backgroundColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }]}>
              <View style={[styles.progressFill, { backgroundColor: goal.color || defaultColor, width: `${progress}%` }]} />
            </View>
            <Text style={[styles.progressText, { color: goal.color || defaultColor, fontSize: isSmall ? 9 : 11 }]}>{Math.round(progress)}%</Text>
          </View>
        </View>

        {/* Shared With Avatars */}
        {sharedWith && sharedWith.length > 0 && (
          <View style={{ flexDirection: 'row', marginRight: 8 }}>
            {sharedWith.slice(0, 3).map((friend, idx) => (
              <View
                key={friend.id}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: colors.surfaceTertiary,
                  borderWidth: 2,
                  borderColor: colors.surface,
                  marginLeft: idx > 0 ? -8 : 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {friend.avatarUrl ? (
                  <Image source={{ uri: friend.avatarUrl }} style={{ width: 18, height: 18, borderRadius: 9 }} />
                ) : (
                  <Text style={{ fontSize: 9, color: colors.textSecondary }}>
                    {friend.username?.[0]?.toUpperCase() || '?'}
                  </Text>
                )}
              </View>
            ))}
            {sharedWith.length > 3 && (
              <View style={{
                width: 22, height: 22, borderRadius: 11,
                backgroundColor: colors.surfaceTertiary, marginLeft: -8,
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 2, borderColor: colors.surface,
              }}>
                <Text style={{ fontSize: 8, color: colors.textSecondary }}>+{sharedWith.length - 3}</Text>
              </View>
            )}
          </View>
        )}

        {/* Expansion Indicator (Visual only, transmits press to parent) */}
        <View style={[styles.toggleBtn, { borderLeftColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.05)' }]}>
          <Text style={{ color: colors.textTertiary, fontSize: 10, fontWeight: '700', fontFamily: 'Lexend', marginRight: 4 }}>
            {linkedHabitsCount}
          </Text>
          <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color={colors.textTertiary} />
        </View>

      </VoidCard>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
  },
  iconBox: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontWeight: '700',
    fontFamily: 'Lexend',
    marginRight: 8,
    flex: 1,
  },
  daysChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  daysText: {
    fontSize: 9,
    fontWeight: '600',
  },
  progressBg: {
    flex: 1,
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontWeight: '700',
    fontFamily: 'Lexend_400Regular',
    minWidth: 28,
    textAlign: 'right',
  },
  toggleBtn: {
    paddingLeft: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 1,
    marginLeft: 4,
  }
});
