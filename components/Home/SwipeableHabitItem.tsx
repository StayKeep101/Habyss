import { FontFamily } from '@/constants/DesignSystem';
import React, { useRef } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions } from 'react-native';
import { TouchableOpacity, Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SwipeRow } from '@/components/Common/SwipeRow';
import { BadgeRow, MeasureBadge, ReminderBadge } from '@/components/Common/CardBadges';
import { CheckPop } from '@/components/Common/CheckPop';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { SharedFaces } from '@/components/Common/SharedFaces';
import type { SharedState } from '@/lib/shared';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { Habit } from '@/lib/habitsSQLite';
import { useRouter } from 'expo-router';
import { RoadMapCardSize } from '@/constants/AppSettingsContext';
import { VoidCard } from '../Layout/VoidCard';
import { useHaptics } from '@/hooks/useHaptics';
import Svg, { Rect, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { runOnJS } from 'react-native-reanimated';

// Extended habit type with runtime properties
interface ExtendedHabit extends Habit {
  completed?: boolean;
  streak?: number;
}

interface SwipeableHabitItemProps {
  habit: ExtendedHabit;
  onPress: (habit: ExtendedHabit) => void;
  onToggle?: (habit: ExtendedHabit) => void;
  onEdit: (habit: ExtendedHabit) => void;
  onDelete: (habit: ExtendedHabit) => void;
  onShare?: (habit: ExtendedHabit) => void;
  size: RoadMapCardSize;
  completed?: boolean; // New prop for performance (avoids object recreation)
  goalName?: string; // Optional goal name to display as subtitle
  isActive?: boolean;
  timeLeft?: number; // In seconds
  totalDuration?: number; // In minutes
  canFocusNow?: boolean;
  onFocusPress?: (habit: ExtendedHabit) => void;
  onDragStart?: (habit: ExtendedHabit, x: number, y: number) => void;
  onDragMove?: (habit: ExtendedHabit, x: number, y: number) => void;
  onDragEnd?: (habit: ExtendedHabit, x: number, y: number) => void;
  isDragging?: boolean;
  /**
   * Who else is on this one, when anybody is.
   *
   * Passed in rather than fetched here: a list of thirty rows would otherwise
   * open thirty requests and re-render thirty times while somebody scrolls.
   */
  shared?: SharedState | null;
  /** Stand down for today, on purpose: neither done nor missed. */
  onSkip?: (habit: ExtendedHabit) => void;
  skipped?: boolean;
}

const { width } = Dimensions.get('window');
const ACTION_WIDTH = 70; // Slightly larger for better touch targets

const SwipeableHabitItemComponent: React.FC<SwipeableHabitItemProps> = ({
  habit, onPress, onToggle, onEdit, onDelete, onShare, size, completed, goalName, isActive, timeLeft, totalDuration,
  canFocusNow, onFocusPress,
  onDragStart, onDragMove, onDragEnd, isDragging = false, onSkip, skipped = false, shared = null
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const router = useRouter();
  const { lightFeedback, selectionFeedback, mediumFeedback } = useHaptics();
  const { colors: accentColors, primary: accentColor } = useAccentGradient();

  // Measure card for SVG Border
  const [layout, setLayout] = React.useState({ width: 0, height: 0 });


  // Prefer dedicated prop, fallback to object property
  const doneByMe = completed !== undefined ? completed : habit.completed;
  /**
   * A shared habit is not done until everybody on it is done.
   *
   * Your own tick is still your own tick — it is recorded, it still counts
   * towards your streak, and the box stays filled. What changes is what the
   * *row* claims: it reads as finished only when nobody is being waited on,
   * which is the whole reason for sharing it.
   */
  const isCompleted = shared ? shared.complete : doneByMe;

  // Dynamic Sizing (Habits must be smaller than Goals)
  const isSmall = size === 'small';
  const isBig = size === 'big';

  // Even for BIG, habits should stay relatively compact compared to goals
  const paddingV = isSmall ? 4 : (isBig ? 12 : 10);
  const iconSize = isSmall ? 12 : (isBig ? 16 : 14);
  const iconBoxSize = isSmall ? 20 : (isBig ? 32 : 26);
  const fontSize = isSmall ? 11 : (isBig ? 14 : 13);
  const checkboxSize = isSmall ? 14 : (isBig ? 20 : 18);

  // Timer Progress Logic
  const formattedTime = React.useMemo(() => {
    if (!timeLeft) return null;
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }, [timeLeft]);

  const progress = React.useMemo(() => {
    if (!timeLeft || !totalDuration) return 0;
    const totalSeconds = totalDuration * 60;
    const elapsed = totalSeconds - timeLeft;
    return Math.min(elapsed / totalSeconds, 1);
  }, [timeLeft, totalDuration]);

  // SVG Calculations
  const strokeWidth = 3;
  const radius = 10;
  // Perimeter of rect with rx/ry: 2*(w+h) - 8r + 2PI*r
  const perimeter = 2 * (layout.width + layout.height) - 8 * radius + (2 * Math.PI * radius);
  const strokeDashoffset = perimeter * (1 - progress);

  const dragGesture = Gesture.Pan()
    .enabled(!!onDragStart)
    .activateAfterLongPress(250)
    .onStart((event) => {
      if (onDragStart) {
        runOnJS(onDragStart)(habit, event.absoluteX, event.absoluteY);
      }
    })
    .onUpdate((event) => {
      if (onDragMove) {
        runOnJS(onDragMove)(habit, event.absoluteX, event.absoluteY);
      }
    })
    .onFinalize((event) => {
      if (onDragEnd) {
        runOnJS(onDragEnd)(habit, event.absoluteX, event.absoluteY);
      }
    });

  return (
    <GestureDetector gesture={dragGesture}>
      <View style={[styles.dragWrapper, isDragging && styles.dragging]}>
        <SwipeRow
          left={onSkip ? {
            // Standing down on purpose, rather than quietly missing the day.
            icon: skipped ? 'arrow-undo' : 'play-skip-forward',
            label: skipped ? 'Undo' : 'Skip',
            color: skipped ? colors.textTertiary : '#64748B',
            onPress: () => onSkip(habit),
          } : undefined}
          right={[
            { icon: 'pencil', label: 'Edit', color: '#F59E0B', onPress: () => { selectionFeedback(); onEdit(habit); } },
            { icon: 'trash', label: 'Delete', color: '#EF4444', destructive: true, onPress: () => { mediumFeedback(); onDelete(habit); } },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => onPress(habit)}
            style={styles.cardWrapper}
            onLayout={(e) => setLayout(e.nativeEvent.layout)}
          >
        {/* Active Gradient Border Wrapper (NOW SVG) */}
        {isActive && layout.width > 0 && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width={layout.width} height={layout.height} style={StyleSheet.absoluteFill} pointerEvents="none">
              <Defs>
                <SvgGradient id="grad" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={accentColors[0]} stopOpacity="1" />
                  <Stop offset="1" stopColor={accentColors[1]} stopOpacity="1" />
                </SvgGradient>
              </Defs>
              {/* Background Track */}
              <Rect
                x={strokeWidth / 2}
                y={strokeWidth / 2}
                width={layout.width - strokeWidth}
                height={layout.height - strokeWidth}
                rx={radius}
                stroke={accentColors[0] + '30'}
                strokeWidth={strokeWidth}
                fill="none"
              />
              {/* Progress Stroke */}
              <Rect
                x={strokeWidth / 2}
                y={strokeWidth / 2}
                width={layout.width - strokeWidth}
                height={layout.height - strokeWidth}
                rx={radius}
                stroke="url(#grad)" // Use gradient
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={perimeter}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </Svg>
          </View>
        )}

        <View>
          {/* Main Card Content */}
          <VoidCard
            intensity={40} // Lighter glass for items
            style={[
              styles.card,
              (isCompleted || (skipped && !isCompleted)) && { opacity: 0.7 },
              { paddingVertical: paddingV },
              isActive && { margin: 4 } // Inset to not cover border
            ]}
          >
            {/* Checkbox / Hit Area */}
            <TouchableOpacity
              activeOpacity={0.6}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!doneByMe }}
              accessibilityLabel={skipped ? `${habit.name}, skipped today` : isCompleted ? `Undo ${habit.name}` : `Mark ${habit.name} done`}
              onPress={() => onToggle && onToggle(habit)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <CheckPop active={!!doneByMe} color={accentColor} size={checkboxSize}>
                <View style={[
                  styles.checkbox,
                  { width: checkboxSize, height: checkboxSize, borderRadius: checkboxSize / 2 },
                  doneByMe && { backgroundColor: accentColor + '30', borderColor: accentColor },
                  isActive && { borderColor: accentColor, backgroundColor: accentColor + '20' },
                  // A skipped day is drawn as set aside, not as failed.
                  skipped && !doneByMe && { borderStyle: 'dashed', borderColor: colors.textTertiary },
                ]}>
                  {isCompleted || isActive ? (
                    <Ionicons name={isCompleted ? 'checkmark' : 'play'} size={checkboxSize * 0.7} color={accentColor} />
                  ) : skipped ? (
                    <Ionicons name="remove" size={checkboxSize * 0.7} color={colors.textTertiary} />
                  ) : null}
                </View>
              </CheckPop>
            </TouchableOpacity>

            {/* Icon */}
            <View style={[styles.iconContainer, { width: iconBoxSize, height: iconBoxSize }, { backgroundColor: isCompleted ? accentColor + '15' : (habit.color || accentColor) + '15' }]}>
              <Ionicons name={(habit.icon as any) || 'ellipse-outline'} size={iconSize} color={isCompleted ? accentColor : habit.color || colors.textSecondary} />
            </View>

            {/* Text Info */}
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { fontSize, color: colors.textPrimary, textDecorationLine: isCompleted ? 'line-through' : 'none' }, isActive && { fontFamily: FontFamily.bold, color: accentColor }]} numberOfLines={1}>
                {habit.name}
              </Text>
              {shared && !isSmall ? (
                <View style={styles.sharedRow}>
                  <SharedFaces people={shared.people} tint={accentColor} size={18} />
                  <Text numberOfLines={1} style={{ fontSize: 10, color: shared.waitingOnYou ? colors.warning : colors.textTertiary, fontFamily: FontFamily.medium }}>
                    {shared.line}
                  </Text>
                </View>
              ) : skipped && !isCompleted && !isSmall ? (
                <Text style={{ fontSize: 10, color: colors.textTertiary, fontFamily: FontFamily.medium, marginTop: 2 }}>Skipped today</Text>
              ) : goalName && !isSmall ? (
                <Text style={{ fontSize: 10, color: colors.textTertiary, fontFamily: FontFamily.regular, marginTop: 2 }} numberOfLines={1}>{goalName}</Text>
              ) : ((habit.streak ?? 0) > 0 && !isSmall) ? (
                <Text style={[styles.streakText, { color: '#F59E0B' }]}><Ionicons name="flame-outline" size={12} color="#F59E0B" /> {habit.streak}</Text>
              ) : canFocusNow && onFocusPress && !isSmall ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => onFocusPress(habit)}
                  style={[styles.metaBadge, styles.metaBadgeCompact, { backgroundColor: accentColor + '1c', borderColor: accentColor + '38' }]}
                >
                  <Text style={[styles.metaBadgeText, { color: accentColor }]}>Focus now</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Time / Timer + Target (Compact) */}
            <View style={{ alignItems: 'flex-end' }}>
              {isActive && formattedTime ? (
                <Text style={{ fontSize: 13,  color: accentColor, fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] }}>
                  {formattedTime}
                </Text>
              ) : (
                <>
                  <View style={{ marginBottom: 2 }}>
                    <BadgeRow>
                      {/* Whether it will remind you, and what it asks for —
                          both drawn the same way as on a task. The bell is a
                          few pixels; a compact card can carry it. */}
                      <ReminderBadge on={(habit.reminders?.length ?? 0) > 0} size={isSmall ? 10 : undefined} />
                      {!isSmall && habit.unit && habit.unit !== 'count' ? (
                        <MeasureBadge value={habit.goalValue} unit={habit.unit} />
                      ) : null}
                    </BadgeRow>
                  </View>
                  <Text style={[styles.timeText, { color: colors.textTertiary, fontSize: isSmall ? 9 : 11 }]}>
                    {habit.startTime || '--:--'}{habit.durationMinutes ? ` · ${habit.durationMinutes}m` : ''}
                  </Text>
                </>
              )}
            </View>

          </VoidCard>
        </View>
          </TouchableOpacity>
        </SwipeRow>
      </View>
    </GestureDetector>
  );
};

