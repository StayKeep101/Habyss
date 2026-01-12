import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import Svg, { Circle } from 'react-native-svg';

interface CalendarStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  completionData?: Record<string, { completed: number; total: number }>; // dateStr -> completion info
}

interface DateItem {
  dayName: string;
  dayNumber: number;
  fullDate: Date;
  id: string;
  progress: number; // 0 to 1
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_WIDTH = SCREEN_WIDTH / 7;

const DateButton = React.memo(({ item, selected, isToday, onSelect, width, colors, accentColor, isLight }: any) => {
  const size = 34;
  const strokeWidth = 3.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progressOffset = circumference - (item.progress * circumference);

  const trackColor = isLight
    ? (selected ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.08)')
    : (selected ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)');

  // Special appearance for goal deadlines
  const isDeadline = item.isGoalDeadline;
  const deadlineColor = item.goalColor || accentColor;

  return (
    <View style={{ width, alignItems: 'center', justifyContent: 'center' }}>
      <TouchableOpacity
        onPress={() => onSelect(item.fullDate)}
        className="items-center justify-center"
        style={{ width: width, paddingVertical: 6 }}
      >
        {/* Circle Container */}
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>

          {/* Special Glow/Ring for Deadline */}
          {isDeadline && (
            <View style={{
              position: 'absolute',
              width: size + 6,
              height: size + 6,
              borderRadius: (size + 6) / 2,
              backgroundColor: deadlineColor + '30', // Glow
              borderWidth: 1,
              borderColor: deadlineColor,
              zIndex: -1
            }} />
          )}

          {/* Progress Ring */}
          <View style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
            <Svg width={size} height={size}>
              {/* Background Track */}
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={trackColor}
                strokeWidth={strokeWidth}
                fill="transparent"
              />
              {/* Progress Arc */}
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

          {/* Inner Circle (Solid if selected, else transparent or subtle) */}
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
              <Text
                className="text-sm font-inter-bold"
                style={{ color: selected ? 'white' : (isLight ? 'black' : colors.textSecondary) }}
              >
                {item.dayNumber}
              </Text>
            )}
          </View>
        </View>

        {/* Day Name */}
        <Text
          className="text-xs font-inter-medium"
          style={{
            color: selected ? (isLight ? 'black' : 'white') : (isDeadline ? deadlineColor : (isLight ? 'rgba(0,0,0,0.6)' : colors.textTertiary)),
            fontWeight: isDeadline ? '700' : '500'
          }}
        >
          {item.dayName}
        </Text>

        {/* Deadline Dot Indicator below name */}
        {isDeadline && (
          <View style={{ position: 'absolute', bottom: -4, width: 4, height: 4, borderRadius: 2, backgroundColor: deadlineColor }} />
        )}
      </TouchableOpacity>
    </View>
  );
});

interface CalendarStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  completionData?: Record<string, { completed: number; total: number }>; // dateStr -> completion info
  goalDeadlines?: Record<string, { count: number; color: string }>; // dateStr -> deadline info
}

interface DateItem {
  dayName: string;
  dayNumber: number;
  fullDate: Date;
  id: string;
  progress: number; // 0 to 1
  isGoalDeadline?: boolean;
  goalColor?: string;
}

// ... DateButton code (uses ITEM_WIDTH passed as prop or from closure if defined above, waiting to verify if DateButton is defined after the first declaration)
// Actually DateButton is defined AFTER the first declaration.
// The second declaration was added by me in the previous turn inside the file? 
// No, the previous tool call output showed I replaced lines 133-147 with a block that included new interfaces AND the variable declarations again.
// The file ALREADY had them at line 23.
// So I should remove them from the new block I inserted.

