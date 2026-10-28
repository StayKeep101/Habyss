import { FontFamily } from '@/theme/designSystem';
import { formatClock, formatDuration, measurementFor } from '@/lib/habitMeasurement';
import React, { useRef } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions } from 'react-native';
import { textOn } from '@/theme/tokens';
import { CountUp } from '@/components/ui/Motion';
import { TouchableOpacity, Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SwipeRow } from '@/components/ui/SwipeRow';
import { CheckPop } from '@/components/ui/CheckPop';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { SharedFaces } from '@/components/Common/SharedFaces';
import type { SharedState } from '@/lib/shared';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { Habit } from '@/lib/habitsSQLite';
import { useRouter } from 'expo-router';
import { RoadMapCardSize } from '@/context/AppSettingsContext';
import { VoidCard } from '@/components/ui/VoidCard';
import { FocusPill } from '@/components/ui/FocusPill';
import { Radius } from '@/theme/designSystem';
import { useHaptics } from '@/hooks/useHaptics';
import { runOnJS } from 'react-native-reanimated';
import { HOLD_MS, STILL } from '@/components/ui/DragDrop';
import { useFocusTimeLeft } from '@/context/FocusTimeContext';

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
  /** The habit being focused on now: its row follows the running clock (only that row redraws each second). */
  followFocus?: boolean;
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
  const { primary: accentColor } = useAccentGradient();

  // Measure card for SVG Border


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
  // The right edge: when, and how much (never "1 time"; a timed habit says its length once).
  const sideMain = isSmall ? 11 : (isBig ? 13 : 12);
  const sideSub = isSmall ? 10 : (isBig ? 12 : 11);
  const measure = measurementFor(habit);
  const block = habit.durationMinutes ? formatDuration(habit.durationMinutes * 60, true) : null;
  const when = habit.startTime ? (measure.kind !== 'timer' && block ? `${habit.startTime} · ${block}` : habit.startTime) : null;
  const amount = measure.kind === 'timer' ? formatDuration(measure.target * measure.secondsPerUnit, true)
    : measure.kind === 'counter' ? `${measure.target} ${habit.unit}`
    : !habit.startTime ? block : null;
  const remind = (habit.reminders?.length ?? 0) > 0;

  // Timer Progress Logic
  // Hours, minutes and seconds — "3:56:07", never "236:07".
  const formattedTime = React.useMemo(() => (timeLeft ? formatClock(timeLeft) : null), [timeLeft]);

  // A still hold lifts it; moving first is a scroll. Only a drag that really
  // began ends in a drop (onEnd): a tap, a scroll or the tick never does.
  const dragGesture = Gesture.Pan()
    .enabled(!!onDragStart)
    .activateAfterLongPress(HOLD_MS)
    .failOffsetX([-STILL, STILL]).failOffsetY([-STILL, STILL])
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
    .onEnd((event) => {
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
          >
        <View>
          {/* Main Card Content */}
          <VoidCard
            radius={Radius.pill}
            intensity={40} // Lighter glass for items
            style={[
              styles.card,
              (isCompleted || (skipped && !isCompleted)) && { opacity: 0.7 },
              { paddingVertical: paddingV },
            ]}
          >
            {/* Checkbox / Hit Area */}
            <TouchableOpacity
              activeOpacity={0.6}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!doneByMe }}
              accessibilityLabel={skipped ? `${habit.name}, skipped today` : isCompleted ? `Undo ${habit.name}` : `Mark ${habit.name} done`}
              onPress={() => onToggle && onToggle(habit)}
              hitSlop={Math.max(10, (44 - checkboxSize) / 2)}
            >
              <CheckPop active={!!doneByMe} color={accentColor} size={checkboxSize}>
                <View style={[
                  styles.checkbox,
                  { width: checkboxSize, height: checkboxSize, borderRadius: checkboxSize / 2 },
                  // Done: a solid disc of the habit's colour with a tick, the
                  // way every chosen thing is drawn. Running: a ring, no fill.
                  doneByMe && { backgroundColor: habit.color || accentColor, borderColor: habit.color || accentColor },
                  isActive && { borderColor: habit.color || accentColor },
                  // A skipped day is drawn as set aside, not as failed.
                  skipped && !doneByMe && { borderStyle: 'dashed', borderColor: colors.textTertiary },
                ]}>
                  {isCompleted || isActive ? (
                    <Ionicons name={isCompleted ? 'checkmark' : 'play'} size={checkboxSize * 0.7} color={isCompleted ? textOn(habit.color || accentColor) : (habit.color || accentColor)} />
                  ) : skipped ? (
                    <Ionicons name="remove" size={checkboxSize * 0.7} color={colors.textTertiary} />
                  ) : null}
                </View>
              </CheckPop>
            </TouchableOpacity>

            {/* Icon */}
            {/* A solid tile of the habit's colour, Phantom-style; once done it steps back to a tint. */}
            <View style={[styles.iconContainer, { width: iconBoxSize, height: iconBoxSize }, { backgroundColor: isCompleted ? (habit.color || accentColor) + '33' : (habit.color || accentColor) }]}>
              <Ionicons filled name={(habit.icon as any) || 'ellipse-outline'} size={iconSize} color={isCompleted ? habit.color || accentColor : textOn(habit.color || accentColor)} />
            </View>

            {/* Text Info */}
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { fontSize, color: colors.textPrimary, textDecorationLine: isCompleted ? 'line-through' : 'none' }, isActive && { fontFamily: FontFamily.bold, color: accentColor }]} numberOfLines={1}>
                {habit.name}
              </Text>
              {shared ? (
                <View style={styles.sharedRow}>
                  <SharedFaces people={shared.people} tint={accentColor} size={isSmall ? 20 : 24} />
                  {!isSmall ? (
                    <Text numberOfLines={1} style={{ fontSize: 11, color: shared.waitingOnYou ? colors.warning : colors.textTertiary, fontFamily: FontFamily.medium }}>
                      {shared.line}
                    </Text>
                  ) : null}
                </View>
              ) : skipped && !isCompleted && !isSmall ? (
                <Text style={{ fontSize: 11, color: colors.textTertiary, fontFamily: FontFamily.medium, marginTop: 2 }}>Skipped today</Text>
              ) : goalName && !isSmall ? (
                <Text style={{ fontSize: 11, color: colors.textTertiary, fontFamily: FontFamily.regular, marginTop: 2 }} numberOfLines={1}>{goalName}</Text>
              ) : ((habit.streak ?? 0) > 0 && !isSmall) ? (
                <Text style={[styles.streakText, { color: '#F59E0B' }]}><Ionicons name="flame-outline" size={12} color="#F59E0B" /> <CountUp value={habit.streak ?? 0} /></Text>
              ) : null}
            </View>

            {/* The right edge, the same on every card: when (with the bell if
                it reminds you), then how much, only if that says something.
                Small cards keep to one line. */}
            <View style={styles.side}>
              {/* What you should be on right now: Focus, on the card itself. */}
              {canFocusNow && onFocusPress && !isActive && !isCompleted ? (
                <FocusPill color={habit.color || accentColor} label={habit.name} compact={isSmall} onPress={() => onFocusPress(habit)} />
              ) : isActive && formattedTime ? (
                <Text style={[styles.sideMain, { color: accentColor, fontFamily: FontFamily.bold, fontSize: sideMain }]}>{formattedTime}</Text>
              ) : (
                <>
                  {when || remind ? (
                    <View style={styles.sideRow}>
                      {remind ? <Ionicons name="notifications" size={sideMain - 1} color={colors.textTertiary} /> : null}
                      {when ? <Text style={[styles.sideMain, { color: colors.textSecondary, fontSize: sideMain }]}>{when}</Text> : null}
                    </View>
                  ) : null}
                  {amount && (!isSmall || !when) ? (
                    <Text style={[when || remind ? styles.sideSub : styles.sideMain, { color: when || remind ? colors.textTertiary : colors.textSecondary, fontSize: when || remind ? sideSub : sideMain }]}>{amount}</Text>
                  ) : null}
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

/** The row being focused on: reads the clock itself, so nothing above it redraws every second. */
const FocusedHabitItem: React.FC<SwipeableHabitItemProps> = (props) => {
  const timeLeft = useFocusTimeLeft();
  return <SwipeableHabitItemComponent {...props} timeLeft={timeLeft} />;
};

export const SwipeableHabitItem = React.memo((props: SwipeableHabitItemProps) =>
  props.followFocus ? <FocusedHabitItem {...props} /> : <SwipeableHabitItemComponent {...props} />);

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
    fontSize: 11,
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
  timeText: {
    fontFamily: FontFamily.regular,
  },
  side: { alignItems: 'flex-end', justifyContent: 'center', gap: 2, marginLeft: 8 },
  sideRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sideMain: { fontFamily: FontFamily.medium, fontVariant: ['tabular-nums'] },
  sideSub: { fontFamily: FontFamily.regular, fontVariant: ['tabular-nums'] },
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
