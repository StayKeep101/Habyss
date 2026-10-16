import { FontFamily } from '@/theme/designSystem';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Dimensions, ListRenderItemInfo } from 'react-native';
import { IconButton } from '@/components/ui/IconButton';
import Animated, { Easing, ReduceMotion, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { textOn } from '@/theme/tokens';
import { AnimatedCircle, useProgress } from '@/components/ui/Motion';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import Svg, { Circle } from 'react-native-svg';

interface CalendarStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  completionData?: Record<string, { completed: number; total: number }>;
  goalDeadlines?: Record<string, { count: number; color: string }>;
}

interface DateItem {
  dayName: string;
  dayNumber: number;
  fullDate: Date;
  id: string;
  progress: number;
  isGoalDeadline?: boolean;
  goalColor?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_WIDTH = SCREEN_WIDTH / 7;
const TOTAL_WEEKS = 10000;
const BASE_WEEK_INDEX = Math.floor(TOTAL_WEEKS / 2);

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const stripTime = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getStartOfWeek = (date: Date) => {
  const day = stripTime(date);
  return addDays(day, -day.getDay());
};

const DateButtonComponent = ({
  item,
  selected,
  onSelect,
  width,
  colors,
  accentColor,
  isLight,
}: {
  item: DateItem;
  selected: boolean;
  onSelect: (date: Date) => void;
  width: number;
  colors: any;
  accentColor: string;
  isLight: boolean;
}) => {
  const size = 34;
  const strokeWidth = 3.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const shown = useProgress(item.progress);
  const arc = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - shown.get()) }));

  const trackColor = isLight
    ? (selected ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.08)')
    : (selected ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)');

  const isDeadline = item.isGoalDeadline;
  const deadlineColor = item.goalColor || accentColor;

  return (
    <View style={{ width, alignItems: 'center', justifyContent: 'center' }}>
      <TouchableOpacity
        onPress={() => onSelect(item.fullDate)}
        style={{ width, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' }}
      >
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
          {isDeadline ? <GoalDay color={deadlineColor} size={size} selected={selected} ring={isLight ? 'black' : 'white'} /> : null}

          {!isDeadline ? <View style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
            <Svg width={size} height={size}>
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={trackColor}
                strokeWidth={strokeWidth}
                fill="transparent"
              />
              <AnimatedCircle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={selected ? (isLight ? 'black' : 'white') : (isDeadline ? deadlineColor : accentColor)}
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={`${circumference} ${circumference}`}
                animatedProps={arc}
                strokeLinecap="round"
              />
            </Svg>
          </View> : null}

          <View
            style={{
              width: size - 8,
              height: size - 8,
              borderRadius: (size - 8) / 2,
              backgroundColor: selected && !isDeadline ? accentColor : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: isDeadline ? textOn(deadlineColor) : selected ? 'white' : (isLight ? 'black' : colors.textSecondary), fontSize: 14, fontFamily: FontFamily.bold }}>
              {item.dayNumber}
            </Text>
          </View>
        </View>

        <Text
          style={{
            color: selected ? (isLight ? 'black' : 'white') : (isDeadline ? deadlineColor : (isLight ? 'rgba(0,0,0,0.6)' : colors.textTertiary)),
            fontFamily: isDeadline ? FontFamily.bold : FontFamily.medium,
            fontSize: 12,
          }}
        >
          {item.dayName}
        </Text>

      </TouchableOpacity>
    </View>
  );
};

DateButtonComponent.displayName = 'DateButton';

/**
 * A goal's finish day: a solid, top-lit disc in the goal's own colour, a soft
 * glow that breathes, and a small flag badge on its shoulder — the one day on
 * the strip that looks like an occasion rather than a date.
 */
const GoalDay = ({ color, size, selected, ring }: { color: string; size: number; selected: boolean; ring: string }) => {
  const breath = useSharedValue(0);
  useEffect(() => {
    // Three breaths, then it settles lit. Breathing forever redrew every goal
    // day on the strip each frame, all day — real battery and heat.
    breath.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.System }), 5, true);
  }, [breath]);
  const glow = useAnimatedStyle(() => ({ opacity: 0.25 + breath.value * 0.35, transform: [{ scale: 1 + breath.value * 0.18 }] }));
  const disc = size + 4;
  return (
    <>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: disc, height: disc, borderRadius: disc / 2, backgroundColor: color }, glow]} />
      <View pointerEvents="none" style={{
        position: 'absolute', width: disc, height: disc, borderRadius: disc / 2, overflow: 'hidden',
        borderWidth: selected ? 2 : 0, borderColor: ring,
      }}>
        <LinearGradient colors={[color, color + 'CC']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ flex: 1 }} /* ui-allow: goal colour */ />
      </View>
      <View pointerEvents="none" style={{
        position: 'absolute', top: -6, right: -8, width: 16, height: 16, borderRadius: 8,
        backgroundColor: ring === 'white' ? '#000000' : '#FFFFFF', alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name="flag" size={10} color={color} />
      </View>
    </>
  );
};

const DateButton = React.memo(DateButtonComponent);

