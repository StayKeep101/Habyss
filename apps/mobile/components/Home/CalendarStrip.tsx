import { FontFamily } from '@/theme/designSystem';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, useWindowDimensions, ListRenderItemInfo } from 'react-native';
import { IconButton } from '@/components/ui/IconButton';
import Animated, { interpolate, runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { AnimatedCircle, useProgress } from '@/components/ui/Motion';
import { DURATION, EASE, timingFor } from '@/theme/motion';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { monthGrid } from '@/lib/monthGrid';
import { textOn } from '@/theme/tokens';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import Svg, { Circle } from 'react-native-svg';
import { useWeekStart } from '@/hooks/useWeekStart';
import { afterPaint } from '@/lib/afterPaint';

interface CalendarStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  completionData?: Record<string, { completed: number; total: number }>;
  /** Days with a task's deadline, by date key: a dot under the day. */
  dayMarks?: Record<string, DayMarks>;
}

export interface DayMarks { deadline?: boolean }

interface DateItem {
  dayName: string;
  dayNumber: number;
  fullDate: Date;
  id: string;
  progress: number;
  /** The month's short name on its first day, where a week runs into a new month. */
  monthMark?: string;
  marks?: DayMarks;
}

/** Short weekday names, Sunday first: read from a list, not formatted on every draw. */
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

  // The day's ring glides to its new share when something is ticked, on the UI
  // thread, rather than jumping (components/ui/Motion.tsx useProgress).
  const filled = useProgress(item.progress);
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - filled.get()) }));

  return (
    <View style={{ width, alignItems: 'center', justifyContent: 'center' }}>
      <TouchableOpacity
        onPress={() => onSelect(item.fullDate)}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${item.fullDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}${item.marks?.deadline ? ', a task deadline' : ''}`}
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
              <AnimatedCircle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={selected ? (isLight ? 'black' : 'white') : accentColor}
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={`${circumference} ${circumference}`}
                animatedProps={ringProps}
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
        </View>

        {/* At a glance: a yellow dot for a task's deadline, between the day and
            its name. Always the same small height, so every day's name stays
            on one line, close under its ring. */}
        <View style={{ height: DOT, marginTop: 4, marginBottom: 2, flexDirection: 'row', gap: 3 }}>
          {item.marks?.deadline ? <View style={{ width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: colors.warning }} /> : null}
        </View>

        {!month ? <Text
          style={{
            color: selected ? (isLight ? 'black' : 'white') : (item.monthMark ? accentColor : (isLight ? 'rgba(0,0,0,0.6)' : colors.textTertiary)),
            fontFamily: item.monthMark ? FontFamily.bold : FontFamily.medium,
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

const DOT = 5;
const DateButton = React.memo(DateButtonComponent, (a, b) =>
  a.month === b.month && a.selected === b.selected && a.width === b.width && a.colors === b.colors &&
  a.accentColor === b.accentColor && a.onSelect === b.onSelect && a.isLight === b.isLight &&
  a.item.id === b.item.id && a.item.progress === b.item.progress &&
  a.item.marks === b.item.marks);
const EMPTY_DATA: Record<string, never> = {};
/** One row of the month: a day's ring and number. */
const MONTH_ROW = 57;

/**
 * One month's page: its grid worked out once, and drawn again only when what
 * it shows changes (the chosen day in it, a day's progress, the colours).
 */
const MonthPage = React.memo(function MonthPage({ monthKey, startsMonday, width, itemWidth, selectedKey, completionData, dayMarks, onSelect, colors, accentColor, isLight, drop }: {
  monthKey: string; startsMonday: boolean; width: number; itemWidth: number; selectedKey: string | null;
  /** 0 → 1 as the month opens: its rows unfold out of the chosen week. */
  drop: SharedValue<number>;
  completionData: Record<string, { completed: number; total: number }>; dayMarks: Record<string, DayMarks>;
  onSelect: (date: Date) => void; colors: any; accentColor: string; isLight: boolean;
}) {
  const rows = useMemo(() => monthGrid(monthKey, startsMonday), [monthKey, startsMonday]);
  // The row holding the chosen day: the week you were on, which the others unfold from.
  const home = selectedKey ? rows.findIndex(row => row.includes(selectedKey)) : -1;
  return (
    <View style={{ width }}>
      {rows.map((row, rowIndex) => <MonthRow key={rowIndex} row={rowIndex} home={home} drop={drop}>
        {row.map((key, column) => key ? <DateButton month key={key} selected={key === selectedKey} onSelect={onSelect} width={itemWidth} colors={colors} accentColor={accentColor} isLight={isLight}
          item={{ id: key, fullDate: new Date(`${key}T12:00:00`), dayNumber: Number(key.slice(8)), dayName: '',
            progress: completionData[key]?.total ? completionData[key].completed / completionData[key].total : 0, marks: dayMarks[key] }} /> : <View key={column} style={{ width: itemWidth }} />)}
      </MonthRow>)}
    </View>
  );
});

/**
 * One week of the month. Opening, the week you were on slides from where the
 * strip shows it to its place in the month while the others unfold out of it,
 * above and below; closing folds them back into it. Moved, not laid out again.
 */
function MonthRow({ row, home, drop, children }: { row: number; home: number; drop: SharedValue<number>; children: React.ReactNode }) {
  const fold = useAnimatedStyle(() => {
    if (home < 0) return { opacity: 1, transform: [{ translateY: 0 }] };
    const d = drop.get();
    return {
      opacity: row === home ? 1 : interpolate(d, [0.15, 0.85], [0, 1], 'clamp'),
      transform: [{ translateY: (1 - d) * -row * MONTH_ROW }],
    };
  });
  return <Animated.View style={[{ flexDirection: 'row', zIndex: row === home ? 1 : 0 }, fold]}>{children}</Animated.View>;
}
/** The week row's height. */
const WEEK_HEIGHT = 74;
/** How much of the open the week takes to hand over to the month's row. */
const HANDOVER = 0.2;
/** Opening and closing the month: the app's emphasis beat, eased in and out (theme/motion.ts). */
const DROP = timingFor(DURATION.emphasis, EASE.move);

export const CalendarStrip: React.FC<CalendarStripProps> = ({
  selectedDate,
  onSelectDate,
  completionData = EMPTY_DATA,
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
  // `expanded` is where it is going, set the moment it starts: the header and
  // the arrows answer at once, and the resting sizes below are drawn from it.
  const [expanded, setExpanded] = useState(false);
  const drop = useSharedValue(0);
  // The month is built once the strip has settled, out of sight, and then kept:
  // opening only fades it in, instead of drawing a hundred rings on that frame.
  const [monthReady, setMonthReady] = useState(false);
  useEffect(() => { const later = afterPaint(() => setMonthReady(true), 1500); return later.cancel; }, []);
  const open = useCallback((next: boolean) => {
    if (next) setMonthReady(true);
    setExpanded(next);
    drop.set(withTiming(next ? 1 : 0, DROP));
  }, [drop]);
  // Built once: a new gesture on every draw re-attaches the handler each time.
  const expandGesture = useMemo(() => Gesture.Pan().activeOffsetY([-24, 24]).failOffsetX([-20, 20])
    .onEnd(event => {
      if (event.translationY > 24) runOnJS(open)(true);
      else if (event.translationY < -24) runOnJS(open)(false);
    }), [open]);
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
  /** Where the arrows are taking the selection, ahead of the next draw. */
  const aimed = useRef(selectedDate);
  useEffect(() => { aimed.current = selectedDate; }, [selectedDate]);
  /** When the arrows last moved the lists: a scroll ending soon after is theirs, not a swipe. */
  const jumping = useRef(0);
  const ownScroll = () => Date.now() - jumping.current < 600;
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

      return {
        dayName: WEEKDAYS[date.getDay()],
        dayNumber: date.getDate(),
        fullDate: date,
        id: dateKey,
        progress: dayData && dayData.total > 0 ? dayData.completed / dayData.total : 0,
        monthMark: date.getDate() === 1 ? date.toLocaleDateString(undefined, { month: 'short' }) : undefined,
        marks: dayMarks[dateKey],
      };
    });
  }, [completionData, getWeekStartForIndex, dayMarks]);

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
    if (ownScroll()) return;
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

  /**
   * The arrows. Tapped fast, each tap starts from where the last tap was going,
   * not from the day the screen last drew (that gave two taps the same week and
   * a strip that went back and forth), and the lists' own jumps are not taken
   * for swipes for a moment after (`jumping`).
   */
  const navigate = (direction: number) => {
    const from = aimed.current;
    let next: Date;
    if (!expanded) next = addDays(from, direction * 7);
    else {
      next = new Date(from.getFullYear(), from.getMonth() + direction, 1);
      const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(from.getDate(), last));
    }
    aimed.current = next;
    jumping.current = Date.now();
    onSelectDate(next);
  };
  const monthIndex = (date: Date) => BASE_WEEK_INDEX + (date.getFullYear() - today.getFullYear()) * 12 + date.getMonth() - today.getMonth();
  const monthAt = (index: number) => new Date(today.getFullYear(), today.getMonth() + index - BASE_WEEK_INDEX, 1);
  const selectedKey = toDateKey(selectedDate);
  const shownMonth = monthIndex(selectedDate);
  // The month list follows the chosen day even while it is out of sight, so it opens on the right page.
  useEffect(() => {
    if (monthReady) monthListRef.current?.scrollToIndex({ index: shownMonth, animated: false });
  }, [monthReady, shownMonth]);
  // A day picked in the month: chosen, and the month folds back into its week.
  const pickFromMonth = useCallback((date: Date) => { onSelectDate(date); open(false); }, [onSelectDate, open]);
  const renderMonth = useCallback(({ item: index }: ListRenderItemInfo<number>) => {
    const monthKey = toDateKey(new Date(today.getFullYear(), today.getMonth() + index - BASE_WEEK_INDEX, 1));
    return (
      <MonthPage monthKey={monthKey} startsMonday={startsMonday} width={pageWidth} itemWidth={itemWidth}
        // Only the month holding the chosen day hears about it, so choosing redraws one page.
        selectedKey={selectedKey.slice(0, 7) === monthKey.slice(0, 7) ? selectedKey : null}
        completionData={completionData} dayMarks={dayMarks}
        onSelect={pickFromMonth} colors={colors} accentColor={accentColor} isLight={isLight} drop={drop} />
    );
  }, [today, startsMonday, pageWidth, itemWidth, selectedKey, completionData, dayMarks, pickFromMonth, colors, accentColor, isLight, drop]);
  const monthHeight = useMemo(() => monthGrid(selectedKey, startsMonday).length * MONTH_ROW, [selectedKey, startsMonday]);
  // Worked out here: worklets only read numbers.
  const weekHeight = WEEK_HEIGHT;
  const body = useAnimatedStyle(() => ({ height: interpolate(drop.get(), [0, 1], [weekHeight, monthHeight]) }));
  // The week hands over to its own row in the month in the first moment (the
  // same days in the same places, so the swap is not seen); the rest is the unfold.
  const monthStyle = useAnimatedStyle(() => ({ opacity: interpolate(drop.get(), [0, HANDOVER], [0, 1], 'clamp') }));
  const weekStyle = useAnimatedStyle(() => ({ opacity: interpolate(drop.get(), [0, HANDOVER], [1, 0], 'clamp') }));
  // Each view's resting look, under its animation: if a redraw over the strip
  // (a sheet opening from the +) ever drops the animated values, it still
  // shows the right month or week at the right size, never an empty block.
  const restBody = { height: expanded ? monthHeight : weekHeight };
  const restMonth = { opacity: expanded ? 1 : 0 };
  const restWeek = { opacity: expanded ? 0 : 1 };
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

      <Animated.View style={[{ overflow: 'hidden' }, restBody, body]}>
      {monthReady ? <Animated.View pointerEvents={expanded ? 'auto' : 'none'} style={[{ position: 'absolute', top: 0, left: 0, right: 0 }, restMonth, monthStyle]}
        accessibilityElementsHidden={!expanded} importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}><FlatList
        key={`month:${Math.round(pageWidth)}:${startsMonday}`}
        ref={monthListRef} data={weekIndexes} renderItem={renderMonth}
        keyExtractor={item => `month-${item}`} horizontal pagingEnabled decelerationRate="fast"
        showsHorizontalScrollIndicator={false} initialScrollIndex={shownMonth}
        getItemLayout={getItemLayout} initialNumToRender={3} maxToRenderPerBatch={3} windowSize={3}
        onMomentumScrollEnd={event => {
          if (ownScroll()) return;
          const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
          if (index === shownMonth) return;
          const next = monthAt(index);
          next.setDate(Math.min(selectedDate.getDate(), new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
          onSelectDate(next);
        }}
      /></Animated.View> : null}
      <Animated.View pointerEvents={expanded ? 'none' : 'auto'} style={[restWeek, weekStyle]}
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