export const CalendarStrip: React.FC<CalendarStripProps> = ({ selectedDate, onSelectDate, completionData = {}, goalDeadlines = {} }) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const isLight = theme === 'light';
  const { primary: accentColor } = useAccentGradient();
  const flatListRef = useRef<FlatList>(null);

  // Generate dates for 100 weeks instead of 104 weeks (huge memory savings!)
  const dates = useMemo(() => {
    const d: DateItem[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Align to Sunday 100 weeks ago (approx 2 years)
    const dayOfWeek = today.getDay();
    const startOffset = (100 * 7) + dayOfWeek;

    const startDate = new Date(today);
    startDate.setDate(today.getDate() - startOffset);

    // Generate 200 weeks total (approx 4 years)
    const totalDays = 200 * 7;

    for (let i = 0; i < totalDays; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);

      // Get completion progress
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const dayData = completionData[dateStr];
      const progress = dayData && dayData.total > 0 ? dayData.completed / dayData.total : 0;

      const deadlineInfo = goalDeadlines[dateStr];

      d.push({
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
        fullDate: date,
        id: dateStr, // Use dateStr instead of toISOString() - simpler
        progress,
        isGoalDeadline: !!deadlineInfo,
        goalColor: deadlineInfo?.color
      });
    }
    return d;
  }, [completionData, goalDeadlines]);

  // Find index of selected date
  const getIndexForDate = useCallback((date: Date) => {
    const dateStr = date.toDateString();
    return dates.findIndex(d => d.fullDate.toDateString() === dateStr);
  }, [dates]);

  const initialIndex = useMemo(() => {
    // Find today's index
    const today = new Date();
    const idx = dates.findIndex(d => d.fullDate.toDateString() === today.toDateString());

    // Scroll to the start of the week containing today
    if (idx !== -1) {
      return idx - (idx % 7);
    }
    return 0;
  }, [dates]);

  const isProgrammaticScroll = useRef(false);

  // Scroll to selected date's week when it changes
  useEffect(() => {
    const index = getIndexForDate(selectedDate);
    if (index !== -1 && flatListRef.current) {
      // Scroll to the start of the week containing this date
      const weekStartIndex = index - (index % 7);

      isProgrammaticScroll.current = true;
      flatListRef.current.scrollToIndex({
        index: weekStartIndex,
        animated: true
      });
    }
  }, [selectedDate, getIndexForDate]);

  const renderItem = useCallback(({ item }: { item: DateItem }) => {
    const selected = item.fullDate.getDate() === selectedDate.getDate() &&
      item.fullDate.getMonth() === selectedDate.getMonth() &&
      item.fullDate.getFullYear() === selectedDate.getFullYear();

    const isToday = item.fullDate.getDate() === new Date().getDate() &&
      item.fullDate.getMonth() === new Date().getMonth() &&
      item.fullDate.getFullYear() === new Date().getFullYear();

    return (
      <DateButton
        item={item}
        selected={selected}
        isToday={isToday}
        onSelect={onSelectDate}
        width={ITEM_WIDTH}
        colors={colors}
        accentColor={accentColor}
        isLight={isLight}
      />
    );
  }, [selectedDate, colors, onSelectDate, accentColor, isLight]);

  const getItemLayout = (_: any, index: number) => ({
    length: ITEM_WIDTH,
    offset: ITEM_WIDTH * index,
    index,
  });

  // Handle scroll to maintain same day of week - called on both drag end and momentum end
  const handleScrollEnd = useCallback((event: any) => {
    if (isProgrammaticScroll.current) {
      isProgrammaticScroll.current = false;
      return;
    }

    const offsetX = event.nativeEvent.contentOffset.x;
    const weekIndex = Math.round(offsetX / SCREEN_WIDTH);
    const firstDayIndex = weekIndex * 7;

    // Ensure valid index
    if (firstDayIndex >= 0 && firstDayIndex < dates.length) {
      const currentDayOfWeek = selectedDate.getDay();
      // Calculate target date: first day of week + day offset
      const targetDate = new Date(dates[firstDayIndex].fullDate);
      targetDate.setDate(targetDate.getDate() + currentDayOfWeek);

      // Only update if date actually changed
      if (targetDate.toDateString() !== selectedDate.toDateString()) {
        onSelectDate(targetDate);
      }
    }
  }, [dates, selectedDate, onSelectDate]);

  const isTodaySelected = useMemo(() => {
    const today = new Date();
    return selectedDate.getDate() === today.getDate() &&
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getFullYear() === today.getFullYear();
  }, [selectedDate]);

  const headerTitle = isTodaySelected ? "Today" : selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
  const headerDate = selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const handlePrevWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() - 7);
    onSelectDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + 7);
    onSelectDate(newDate);
  };

  return (
    <View className="pt-2 pb-1" style={{ backgroundColor: 'transparent' }}>
      {/* Header */}
      <View className="px-6 mb-2 flex-row items-center justify-between">
        <TouchableOpacity onPress={handlePrevWeek} className="p-2">
          <Ionicons name="chevron-back" size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        <View className="items-center">
          <TouchableOpacity onPress={() => onSelectDate(new Date())} className="items-center">
            <Text className="font-display mb-0" style={{ fontSize: 24, color: colors.textPrimary }}>
              {headerTitle}
            </Text>
            <Text className="text-sm font-inter-medium" style={{ color: colors.primary }}>
              {headerDate}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={handleNextWeek} className="p-2">
          <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={dates}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 0 }}
        getItemLayout={getItemLayout}
        initialScrollIndex={initialIndex}
        maxToRenderPerBatch={14}
        windowSize={5}
        pagingEnabled
        decelerationRate="fast" // Snap effect
        snapToInterval={SCREEN_WIDTH}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollToIndexFailed={(info) => {
          const wait = new Promise(resolve => setTimeout(resolve, 500));
          wait.then(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
          });
        }}
      />
    </View>
  );
};
