import { FontFamily } from '@/theme/designSystem';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, useWindowDimensions, ListRenderItemInfo } from 'react-native';
import { IconButton } from '@/components/ui/IconButton';
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { DURATION, EASE, timingFor } from '@/theme/motion';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { monthGrid } from '@/lib/goalPlanPeriod';
import { textOn } from '@/theme/tokens';
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
  /** The goals due on each day, by date key. */
  goalDeadlines?: Record<string, DeadlineGoal[]>;
  /** Days with a task's deadline or a milestone due, by date key: a dot each under the day. */
  dayMarks?: Record<string, DayMarks>;
}

export interface DayMarks { deadline?: boolean; milestone?: boolean }

interface DeadlineGoal { color: string; icon?: string; name: string }

interface DateItem {
  dayName: string;
  dayNumber: number;
  fullDate: Date;
  id: string;
  progress: number;
  /** The month's short name on its first day, where a week runs into a new month. */
  monthMark?: string;
  /** The goals due that day: each one's own icon, in its colour, on the ring. */
  deadlines?: DeadlineGoal[];
  marks?: DayMarks;
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
  month = false,
}: {
  item: DateItem;
  selected: boolean;
  onSelect: (date: Date) => void;
  width: number;
  colors: any;
  accentColor: string;
  isLight: boolean;
  month?: boolean;
}) => {
  const size = 34;
  const strokeWidth = 3.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  const trackColor = isLight
    ? (selected ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.08)')
    : (selected ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)');

  const deadlines = item.deadlines ?? [];
  const isDeadline = deadlines.length > 0;
  const deadlineColor = deadlines[0]?.color || accentColor;

  return (
    <View style={{ width, alignItems: 'center', justifyContent: 'center' }}>
      <TouchableOpacity
        onPress={() => onSelect(item.fullDate)}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${item.fullDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}${isDeadline ? `, ${deadlines.length === 1 ? 'deadline for' : `${deadlines.length} goal deadlines:`} ${deadlines.map(goal => goal.name).join(', ')}` : ''}${item.marks?.deadline ? ', a task deadline' : ''}${item.marks?.milestone ? ', a milestone due' : ''}`}
        style={{ width, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' }}
      >
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
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
                stroke={selected ? (isLight ? 'black' : 'white') : accentColor}
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={circumference * (1 - item.progress)}
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
          {isDeadline ? <DeadlineFlags goals={deadlines} cutout={colors.background} muted={colors.textSecondary} /> : null}
        </View>

        {/* At a glance: a yellow dot for a task's deadline, a white one for a
            milestone, between the day and its name; beside a goal's badge
            when the day has one. Always the same small height, so every
            day's name stays on one line, close under its ring. */}
        <View style={{ height: DOT, marginTop: 4, marginBottom: 2, flexDirection: 'row', gap: 3,
          ...(isDeadline ? { position: 'relative', left: deadlineSpan(deadlines.length) / 2 + 3 + DOT, top: -2 } : null) }}>
          {item.marks?.deadline ? <View style={{ width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: colors.warning }} /> : null}
          {item.marks?.milestone ? <View style={{ width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: colors.textPrimary }} /> : null}
        </View>

        {!month ? <Text
          style={{
            color: selected ? (isLight ? 'black' : 'white') : (isDeadline ? deadlineColor : item.monthMark ? accentColor : (isLight ? 'rgba(0,0,0,0.6)' : colors.textTertiary)),
            fontFamily: isDeadline || item.monthMark ? FontFamily.bold : FontFamily.medium,
            fontSize: 12,
          }}
        >
          {/* A new month: its name in place of the weekday (Nov under the 1st),
              inside the strip where nothing can cut it off. */}
          {item.monthMark ?? item.dayName}
        </Text> : null}

      </TouchableOpacity>
    </View>
  );
};

DateButtonComponent.displayName = 'DateButton';

const FLAG = 20;
const DOT = 5;
/** How far each badge sits from the one before it: they overlap by a third. */
const FLAG_STEP = 13;

/**
 * A goal's finish day: the day keeps its own ring and number, and a small
 * badge with the goal's own icon, in the goal's colour, sits on the bottom of
 * the ring, cut out from the page so it reads as a mark on the day rather
 * than a second selected day. Several goals due together sit side by side,
 * overlapping like a hand of cards; past three, the last says how many more.
 */
/** How wide the badges of this many goals are together. */
const deadlineSpan = (goals: number) => FLAG + (Math.min(goals, 3) - 1) * FLAG_STEP;

const DeadlineFlags = ({ goals, cutout, muted }: { goals: DeadlineGoal[]; cutout: string; muted: string }) => {
  const shown = goals.length > 3 ? goals.slice(0, 2) : goals;
  const more = goals.length - shown.length;
  const count = shown.length + (more ? 1 : 0);
  const span = deadlineSpan(count);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', bottom: -7, width: span, height: FLAG }}>
      {shown.map((goal, index) => (
        <View key={`${goal.name}-${index}`} style={{
          position: 'absolute', left: index * FLAG_STEP, zIndex: count - index,
          width: FLAG, height: FLAG, borderRadius: FLAG / 2, borderWidth: 2.5, borderColor: cutout,
          backgroundColor: goal.color, alignItems: 'center', justifyContent: 'center',
        }}>
          {/* The goal's own icon (a photo or a typed glyph falls back to the flag). */}
          <Ionicons name={goal.icon && !goal.icon.includes('/') && !goal.icon.startsWith('file:') ? goal.icon : 'flag'} filled size={9} color={textOn(goal.color)} />
        </View>
      ))}
      {more ? (
        <View style={{
          position: 'absolute', left: shown.length * FLAG_STEP, zIndex: 0,
          width: FLAG, height: FLAG, borderRadius: FLAG / 2, borderWidth: 2.5, borderColor: cutout,
          backgroundColor: muted, alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ color: cutout, fontSize: 11, lineHeight: 13, fontFamily: FontFamily.bold }}>{`+${more}`}</Text>
        </View>
      ) : null}
    </View>
  );
};

const DateButton = React.memo(DateButtonComponent, (a, b) =>
  a.month === b.month && a.selected === b.selected && a.width === b.width && a.colors === b.colors &&
  a.accentColor === b.accentColor && a.onSelect === b.onSelect && a.isLight === b.isLight &&
  a.item.id === b.item.id && a.item.progress === b.item.progress &&
  a.item.deadlines === b.item.deadlines && a.item.marks === b.item.marks);
const EMPTY_DATA: Record<string, never> = {};
/** The week row's height, and how far the month falls as it opens. */
const WEEK_HEIGHT = 74;
const DROP_FALL = 18;
/** Opening and closing the month: the app's emphasis beat, eased in and out (theme/motion.ts). */
const DROP = timingFor(DURATION.emphasis, EASE.move);

export const CalendarStrip: React.FC<CalendarStripProps> = ({
  selectedDate,
  onSelectDate,
  completionData = EMPTY_DATA,
  goalDeadlines = EMPTY_DATA,
  dayMarks = EMPTY_DATA,
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const isLight = theme === 'light';
  const { primary: accentColor } = useAccentGradient();
  const monthListRef = useRef<FlatList<number>>(null);
  const flatListRef = useRef<FlatList<number>>(null);
  // A week is as wide as the strip itself, measured: on an iPad, beside the
  // rail, in Split View or on a foldable it is not the screen's width, and it
  // changes when the window does.
  const { width } = useWindowDimensions();
  const [pageWidth, setPageWidth] = useState(width);
  // The month drops down out of the week and folds back up into it: only by swiping
  // (down to open, up to close), or from the grabber for VoiceOver. `drop` runs 0 → 1.
  const [expanded, setExpanded] = useState(false);
  const drop = useSharedValue(0);
  const open = useCallback((next: boolean) => {
    if (next) setExpanded(true);
    drop.set(withTiming(next ? 1 : 0, DROP, finished => { if (finished && !next) runOnJS(setExpanded)(false); }));
  }, [drop]);
  const expandGesture = Gesture.Pan().activeOffsetY([-24, 24]).failOffsetX([-20, 20])
    .onEnd(event => {
      if (event.translationY > 24) runOnJS(open)(true);
      else if (event.translationY < -24) runOnJS(open)(false);
    });
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
    flatListRef.current.scrollToIndex({ index: targetIndex, animated: false });
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
        deadlines: deadlineInfo,
        marks: dayMarks[dateKey],
      };
    });
  }, [completionData, getWeekStartForIndex, goalDeadlines, dayMarks]);

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
    const nextDate = addDays(targetWeekStart, startsMonday ? (selectedDate.getDay() + 6) % 7 : selectedDate.getDay());

    if (toDateKey(nextDate) !== toDateKey(selectedDate)) {
      onSelectDate(nextDate);
    }
  }, [getWeekStartForIndex, getWeekIndexForDate, onSelectDate, selectedDate, pageWidth, startsMonday]);

  const onScrollToIndexFailed = useCallback((info: { index: number }) => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToOffset({
        offset: info.index * pageWidth,
        animated: false,
      });
    });
  }, [pageWidth]);

  const isTodaySelected = toDateKey(selectedDate) === toDateKey(today);
  // The same shape in both views: the big line, and the small accent line under it.
  const headerTitle = expanded ? selectedDate.toLocaleDateString(undefined, { month: 'long' }) : isTodaySelected ? 'Today' : selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
  const headerDate = expanded ? String(selectedDate.getFullYear()) : selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const navigate = (direction: number) => {
    if (!expanded) { onSelectDate(addDays(selectedDate, direction * 7)); return; }
    const next = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + direction, 1);
    const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(selectedDate.getDate(), last));
    onSelectDate(next);
  };
  const monthIndex = (date: Date) => BASE_WEEK_INDEX + (date.getFullYear() - today.getFullYear()) * 12 + date.getMonth() - today.getMonth();
  const monthAt = (index: number) => new Date(today.getFullYear(), today.getMonth() + index - BASE_WEEK_INDEX, 1);
  useEffect(() => {
    if (expanded) monthListRef.current?.scrollToIndex({ index: monthIndex(selectedDate), animated: false });
    // Month pages use the same stable origin as weeks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, selectedDate]);
  const renderMonth = ({ item: index }: ListRenderItemInfo<number>) => (
    <View style={{ width: pageWidth }}>
      {monthGrid(toDateKey(monthAt(index)), startsMonday).map((row, rowIndex) => <View key={rowIndex} style={{ flexDirection: 'row' }}>
        {row.map((key, column) => key ? <DateButton month key={key} selected={key === toDateKey(selectedDate)} onSelect={pickFromMonth} width={itemWidth} colors={colors} accentColor={accentColor} isLight={isLight}
          item={{ id: key, fullDate: new Date(`${key}T12:00:00`), dayNumber: Number(key.slice(8)), dayName: '',
            progress: completionData[key]?.total ? completionData[key].completed / completionData[key].total : 0, deadlines: goalDeadlines[key], marks: dayMarks[key] }} /> : <View key={column} style={{ width: itemWidth }} />)}
      </View>)}
    </View>
  );
  const monthHeight = monthGrid(toDateKey(selectedDate), startsMonday).length * 57;
  // A day picked in the month: chosen, and the month folds back into its week.
  const pickFromMonth = useCallback((date: Date) => { onSelectDate(date); open(false); }, [onSelectDate, open]);
  // Worked out here: worklets only read numbers.
  const weekHeight = WEEK_HEIGHT;
  const body = useAnimatedStyle(() => ({ height: interpolate(drop.get(), [0, 1], [weekHeight, monthHeight]) }));
  // The month falls into place from just above, as the space opens under it.
  const monthStyle = useAnimatedStyle(() => ({ opacity: drop.get(), transform: [{ translateY: interpolate(drop.get(), [0, 1], [-DROP_FALL, 0]) }] }));
  const weekStyle = useAnimatedStyle(() => ({ opacity: 1 - drop.get() }));
  const handlePrevWeek = () => navigate(-1);
  const handleNextWeek = () => navigate(1);

  return (
    <GestureDetector gesture={expandGesture}><View style={{ paddingTop: 8, paddingBottom: 4, backgroundColor: 'transparent' }}
      onLayout={event => { const next = Math.round(event.nativeEvent.layout.width); if (next && next !== Math.round(pageWidth)) setPageWidth(next); }}>
      <View style={{ paddingHorizontal: 24, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon="chevron-back" label={expanded ? 'Previous month' : 'Previous week'} onPress={handlePrevWeek} diameter={36} size={24} color={colors.textSecondary} />

        <View style={{ alignItems: 'center' }}>
          {/* The title always brings you back: to today in the week, to this month in the month. */}
          <TouchableOpacity onPress={() => onSelectDate(new Date())} accessibilityRole="button"
            accessibilityLabel={`${headerTitle}, ${headerDate}`} accessibilityHint={expanded ? 'Go to this month' : 'Go to today'} style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 24, color: colors.textPrimary, fontFamily: FontFamily.semibold }}>
              {headerTitle}
            </Text>
            <Text style={{ fontSize: 14, color: accentColor, fontFamily: FontFamily.medium }}>{headerDate}</Text>
          </TouchableOpacity>
        </View>

        <IconButton icon="chevron-forward" label={expanded ? 'Next month' : 'Next week'} onPress={handleNextWeek} diameter={36} size={24} color={colors.textSecondary} />
      </View>

      <Animated.View style={[{ overflow: 'hidden' }, body]}>
      {expanded ? <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0 }, monthStyle]}><FlatList
        key={`month:${Math.round(pageWidth)}:${startsMonday}`}
        ref={monthListRef} data={weekIndexes} renderItem={renderMonth}
        keyExtractor={item => `month-${item}`} horizontal pagingEnabled decelerationRate="fast"
        showsHorizontalScrollIndicator={false} initialScrollIndex={monthIndex(selectedDate)}
        getItemLayout={getItemLayout} initialNumToRender={3} maxToRenderPerBatch={3} windowSize={3}
        onMomentumScrollEnd={event => {
          const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
          if (index === monthIndex(selectedDate)) return;
          const next = monthAt(index);
          next.setDate(Math.min(selectedDate.getDate(), new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
          onSelectDate(next);
        }}
      /></Animated.View> : null}
      <Animated.View pointerEvents={expanded ? 'none' : 'auto'} style={weekStyle}
        accessibilityElementsHidden={expanded} importantForAccessibility={expanded ? 'no-hide-descendants' : 'auto'}><FlatList
        // A new width starts the list again at the week on screen.
        key={`${Math.round(pageWidth)}:${startsMonday}`}
        ref={flatListRef}
        data={weekIndexes}
        renderItem={renderWeek}
        keyExtractor={(item) => `week-${item}`}
        horizontal
        pagingEnabled
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={getWeekIndexForDate(selectedDate)}
        getItemLayout={getItemLayout}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollToIndexFailed={onScrollToIndexFailed}
        maxToRenderPerBatch={3}
        initialNumToRender={3}
        windowSize={5}
        removeClippedSubviews
      /></Animated.View>
      </Animated.View>

      {/* The grabber: says the strip can be pulled down into the month, and lets VoiceOver do it. */}
      {/* Swiping is the way for a finger; this handle is not a button. VoiceOver can't swipe the strip, so it can open and close from here. */}
      <View accessible accessibilityRole="adjustable" accessibilityLabel="Month" accessibilityValue={{ text: expanded ? 'open' : 'closed' }}
        accessibilityHint="Swipe up or down to open or close the month"
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }, { name: 'activate' }]}
        onAccessibilityAction={event => {
          const name = event.nativeEvent.actionName;
          open(name === 'increment' ? true : name === 'decrement' ? false : !expanded);
        }}
        style={{ alignSelf: 'center', paddingVertical: 6 }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
      </View>
    </View></GestureDetector>
  );
};
