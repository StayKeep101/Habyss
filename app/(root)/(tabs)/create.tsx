import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';

interface CreateOptionProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  color: string;
}

export default function CreateScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Theme colors
  const theme = {
    background: isDark ? 'bg-slate-900' : 'bg-slate-50',
    surface: isDark ? 'bg-slate-800' : 'bg-white',
    surfaceSecondary: isDark ? 'bg-slate-700' : 'bg-slate-100',
    textPrimary: isDark ? 'text-slate-50' : 'text-slate-900',
    textSecondary: isDark ? 'text-slate-400' : 'text-slate-600',
    accent: isDark ? 'bg-indigo-500' : 'bg-indigo-600',
    accentLight: isDark ? 'bg-indigo-400' : 'bg-indigo-100',
    success: isDark ? 'bg-emerald-500' : 'bg-emerald-400',
    successLight: isDark ? 'bg-emerald-400' : 'bg-emerald-100',
    border: isDark ? 'border-slate-700' : 'border-slate-200',
  };

  const createOptions: CreateOptionProps[] = [
    {
      icon: 'fitness',
      title: 'New Habit',
      description: 'Track daily activities and build routines',
      color: theme.accent,
    },
    {
      icon: 'time',
      title: 'Routine',
      description: 'Create a sequence of habits',
      color: theme.success,
    },
    {
      icon: 'barbell',
      title: 'Workout',
      description: 'Design your fitness routine',
      color: isDark ? 'bg-rose-500' : 'bg-rose-600',
    },
    {
      icon: 'nutrition',
      title: 'Meal Plan',
      description: 'Plan your healthy meals',
      color: isDark ? 'bg-amber-500' : 'bg-amber-600',
    },
    {
      icon: 'book',
      title: 'Journal Entry',
      description: 'Record your thoughts and progress',
      color: isDark ? 'bg-purple-500' : 'bg-purple-600',
    },
    {
      icon: 'people',
      title: 'Group Challenge',
      description: 'Start a challenge with friends',
      color: isDark ? 'bg-cyan-500' : 'bg-cyan-600',
    },
  ];

  return (
    <SafeAreaView className={`flex-1 ${theme.background}`}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className={`p-5 ${theme.surface} border-b ${theme.border}`}>
          <Text className={`text-2xl font-bold ${theme.textPrimary}`}>
            Create New
          </Text>
          <Text className={`text-sm mt-1 ${theme.textSecondary}`}>
            Choose what you want to create
          </Text>
        </View>

        {/* Create Options */}
        <View className="p-5">
          <View className="flex-row flex-wrap justify-between">
            {createOptions.map((option, index) => (
              <TouchableOpacity
                key={index}
                className={`w-[48%] p-4 rounded-xl mb-4 ${theme.surface} border ${theme.border}`}
              >
                <View className={`w-12 h-12 rounded-xl ${option.color} justify-center items-center mb-3`}>
                  <Ionicons name={option.icon} size={24} color="#fff" />
                </View>
                <Text className={`text-base font-bold mb-1 ${theme.textPrimary}`}>
                  {option.title}
                </Text>
                <Text className={`text-xs ${theme.textSecondary}`}>
                  {option.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quick Templates */}
        <View className="p-5">
          <Text className={`text-lg font-bold mb-4 ${theme.textPrimary}`}>
            Quick Templates
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[
              'Morning Routine',
              'Evening Routine',
              'Workout Plan',
              'Study Session',
              'Meditation',
            ].map((template, index) => (
              <TouchableOpacity
                key={index}
                className={`p-4 rounded-xl mr-4 ${theme.surface} border ${theme.border}`}
              >
                <View className={`w-10 h-10 rounded-full ${theme.surfaceSecondary} justify-center items-center mb-2`}>
                  <Ionicons
                    name="copy"
                    size={20}
                    color={isDark ? '#94a3b8' : '#475569'}
                  />
                </View>
                <Text className={`text-sm font-medium ${theme.textPrimary}`}>
                  {template}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}