SwipeableHabitItemComponent.displayName = 'SwipeableHabitItem';

export const SwipeableHabitItem = React.memo(SwipeableHabitItemComponent);

const styles = StyleSheet.create({
  swipeableContainer: {
    marginBottom: 4, // Tighter gap
    borderRadius: 8,
    overflow: 'hidden',
  },
  dragWrapper: {
    position: 'relative',
  },
  dragging: {
    opacity: 0.25,
  },
  cardWrapper: {
    backgroundColor: 'transparent',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  checkbox: {
    borderWidth: 1.5,
    borderColor: 'rgba(128,128,128,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  iconContainer: {
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  title: {

    fontFamily: FontFamily.medium, // Lighter weight for items
  },
  sharedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  streakText: {
    fontSize: 9,
    fontFamily: FontFamily.bold,
    marginTop: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  metaBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  metaBadgeCompact: {
    marginTop: 3,
    alignSelf: 'flex-start',
  },
  metaBadgeText: {
    fontSize: 9,
    fontFamily: FontFamily.regular,
    color: '#A1A1AA',
  },
  timeText: {
    fontFamily: FontFamily.regular,
  },
  leftAction: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 20,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  rightActionsContainer: {
    flexDirection: 'row',
  },
  rightAction: {
    width: ACTION_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
