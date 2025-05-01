import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';

export default function CalendarScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Mock data for activities
  const activities = [
    {
      time: '8:00 AM',
      title: 'Morning Workout',
      type: 'workout',
      completed: true,
    },
    {
      time: '9:00 AM',
      title: 'Meditation',
      type: 'meditation',
      completed: true,
    },
    {
      time: '10:00 AM',
      title: 'Focus Session',
      type: 'focus',
      completed: true,
    },
    {
      time: '12:00 PM',
      title: 'Healthy Lunch',
      type: 'diet',
      completed: false,
    },
    {
      time: '2:00 PM',
      title: 'Reading',
      type: 'habit',
      completed: false,
    },
    {
      time: '4:00 PM',
      title: 'Evening Workout',
      type: 'workout',
      completed: false,
    },
  ];

  const getActivityIcon = (type) => {
    switch (type) {
      case 'workout':
        return 'fitness';
      case 'meditation':
        return 'leaf';
      case 'focus':
        return 'timer';
      case 'diet':
        return 'nutrition';
      case 'habit':
        return 'repeat';
      default:
        return 'calendar';
    }
  };

  const getActivityColor = (type) => {
    switch (type) {
      case 'workout':
        return 'bg-orange-500';
      case 'meditation':
        return 'bg-green-500';
      case 'focus':
        return 'bg-blue-500';
      case 'diet':
        return 'bg-purple-500';
      case 'habit':
        return 'bg-pink-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <SafeAreaView className="flex-1 p-5">
      <View className="mb-8">
        <Text className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-black'}`}>
          Calendar
        </Text>
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            className={`w-10 h-10 rounded-full justify-center items-center ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={isDark ? '#fff' : '#000'}
            />
          </TouchableOpacity>
          <Text className={`text-lg font-medium ${isDark ? 'text-white' : 'text-black'}`}>
            {selectedDate.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
          <TouchableOpacity
            className={`w-10 h-10 rounded-full justify-center items-center ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}
          >
            <Ionicons
              name="chevron-forward"
              size={24}
              color={isDark ? '#fff' : '#000'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View className="flex-row justify-between mb-8">
        <View className="flex-1 items-center p-4 rounded-xl bg-gray-100 mx-1">
          <Text className="text-2xl font-bold text-blue-500">5</Text>
          <Text className="text-gray-600">Completed</Text>
        </View>
        <View className="flex-1 items-center p-4 rounded-xl bg-gray-100 mx-1">
          <Text className="text-2xl font-bold text-blue-500">2</Text>
          <Text className="text-gray-600">Pending</Text>
        </View>
        <View className="flex-1 items-center p-4 rounded-xl bg-gray-100 mx-1">
          <Text className="text-2xl font-bold text-blue-500">85%</Text>
          <Text className="text-gray-600">Progress</Text>
        </View>
      </View>

      <ScrollView className="flex-1">
        {activities.map((activity, index) => (
          <TouchableOpacity
            key={index}
            className={`flex-row items-center p-4 rounded-xl mb-3 ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}
          >
            <View className="w-16">
              <Text className={`text-sm font-medium ${isDark ? 'text-white' : 'text-black'}`}>
                {activity.time}
              </Text>
            </View>
            <View className="flex-row items-center flex-1">
              <View className={`w-10 h-10 rounded-full ${getActivityColor(activity.type)} justify-center items-center`}>
                <Ionicons
                  name={getActivityIcon(activity.type)}
                  size={24}
                  color="#fff"
                />
              </View>
              <View className="flex-1 ml-4">
                <Text className={`text-base font-medium ${isDark ? 'text-white' : 'text-black'}`}>
                  {activity.title}
                </Text>
                <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                </Text>
              </View>
            </View>
            <Ionicons
              name={activity.completed ? 'checkmark-circle' : 'time'}
              size={24}
              color={activity.completed ? '#4CAF50' : '#FF9800'}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}