export const CalendarStrip: React.FC<CalendarStripProps> = ({
  selectedDate,
  onSelectDate,
  completionData = {},
  goalDeadlines = {},
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const isLight = theme === 'light';
  const { primary: accentColor } = useAccentGradient();
  const flatListRef = useRef<FlatList<number>>(null);

  const today = useMemo(() => stripTime(new Date()), []);
  const baseWeekStart = useMemo(() => getStartOfWeek(today), [today]);
  const weekIndexes = useMemo(() => Array.from({ length: TOTAL_WEEKS }, (_, index) => index), []);

  const getWeekStartForIndex = useCallback((index: number) => {
    return addDays(baseWeekStart, (index - BASE_WEEK_INDEX) * 7);
  }, [baseWeekStart]);

  const getWeekIndexForDate = useCallback((date: Date) => {
    const selectedWeekStart = getStartOfWeek(date);
    const diffMs = stripTime(selectedWeekStart).getTime() - baseWeekStart.getTime();
    const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
    return BASE_WEEK_INDEX + diffWeeks;
  }, [baseWeekStart]);

  // The week on screen. Scrolling is only asked for when the selected day is
  // in another week; asking to scroll to the week already showing used to set
  // a "this scroll is mine" flag that never cleared (nothing moved, so no
  // scroll ever ended), and the next real swipe was swallowed — every other
  // swipe selected nothing.
  const shownWeek = useRef(getWeekIndexForDate(selectedDate));
  useEffect(() => {
    const targetIndex = getWeekIndexForDate(selectedDate);
    if (!flatListRef.current || targetIndex < 0 || targetIndex >= TOTAL_WEEKS) return;
    if (targetIndex === shownWeek.current) return;
    shownWeek.current = targetIndex;
    flatListRef.current.scrollToIndex({ index: targetIndex, animated: true });
  }, [selectedDate, getWeekIndexForDate]);

  const buildWeekItems = useCallback((weekIndex: number): DateItem[] => {
    const weekStart = getWeekStartForIndex(weekIndex);

    return Array.from({ length: 7 }, (_, dayOffset) => {
      const date = addDays(weekStart, dayOffset);
      const dateKey = toDateKey(date);
      const dayData = completionData[dateKey];
      const deadlineInfo = goalDeadlines[dateKey];

      return {
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
        fullDate: date,
        id: dateKey,
        progress: dayData && dayData.total > 0 ? dayData.completed / dayData.total : 0,
        isGoalDeadline: !!deadlineInfo,
        goalColor: deadlineInfo?.color,
      };
    });
  }, [completionData, getWeekStartForIndex, goalDeadlines]);

  const renderWeek = useCallback(({ item: weekIndex }: ListRenderItemInfo<number>) => {
    const weekItems = buildWeekItems(weekIndex);

    return (
      <View style={{ width: SCREEN_WIDTH, flexDirection: 'row' }}>
        {weekItems.map((item) => {
          const selected = toDateKey(item.fullDate) === toDateKey(selectedDate);

          return (
            <DateButton
              key={item.id}
              item={item}
              selected={selected}
              onSelect={onSelectDate}
              width={ITEM_WIDTH}
              colors={colors}
              accentColor={accentColor}
              isLight={isLight}
            />
          );
        })}
      </View>
    );
  }, [accentColor, buildWeekItems, colors, isLight, onSelectDate, selectedDate]);

  const getItemLayout = useCallback((_: ArrayLike<number> | null | undefined, index: number) => ({
    length: SCREEN_WIDTH,
    offset: SCREEN_WIDTH * index,
    index,
  }), []);

  /** A swipe landed on a week: select the same weekday there, every time. */
  const handleScrollEnd = useCallback((event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const weekIndex = Math.round(offsetX / SCREEN_WIDTH);
    if (weekIndex < 0 || weekIndex >= TOTAL_WEEKS) return;
    shownWeek.current = weekIndex;
    // Landed where the selection already is (our own scroll, or a swipe that
    // came back): nothing to change.
    if (weekIndex === getWeekIndexForDate(selectedDate)) return;

    const targetWeekStart = getWeekStartForIndex(weekIndex);
    const nextDate = addDays(targetWeekStart, selectedDate.getDay());

    if (toDateKey(nextDate) !== toDateKey(selectedDate)) {
      onSelectDate(nextDate);
    }
  }, [getWeekStartForIndex, getWeekIndexForDate, onSelectDate, selectedDate]);

  const onScrollToIndexFailed = useCallback((info: { index: number }) => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToOffset({
        offset: info.index * SCREEN_WIDTH,
        animated: false,
      });
    });
  }, []);

  const isTodaySelected = toDateKey(selectedDate) === toDateKey(today);
  const headerTitle = isTodaySelected ? 'Today' : selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
  const headerDate = selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const handlePrevWeek = () => {
    onSelectDate(addDays(selectedDate, -7));
  };

  const handleNextWeek = () => {
    onSelectDate(addDays(selectedDate, 7));
  };

  return (
    <View style={{ paddingTop: 8, paddingBottom: 4, backgroundColor: 'transparent' }}>
      <View style={{ paddingHorizontal: 24, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon="chevron-back" label="Previous week" onPress={handlePrevWeek} diameter={36} size={24} color={colors.textSecondary} />

        <View style={{ alignItems: 'center' }}>
          <TouchableOpacity onPress={() => onSelectDate(new Date())} style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 24, color: colors.textPrimary, fontFamily: FontFamily.semibold }}>
              {headerTitle}
            </Text>
            <Text style={{ fontSize: 14, color: accentColor, fontFamily: FontFamily.medium }}>
              {headerDate}
            </Text>
          </TouchableOpacity>
        </View>

        <IconButton icon="chevron-forward" label="Next week" onPress={handleNextWeek} diameter={36} size={24} color={colors.textSecondary} />
      </View>

      <FlatList
        ref={flatListRef}
        data={weekIndexes}
        renderItem={renderWeek}
        keyExtractor={(item) => `week-${item}`}
        horizontal
        pagingEnabled
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={BASE_WEEK_INDEX}
        getItemLayout={getItemLayout}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollToIndexFailed={onScrollToIndexFailed}
        maxToRenderPerBatch={3}
        initialNumToRender={3}
        windowSize={5}
        removeClippedSubviews
      />
    </View>
  );
};
