import { FontFamily } from '@/theme/designSystem';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Dimensions, ListRenderItemInfo } from 'react-native';
import { IconButton } from '@/components/ui/IconButton';
import { useAnimatedProps } from 'react-native-reanimated';
import { textOn } from '@/theme/tokens';
import { AnimatedCircle, useProgress } from '@/components/ui/Motion';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import Svg, { Circle } from 'react-native-svg';
import { useWeekStart } from '@/hooks/useWeekStart';

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
  /** The month's short name on its first day, where a week runs into a new month. */
  monthMark?: string;
  isGoalDeadline?: boolean;
  goalColor?: string;
}

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

/** The first day of the week holding `date`: Sunday or Monday, as Settings → Week starts says. */
const getStartOfWeek = (date: Date, startsMonday = false) => {
  const day = stripTime(date);
  return addDays(day, -(startsMonday ? (day.getDay() + 6) % 7 : day.getDay()));
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
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${item.fullDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}${isDeadline ? ', goal deadline' : ''}`}
        style={{ width, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' }}
      >
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
          <View style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
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
                stroke={selected ? (isLight ? 'black' : 'white') : accentColor}
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={`${circumference} ${circumference}`}
                animatedProps={arc}
                strokeLinecap="round"
              />
            </Svg>
          </View>

          <View
            style={{
              width: size - 8,
              height: size - 8,
              borderRadius: (size - 8) / 2,
              backgroundColor: selected ? accentColor : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: selected ? textOn(accentColor) : (isLight ? 'black' : colors.textSecondary), fontSize: 14, fontFamily: FontFamily.bold }}>
              {item.dayNumber}
            </Text>
          </View>
          {isDeadline ? <DeadlineFlag color={deadlineColor} cutout={colors.background} /> : null}
        </View>

        <Text
          style={{
            color: selected ? (isLight ? 'black' : 'white') : (isDeadline ? deadlineColor : item.monthMark ? accentColor : (isLight ? 'rgba(0,0,0,0.6)' : colors.textTertiary)),
            fontFamily: isDeadline || item.monthMark ? FontFamily.bold : FontFamily.medium,
            fontSize: 12,
          }}
        >
          {/* A new month: its name in place of the weekday (Nov under the 1st),
              inside the strip where nothing can cut it off. */}
          {item.monthMark ?? item.dayName}
        </Text>

      </TouchableOpacity>
    </View>
  );
};

DateButtonComponent.displayName = 'DateButton';

/**
 * A goal's finish day: the day keeps its own ring and number, and a small
 * flag in the goal's colour sits on the bottom of the ring, cut out from the
 * page so it reads as a mark on the day rather than a second selected day.
 */
const DeadlineFlag = ({ color, cutout }: { color: string; cutout: string }) => (
  <View pointerEvents="none" style={{
    position: 'absolute', bottom: -7, width: 20, height: 20, borderRadius: 10, borderWidth: 2.5, borderColor: cutout,
    backgroundColor: color, alignItems: 'center', justifyContent: 'center',
  }}>
    <Ionicons name="flag" filled size={9} color={textOn(color)} />
  </View>
);

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
  // A week is as wide as the strip itself, measured: on an iPad, beside the
  // rail, in Split View or on a foldable it is not the screen's width, and it
  // changes when the window does.
  const [pageWidth, setPageWidth] = useState(() => Dimensions.get('window').width);
  const itemWidth = pageWidth / 7;

  const today = useMemo(() => stripTime(new Date()), []);
  const startsMonday = useWeekStart() === 'monday';
  const baseWeekStart = useMemo(() => getStartOfWeek(today, startsMonday), [today, startsMonday]);
  const weekIndexes = useMemo(() => Array.from({ length: TOTAL_WEEKS }, (_, index) => index), []);

  const getWeekStartForIndex = useCallback((index: number) => {
    return addDays(baseWeekStart, (index - BASE_WEEK_INDEX) * 7);
  }, [baseWeekStart]);

  const getWeekIndexForDate = useCallback((date: Date) => {
    const selectedWeekStart = getStartOfWeek(date, startsMonday);
    const diffMs = stripTime(selectedWeekStart).getTime() - baseWeekStart.getTime();
    const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
    return BASE_WEEK_INDEX + diffWeeks;
  }, [baseWeekStart, startsMonday]);

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
        monthMark: date.getDate() === 1 ? date.toLocaleDateString(undefined, { month: 'short' }) : undefined,
        isGoalDeadline: !!deadlineInfo,
        goalColor: deadlineInfo?.color,
      };
    });
  }, [completionData, getWeekStartForIndex, goalDeadlines]);

  const renderWeek = useCallback(({ item: weekIndex }: ListRenderItemInfo<number>) => {
    const weekItems = buildWeekItems(weekIndex);

    return (
      <View style={{ width: pageWidth, flexDirection: 'row' }}>
        {weekItems.map((item) => {
          const selected = toDateKey(item.fullDate) === toDateKey(selectedDate);

          return (
            <DateButton
              key={item.id}
              item={item}
              selected={selected}
              onSelect={onSelectDate}
              width={itemWidth}
              colors={colors}
              accentColor={accentColor}
              isLight={isLight}
            />
          );
        })}
      </View>
    );
  }, [accentColor, buildWeekItems, colors, isLight, onSelectDate, selectedDate, pageWidth, itemWidth]);

  const getItemLayout = useCallback((_: ArrayLike<number> | null | undefined, index: number) => ({
    length: pageWidth,
    offset: pageWidth * index,
    index,
  }), [pageWidth]);

  /** A swipe landed on a week: select the same weekday there, every time. */
  const handleScrollEnd = useCallback((event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const weekIndex = Math.round(offsetX / pageWidth);
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
  }, [getWeekStartForIndex, getWeekIndexForDate, onSelectDate, selectedDate, pageWidth]);

  const onScrollToIndexFailed = useCallback((info: { index: number }) => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToOffset({
        offset: info.index * pageWidth,
        animated: false,
      });
    });
  }, [pageWidth]);

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
    <View style={{ paddingTop: 8, paddingBottom: 4, backgroundColor: 'transparent' }}
      onLayout={event => { const next = Math.round(event.nativeEvent.layout.width); if (next && next !== Math.round(pageWidth)) setPageWidth(next); }}>
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
        // A new width starts the list again at the week on screen.
        key={Math.round(pageWidth)}
        ref={flatListRef}
        data={weekIndexes}
        renderItem={renderWeek}
        keyExtractor={(item) => `week-${item}`}
        horizontal
        pagingEnabled
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={shownWeek.current}
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
