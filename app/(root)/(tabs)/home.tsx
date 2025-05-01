import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';

interface ActivityItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  time: string;
  completed: boolean;
}

export default function HomeScreen() {
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

  return (
    <SafeAreaView className={`flex-1 ${theme.background}`}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className={`p-5 ${theme.surface} border-b ${theme.border}`}>
          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className={`text-2xl font-bold ${theme.textSecondary}`}>
                Good morning,
              </Text>
              <Text className={`text-3xl font-bold ${theme.textPrimary}`}>
                Habyss
              </Text>
            </View>
            <View className={`w-12 h-12 rounded-full overflow-hidden border-2 ${theme.border}`}>
              <View className={`w-full h-full justify-center items-center ${theme.surfaceSecondary}`}>
                <Ionicons name="happy" size={24} color={isDark ? '#94a3b8' : '#475569'} />
              </View>
            </View>
          </View>

          {/* Streak and Progress */}
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center">
              <View className={`w-12 h-12 rounded-xl justify-center items-center ${theme.accent}`}>
                <Text className="text-lg font-bold text-white">7</Text>
                <Text className="text-xs text-white/80">Days</Text>
              </View>
              <View className="ml-3">
                <Text className={`text-sm font-medium ${theme.textSecondary}`}>
                  Current Streak
                </Text>
                <Text className={`text-base font-bold ${theme.textPrimary}`}>
                  Keep going!
                </Text>
              </View>
            </View>
            <View className="flex-row space-x-1">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                <View
                  key={day}
                  className={`w-2 h-2 rounded-full ${day <= 5 ? theme.accent : theme.surfaceSecondary}`}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Today's Overview */}
        <View className="p-5">
          <Text className={`text-lg font-bold mb-4 ${theme.textPrimary}`}>
            Today's Overview
          </Text>
          <View className="flex-row flex-wrap justify-between">
            <View className={`w-[48%] p-4 rounded-xl mb-4 ${theme.surface} border ${theme.border}`}>
              <View className="flex-row items-center mb-2">
                <View className={`w-8 h-8 rounded-full ${theme.accentLight} justify-center items-center`}>
                  <Ionicons name="fitness" size={16} color={isDark ? '#818cf8' : '#4f46e5'} />
                </View>
                <Text className={`ml-2 text-sm font-medium ${theme.textPrimary}`}>
                  Activity
                </Text>
              </View>
              <Text className={`text-2xl font-bold ${theme.textPrimary}`}>
                45 min
              </Text>
            </View>
            <View className={`w-[48%] p-4 rounded-xl mb-4 ${theme.surface} border ${theme.border}`}>
              <View className="flex-row items-center mb-2">
                <View className={`w-8 h-8 rounded-full ${theme.successLight} justify-center items-center`}>
                  <Ionicons name="water" size={16} color={isDark ? '#34d399' : '#059669'} />
                </View>
                <Text className={`ml-2 text-sm font-medium ${theme.textPrimary}`}>
                  Hydration
                </Text>
              </View>
              <Text className={`text-2xl font-bold ${theme.textPrimary}`}>
                2.5L
              </Text>
            </View>
          </View>
        </View>

        {/* Today's Schedule */}
        <View className="p-5">
          <View className="flex-row justify-between items-center mb-4">
            <Text className={`text-lg font-bold ${theme.textPrimary}`}>
              Today's Schedule
            </Text>
            <TouchableOpacity>
              <Text className={`text-sm font-medium ${theme.accent.replace('bg-', 'text-')}`}>
                View All
              </Text>
            </TouchableOpacity>
          </View>
          <View className="gap-3">
            <ActivityItem
              icon="fitness"
              title="Morning Workout"
              time="8:00 AM"
              completed={true}
              theme={theme}
            />
            <ActivityItem
              icon="book"
              title="Reading"
              time="10:00 AM"
              completed={true}
              theme={theme}
            />
            <ActivityItem
              icon="nutrition"
              title="Healthy Lunch"
              time="12:30 PM"
              completed={false}
              theme={theme}
            />
          </View>
        </View>

        {/* Community Highlights */}
        <View className="p-5">
          <Text className={`text-lg font-bold mb-4 ${theme.textPrimary}`}>
            Community Highlights
          </Text>
          <View className={`p-4 rounded-xl ${theme.surface} border ${theme.border}`}>
            <View className="flex-row items-center mb-3">
              <View className={`w-8 h-8 rounded-full ${theme.surfaceSecondary} justify-center items-center`}>
                <Text className="text-lg">👩</Text>
              </View>
              <View className="ml-2">
                <Text className={`font-medium ${theme.textPrimary}`}>
                  Sarah
                </Text>
                <Text className={`text-xs ${theme.textSecondary}`}>
                  2h ago
                </Text>
              </View>
            </View>
            <Text className={`text-sm ${theme.textSecondary}`}>
              Just completed a 30-minute meditation session! Feeling refreshed and focused. 🧘‍♀️
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActivityItem({ icon, title, time, completed, theme }: ActivityItemProps & { theme: any }) {
  return (
    <View className={`flex-row items-center p-4 rounded-xl ${theme.surface} border ${theme.border}`}>
      <View className={`w-10 h-10 rounded-full ${completed ? theme.successLight : theme.surfaceSecondary} justify-center items-center`}>
        <Ionicons
          name={icon}
          size={20}
          color={completed ? (theme.success.replace('bg-', '')) : theme.textSecondary.replace('text-', '')}
        />
      </View>
      <View className="flex-1 ml-4">
        <Text className={`text-base font-medium ${theme.textPrimary}`}>{title}</Text>
        <Text className={theme.textSecondary}>{time}</Text>
      </View>
      <Ionicons
        name={completed ? 'checkmark-circle' : 'time'}
        size={24}
        color={completed ? (theme.success.replace('bg-', '')) : theme.textSecondary.replace('text-', '')}
      />
    </View>
  );
}