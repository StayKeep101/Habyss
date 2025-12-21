import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Habit } from '@/lib/habits';

interface HabitDetailModalProps {
  visible: boolean;
  onClose: () => void;
  habit: Habit | null;
  onToggleCompletion: (habitId: string) => void;
  isCompleted?: boolean;
}

export const HabitDetailModal: React.FC<HabitDetailModalProps> = ({
  visible,
  onClose,
  habit,
  onToggleCompletion,
  isCompleted
}) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [completed, setCompleted] = useState(isCompleted);

  useEffect(() => {
    setCompleted(isCompleted);
  }, [isCompleted]);

  if (!habit) return null;

  const handleToggle = () => {
    onToggleCompletion(habit.id);
    setCompleted(!completed);
  };

  const streak = (habit as any).streak || 0; // Using cast since streak might be optional in Habit type in some contexts

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/60 justify-end">
        <View 
          className="h-[85%] w-full rounded-t-3xl overflow-hidden relative"
          style={{ backgroundColor: colors.background }}
        >
          {/* Header */}
          <View className="px-6 pt-6 pb-4 border-b border-gray-100 flex-row justify-between items-center bg-white">
             <TouchableOpacity 
              onPress={onClose}
              className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center"
            >
              <Ionicons name="arrow-down" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <View className="flex-row items-center">
                 <View className={`w-8 h-8 rounded-full items-center justify-center mr-2 ${completed ? 'bg-green-100' : 'bg-gray-100'}`}>
                    <Ionicons 
                        name={(habit.icon as any) || 'star'} 
                        size={16} 
                        color={completed ? colors.success : colors.textSecondary} 
                    />
                </View>
                <Text className="text-xl font-bold" style={{ color: colors.textPrimary }}>
                Habit Details
                </Text>
            </View>
            <TouchableOpacity 
              onPress={() => Alert.alert('Options', 'Edit or Delete functionality to be implemented')}
              className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center"
            >
              <Ionicons name="ellipsis-horizontal" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 100 }}>
             {/* Main Info Card */}
             <View className="bg-white p-6 rounded-3xl shadow-sm mb-6 items-center">
                <View className={`w-20 h-20 rounded-full items-center justify-center mb-4 ${completed ? 'bg-green-100' : 'bg-gray-100'}`}>
                    <Ionicons 
                        name={(habit.icon as any) || 'star'} 
                        size={40} 
                        color={completed ? colors.success : colors.textSecondary} 
                    />
                </View>
                <Text className="text-2xl font-bold mb-1 text-center" style={{ color: colors.textPrimary }}>
                    {habit.name}
                </Text>
                <Text className="text-gray-500 mb-4 text-center">
                    {habit.category.charAt(0).toUpperCase() + habit.category.slice(1)} • {habit.durationMinutes ? `${habit.durationMinutes} mins` : 'No duration'}
                </Text>

                <TouchableOpacity 
                    onPress={handleToggle}
                    className={`px-8 py-3 rounded-full flex-row items-center ${completed ? 'bg-green-500' : 'bg-gray-900'}`}
                >
                    <Ionicons name={completed ? "checkmark-circle" : "ellipse-outline"} size={20} color="white" style={{ marginRight: 8 }} />
                    <Text className="text-white font-bold text-lg">
                        {completed ? 'Completed' : 'Mark Complete'}
                    </Text>
                </TouchableOpacity>
             </View>

             {/* Stats Grid */}
             <Text className="text-lg font-bold mb-4" style={{ color: colors.textPrimary }}>
                Current Progress
             </Text>
             <View className="flex-row flex-wrap justify-between">
                 <View className="w-[48%] bg-white p-4 rounded-2xl shadow-sm mb-4">
                     <View className="flex-row items-center mb-2">
                         <Ionicons name="flame" size={20} color="#F97316" />
                         <Text className="text-gray-500 ml-2 font-medium">Current Streak</Text>
                     </View>
                     <Text className="text-2xl font-bold text-black">{streak} Days</Text>
                 </View>

                 <View className="w-[48%] bg-white p-4 rounded-2xl shadow-sm mb-4">
                     <View className="flex-row items-center mb-2">
                         <Ionicons name="trophy" size={20} color="#EAB308" />
                         <Text className="text-gray-500 ml-2 font-medium">Best Streak</Text>
                     </View>
                     <Text className="text-2xl font-bold text-black">{streak} Days</Text>
                 </View>

                 <View className="w-[48%] bg-white p-4 rounded-2xl shadow-sm mb-4">
                     <View className="flex-row items-center mb-2">
                         <Ionicons name="time" size={20} color="#3B82F6" />
                         <Text className="text-gray-500 ml-2 font-medium">Total Time</Text>
                     </View>
                     <Text className="text-2xl font-bold text-black">
                        {habit.durationMinutes ? `${habit.durationMinutes * streak}` : '0'} mins
                     </Text>
                 </View>

                 <View className="w-[48%] bg-white p-4 rounded-2xl shadow-sm mb-4">
                     <View className="flex-row items-center mb-2">
                         <Ionicons name="calendar" size={20} color="#8B5CF6" />
                         <Text className="text-gray-500 ml-2 font-medium">Frequency</Text>
                     </View>
                     <Text className="text-xl font-bold text-black">Daily</Text>
                 </View>
             </View>

             {/* Description / Notes */}
             <View className="bg-white p-5 rounded-2xl shadow-sm mb-6">
                <Text className="font-bold mb-2 text-gray-900">About this habit</Text>
                <Text className="text-gray-500 leading-5">
                    Consistency is key! You've set this habit to improve your {habit.category}. 
                    Keep up the good work and try to maintain your streak.
                </Text>
             </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
