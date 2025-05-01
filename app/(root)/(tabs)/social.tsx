import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';

export default function SocialScreen() {
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

  // Mock data for challenges
  const challenges = [
    {
      id: 1,
      title: '30-Day Fitness Challenge',
      participants: 125,
      progress: 75,
      color: theme.accent,
    },
    {
      id: 2,
      title: 'Meditation Streak',
      participants: 89,
      progress: 60,
      color: theme.success,
    },
    {
      id: 3,
      title: 'No Sugar Challenge',
      participants: 203,
      progress: 45,
      color: isDark ? 'bg-purple-500' : 'bg-purple-600',
    },
  ];

  // Mock data for friends
  const friends = [
    {
      id: 1,
      name: 'Sarah',
      streak: 7,
      avatar: '👩',
      status: 'Active now',
    },
    {
      id: 2,
      name: 'Mike',
      streak: 14,
      avatar: '👨',
      status: '2h ago',
    },
    {
      id: 3,
      name: 'Emma',
      streak: 21,
      avatar: '👧',
      status: '1d ago',
    },
  ];

  return (
    <SafeAreaView className={`flex-1 ${theme.background}`}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className={`p-5 ${theme.surface} border-b ${theme.border}`}>
          <View className="flex-row justify-between items-center mb-6">
            <Text className={`text-2xl font-bold ${theme.textPrimary}`}>
              Community
            </Text>
            <TouchableOpacity
              className={`w-10 h-10 rounded-full justify-center items-center ${theme.surfaceSecondary}`}
            >
              <Ionicons
                name="search"
                size={24}
                color={isDark ? '#94a3b8' : '#475569'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Active Challenges */}
        <View className="p-5">
          <View className="flex-row justify-between items-center mb-4">
            <Text className={`text-lg font-bold ${theme.textPrimary}`}>
              Active Challenges
            </Text>
            <TouchableOpacity>
              <Text className={`text-sm font-medium ${theme.accent.replace('bg-', 'text-')}`}>
                See all
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {challenges.map((challenge) => (
              <TouchableOpacity
                key={challenge.id}
                className={`w-64 p-4 rounded-xl mr-4 ${theme.surface} border ${theme.border}`}
              >
                <View className={`w-12 h-12 rounded-full ${challenge.color} justify-center items-center mb-3`}>
                  <Ionicons name="trophy" size={24} color="#fff" />
                </View>
                <Text className={`text-base font-bold mb-1 ${theme.textPrimary}`}>
                  {challenge.title}
                </Text>
                <Text className={`text-sm ${theme.textSecondary} mb-3`}>
                  {challenge.participants} participants
                </Text>
                <View className={`h-1.5 rounded-full ${theme.surfaceSecondary}`}>
                  <View
                    className={`h-full rounded-full ${challenge.color}`}
                    style={{ width: `${challenge.progress}%` }}
                  />
                </View>
                <Text className={`text-xs mt-1 ${theme.textSecondary}`}>
                  {challenge.progress}% complete
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Friends Section */}
        <View className="p-5">
          <View className="flex-row justify-between items-center mb-4">
            <Text className={`text-lg font-bold ${theme.textPrimary}`}>
              Friends
            </Text>
            <TouchableOpacity>
              <Text className={`text-sm font-medium ${theme.accent.replace('bg-', 'text-')}`}>
                Add Friends
              </Text>
            </TouchableOpacity>
          </View>
          <View className="gap-3">
            {friends.map((friend) => (
              <TouchableOpacity
                key={friend.id}
                className={`flex-row items-center p-4 rounded-xl ${theme.surface} border ${theme.border}`}
              >
                <View className={`w-12 h-12 rounded-full ${theme.surfaceSecondary} justify-center items-center`}>
                  <Text className="text-2xl">{friend.avatar}</Text>
                </View>
                <View className="flex-1 ml-4">
                  <Text className={`text-base font-bold ${theme.textPrimary}`}>
                    {friend.name}
                  </Text>
                  <Text className={`text-sm ${theme.textSecondary}`}>
                    {friend.streak} day streak
                  </Text>
                  <Text className={`text-xs ${theme.textSecondary}`}>
                    {friend.status}
                  </Text>
                </View>
                <TouchableOpacity className={`p-2 rounded-full ${theme.surfaceSecondary}`}>
                  <Ionicons
                    name="chatbubble-ellipses"
                    size={20}
                    color={isDark ? '#94a3b8' : '#475569'}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Community Posts */}
        <View className="p-5">
          <View className="flex-row justify-between items-center mb-4">
            <Text className={`text-lg font-bold ${theme.textPrimary}`}>
              Community Posts
            </Text>
            <TouchableOpacity>
              <Text className={`text-sm font-medium ${theme.accent.replace('bg-', 'text-')}`}>
                See all
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            className={`flex-row items-center justify-center p-4 rounded-xl ${theme.surface} border ${theme.border}`}
          >
            <View className={`w-10 h-10 rounded-full ${theme.surfaceSecondary} justify-center items-center mr-3`}>
              <Ionicons
                name="create"
                size={20}
                color={isDark ? '#94a3b8' : '#475569'}
              />
            </View>
            <Text className={`text-base font-medium ${theme.textPrimary}`}>
              Create a Post
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}