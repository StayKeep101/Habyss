import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Dimensions, ListRenderItemInfo } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
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

const DateButton = React.memo(({
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
  const progressOffset = circumference - (item.progress * circumference);

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
          {isDeadline ? (
            <View
              style={{
                position: 'absolute',
                width: size + 6,
                height: size + 6,
                borderRadius: (size + 6) / 2,
                backgroundColor: deadlineColor + '30',
                borderWidth: 1,
                borderColor: deadlineColor,
                zIndex: -1,
              }}
            />
          ) : null}

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
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={selected ? (isLight ? 'black' : 'white') : (isDeadline ? deadlineColor : accentColor)}
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={progressOffset}
                strokeLinecap="round"
              />
            </Svg>
          </View>

          <View
            style={{
              width: size - 8,
              height: size - 8,
              borderRadius: (size - 8) / 2,
              backgroundColor: selected ? (isDeadline ? deadlineColor : accentColor) : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isDeadline && !selected ? (
              <Ionicons name="flag" size={14} color={deadlineColor} />
            ) : (
              <Text style={{ color: selected ? 'white' : (isLight ? 'black' : colors.textSecondary), fontSize: 14, fontWeight: '700' }}>
                {item.dayNumber}
              </Text>
            )}
          </View>
        </View>

        <Text
          style={{
            color: selected ? (isLight ? 'black' : 'white') : (isDeadline ? deadlineColor : (isLight ? 'rgba(0,0,0,0.6)' : colors.textTertiary)),
            fontWeight: isDeadline ? '700' : '500',
            fontSize: 12,
          }}
        >
          {item.dayName}
        </Text>

        {isDeadline ? (
          <View style={{ position: 'absolute', bottom: -4, width: 4, height: 4, borderRadius: 2, backgroundColor: deadlineColor }} />
        ) : null}
      </TouchableOpacity>
    </View>
  );
});

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
  const isProgrammaticScroll = useRef(false);

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

  useEffect(() => {
    const targetIndex = getWeekIndexForDate(selectedDate);
    if (!flatListRef.current || targetIndex < 0 || targetIndex >= TOTAL_WEEKS) return;

    isProgrammaticScroll.current = true;
    flatListRef.current.scrollToIndex({
      index: targetIndex,
      animated: true,
    });
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

  const handleScrollEnd = useCallback((event: any) => {
    if (isProgrammaticScroll.current) {
      isProgrammaticScroll.current = false;
      return;
    }

    const offsetX = event.nativeEvent.contentOffset.x;
    const weekIndex = Math.round(offsetX / SCREEN_WIDTH);
    if (weekIndex < 0 || weekIndex >= TOTAL_WEEKS) return;

    const targetWeekStart = getWeekStartForIndex(weekIndex);
    const nextDate = addDays(targetWeekStart, selectedDate.getDay());

    if (toDateKey(nextDate) !== toDateKey(selectedDate)) {
      onSelectDate(nextDate);
    }
  }, [getWeekStartForIndex, onSelectDate, selectedDate]);

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
        <TouchableOpacity onPress={handlePrevWeek} style={{ padding: 8 }}>
          <Ionicons name="chevron-back" size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        <View style={{ alignItems: 'center' }}>
          <TouchableOpacity onPress={() => onSelectDate(new Date())} style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 24, color: colors.textPrimary, fontFamily: 'Lexend_600SemiBold' }}>
              {headerTitle}
            </Text>
            <Text style={{ fontSize: 14, color: colors.primary, fontFamily: 'Lexend_500Medium' }}>
              {headerDate}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={handleNextWeek} style={{ padding: 8 }}>
          <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
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
