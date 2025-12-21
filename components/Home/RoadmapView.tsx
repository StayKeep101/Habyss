import React, { useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions, Animated, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Habit } from '@/lib/habits';

const { width } = Dimensions.get('window');

interface RoadmapViewProps {
  onDayPress: (day: any) => void;
  habits: Habit[];
  completedHabitsCount: number;
  totalHabitsCount: number;
}

export const RoadmapView: React.FC<RoadmapViewProps> = ({ 
  onDayPress, 
  habits, 
  completedHabitsCount, 
  totalHabitsCount 
}) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const scrollViewRef = useRef<ScrollView>(null);

  // Generate days (30 days future, today, 30 days past)
  const generateDays = () => {
    const days = [];
    const today = new Date();
    
    // Future days (upcoming days above) - Reversed order so today is at bottom
    for (let i = 10; i >= 1; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      days.push({
        day: -i,
        date,
        completed: false,
        isToday: false,
        isPast: false,
        icon: ['star', 'videocam', 'book', 'headset'][i % 4] as any,
      });
    }
    
    // Today
    days.push({
      day: 0,
      date: today,
      completed: completedHabitsCount > 0 && completedHabitsCount === totalHabitsCount,
      isToday: true,
      isPast: false,
      icon: 'star',
    });
    
    // Past days
    for (let i = 1; i <= 10; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        days.push({
          day: i,
          date,
          completed: Math.random() > 0.3, // Mock data for now
          isToday: false,
          isPast: true,
          icon: ['star', 'videocam', 'book', 'headset'][i % 4] as any,
        });
    }
    
    return days;
  };

  const days = generateDays();

  // Scroll to bottom initially to show today
  useEffect(() => {
     setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
     }, 100);
  }, []);

  const renderDayNode = (day: any, index: number) => {
    // Sine wave logic for horizontal position
    // Center is width/2. Amplitude is width * 0.35. Frequency depends on index.
    const xOffset = Math.sin(index * 0.8) * (width * 0.25); 
    
    // Styling
    const nodeSize = 70;
    const buttonColor = '#D946EF'; // Pink-500 equivalent
    const shadowColor = '#A21CAF'; // Pink-700 equivalent
    const iconColor = 'white';

    // Character position (Next to today)
    const showCharacter = day.isToday;

    const formatDate = (date: Date) => {
        if (day.isToday) return 'Today';
        return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
    };

    return (
      <View key={index} className="mb-6 relative items-center justify-center w-full">
        <View style={{ transform: [{ translateX: xOffset }] }}>
            
            {/* Character Illustration */}
            {showCharacter && (
                <View className="absolute right-[-100] top-[-20]">
                     {/* Placeholder for Character - Using a large emoji or icon for now if image not available */}
                     <View className="items-center">
                        <View className="bg-blue-400 p-2 rounded-full mb-1">
                             <Text className="text-white font-bold text-xs">Let's go!</Text>
                        </View>
                        <Ionicons name="person-circle" size={80} color="#60A5FA" />
                     </View>
                </View>
            )}

            {/* Date Label */}
            <View className="items-center mb-1">
                 <Text className="text-gray-400 font-bold text-xs uppercase tracking-wider">
                     {formatDate(day.date)}
                 </Text>
            </View>

            {/* 3D Button Node */}
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => onDayPress(day)}
                style={{
                    width: nodeSize,
                    height: nodeSize,
                    borderRadius: nodeSize / 2,
                    backgroundColor: day.isToday ? colors.success : buttonColor, // Green for today/completed, Pink for others
                    alignItems: 'center',
                    justifyContent: 'center',
                    // 3D Shadow Effect
                    borderBottomWidth: 6,
                    borderBottomColor: day.isToday ? '#15803d' : shadowColor, // Darker shade
                    marginBottom: 6, // Compensate for border
                }}
            >
                <Ionicons name={day.icon} size={32} color={iconColor} />
                
                {/* Stars below node (Decoration) */}
                <View className="absolute -bottom-8 flex-row space-x-1">
                    {[1,2,3].map(s => (
                        <Ionicons key={s} name="star" size={12} color={day.completed ? "#FACC15" : "#374151"} />
                    ))}
                </View>
            </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-[#111827]"> 
      {/* Dark background like the reference image */}
      
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{ paddingVertical: 60, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {days.map((day, index) => renderDayNode(day, index))}
      </ScrollView>

      {/* Floating 2025 Badge */}
      <View className="absolute bottom-8 left-6">
         <View className="items-center">
            <View className="bg-green-500 rounded-full p-1 mb-[-10] z-10 border-2 border-[#111827]">
                <Ionicons name="logo-android" size={30} color="white" />
            </View>
            <View className="bg-blue-400 px-4 py-1 rounded-xl border-2 border-[#111827]">
                <Text className="text-white font-bold text-lg">2025</Text>
            </View>
         </View>
      </View>

      {/* Floating Arrow Button */}
      <TouchableOpacity 
        className="absolute bottom-8 right-6 w-12 h-12 bg-[#1F2937] border-2 border-[#374151] rounded-xl items-center justify-center"
        onPress={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        <Ionicons name="arrow-down" size={24} color="#60A5FA" />
      </TouchableOpacity>
    </View>
  );
};
