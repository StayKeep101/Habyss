import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Dimensions } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface CalendarStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

interface DateItem {
  dayName: string;
  dayNumber: number;
  fullDate: Date;
  id: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_WIDTH = SCREEN_WIDTH / 7;

export const CalendarStrip: React.FC<CalendarStripProps> = ({ selectedDate, onSelectDate }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const flatListRef = useRef<FlatList>(null);
  
  // Generate a large range of dates aligned to weeks (starting Sunday)
  const dates = useMemo(() => {
    const d: DateItem[] = [];
    const today = new Date();
    today.setHours(0,0,0,0);
    
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
      d.push({
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
        fullDate: date,
        id: date.toISOString(),
      });
    }
    return d;
  }, []);

  // Find index of selected date
  const getIndexForDate = (date: Date) => {
    const dateStr = date.toDateString();
    return dates.findIndex(d => d.fullDate.toDateString() === dateStr);
  };

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

  // Scroll to selected date's week when it changes
  useEffect(() => {
    const index = getIndexForDate(selectedDate);
    if (index !== -1 && flatListRef.current) {
        // Scroll to the start of the week containing this date
        const weekStartIndex = index - (index % 7);
        
        flatListRef.current.scrollToIndex({
            index: weekStartIndex,
            animated: true
        });
    }
  }, [selectedDate]);

  const isSelected = (d1: Date, d2: Date) => {
    return d1.getDate() === d2.getDate() && 
           d1.getMonth() === d2.getMonth() && 
           d1.getFullYear() === d2.getFullYear();
  };

  const isTodayCheck = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() && 
           date.getFullYear() === today.getFullYear();
  };

  const renderItem = useCallback(({ item }: { item: DateItem }) => {
    const selected = isSelected(selectedDate, item.fullDate);
    const isToday = isTodayCheck(item.fullDate);
    return (
        <View style={{ width: ITEM_WIDTH, alignItems: 'center', justifyContent: 'center' }}>
            <TouchableOpacity
                onPress={() => onSelectDate(item.fullDate)}
                className="items-center justify-center rounded-2xl"
                style={{ 
                  width: ITEM_WIDTH - 6,
                  height: 85,
                  backgroundColor: selected ? '#9CB1D6' : colors.surfaceSecondary,
                  borderWidth: isToday ? 2 : 0,
                  borderColor: isToday ? (selected ? colors.primaryDark : colors.primary) : 'transparent'
                }}
            >
                <Text 
                  className="text-[10px] mb-2 font-bold uppercase tracking-wider"
                  style={{ color: selected ? colors.textPrimary : colors.textTertiary }}
                >
                  {item.dayName}
                </Text>
                <Text 
                  className="text-lg font-bold"
                  style={{ color: selected ? colors.textPrimary : colors.textPrimary }}
                >
                  {item.dayNumber}
                </Text>
            </TouchableOpacity>
        </View>
    );
  }, [selectedDate, colors, onSelectDate]);

  const getItemLayout = (_: any, index: number) => ({
    length: ITEM_WIDTH,
    offset: ITEM_WIDTH * index,
    index,
  });

  const onMomentumScrollEnd = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / ITEM_WIDTH);
    
    // The item at 'index' is the first visible item of the new page (week)
    if (index >= 0 && index < dates.length) {
       const firstItem = dates[index];
       const newWeekStart = firstItem.fullDate; // This should be a Sunday because of paging and data alignment
       
       // Calculate current selected day of week
       const currentDayOfWeek = selectedDate.getDay();
       
       // Calculate target date in the new week
       const targetDate = new Date(newWeekStart);
       targetDate.setDate(newWeekStart.getDate() + currentDayOfWeek);
       
       // Only trigger update if it's actually a different date
       if (targetDate.getTime() !== selectedDate.getTime()) {
           // We call onSelectDate to update the app state
           // We must ensure this doesn't cause a "double scroll" glitch
           // Since we just finished scrolling to this week, the useEffect might try to scroll again 
           // but it should calculate the same index (or close to it)
           onSelectDate(targetDate);
       }
    }
  };

  const monthLabel = useMemo(() => {
     return selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }, [selectedDate]);

  return (
    <View className="pt-8 pb-4" style={{ backgroundColor: colors.background }}>
      <View className="px-6 mb-2">
         <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>
            {monthLabel}
         </Text>
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
        decelerationRate="fast"
        snapToInterval={SCREEN_WIDTH}
        onMomentumScrollEnd={onMomentumScrollEnd}
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
