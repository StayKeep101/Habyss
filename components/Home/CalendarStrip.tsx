import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
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

const DateButton = React.memo(({ item, selected, isToday, onSelect, width, colors }: any) => {
  const size = 34;
  const strokeWidth = 3.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progressOffset = circumference - (item.progress * circumference);

  return (
    <View style={{ width, alignItems: 'center', justifyContent: 'center' }}>
      <TouchableOpacity
        onPress={() => onSelect(item.fullDate)}
        className="items-center justify-center"
        style={{ width: width, paddingVertical: 6 }}
      >
        {/* Circle Container */}
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>

          {/* Progress Ring */}
          <View style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
            <Svg width={size} height={size}>
              {/* Background Track */}
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={selected ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'}
                strokeWidth={strokeWidth}
                fill="transparent"
              />
              {/* Progress Arc */}
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={selected ? 'white' : colors.primary} // White if selected so it contrasts with the blue fill? Or just bolder?
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
              width: size - 8, // Smaller inner circle
              height: size - 8,
              borderRadius: (size - 8) / 2,
              backgroundColor: selected ? colors.primary : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              // Optional: Add a subtle fill for non-selected if needed, or keep transparent
            }}
          >
            <Text
              className="text-sm font-bold"
              style={{ color: selected ? 'white' : colors.textSecondary }}
            >
              {item.dayNumber}
            </Text>
          </View>
        </View>

        {/* Day Name */}
        <Text
          className="text-xs font-medium"
          style={{ color: selected ? 'white' : colors.textTertiary }}
        >
          {item.dayName}
        </Text>
      </TouchableOpacity>
    </View>
  );
});

export const CalendarStrip: React.FC<CalendarStripProps> = ({ selectedDate, onSelectDate, completionData = {} }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const flatListRef = useRef<FlatList>(null);

  // Generate a large range of dates aligned to weeks (starting Sunday)
  const dates = useMemo(() => {
    const d: DateItem[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Align to the Sunday 52 weeks ago
    const dayOfWeek = today.getDay(); // 0 (Sun) to 6 (Sat)
    const startOffset = (52 * 7) + dayOfWeek;

    const startDate = new Date(today);
    startDate.setDate(today.getDate() - startOffset);

    // Generate 104 weeks (approx 2 years)
    const totalDays = 104 * 7;

    for (let i = 0; i < totalDays; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);

      // Get actual completion progress from props (use local date format)
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const dayData = completionData[dateStr];
      const progress = dayData && dayData.total > 0 ? dayData.completed / dayData.total : 0;

      d.push({
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
        fullDate: date,
        id: date.toISOString(),
        progress,
      });
    }
    return d;
  }, [completionData]);

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
      />
    );
  }, [selectedDate, colors, onSelectDate]);

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
            <Text className="font-display mb-0" style={{ fontSize: 24, color: 'white' }}>
              {headerTitle}
            </Text>
            <Text className="text-sm font-inter-medium" style={{ color: '#AFC3E8' }}>
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
