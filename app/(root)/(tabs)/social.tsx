import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';

const Social = () => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { lightFeedback, mediumFeedback } = useHaptics();

  const friends = [
    { id: '1', name: 'Sarah Johnson', avatar: 'https://i.pravatar.cc/150?img=1', streak: 15, status: 'online' },
    { id: '2', name: 'Mike Chen', avatar: 'https://i.pravatar.cc/150?img=2', streak: 8, status: 'offline' },
    { id: '3', name: 'Emma Davis', avatar: 'https://i.pravatar.cc/150?img=3', streak: 22, status: 'online' },
    { id: '4', name: 'Alex Rodriguez', avatar: 'https://i.pravatar.cc/150?img=4', streak: 12, status: 'offline' },
  ];

  const challenges = [
    { id: '1', title: '30-Day Fitness Challenge', participants: 24, daysLeft: 12, icon: 'fitness' },
    { id: '2', title: 'Reading Marathon', participants: 18, daysLeft: 8, icon: 'book' },
    { id: '3', title: 'Meditation Streak', participants: 31, daysLeft: 15, icon: 'leaf' },
  ];

  const handleSearch = () => {
    lightFeedback();
    Alert.alert(
      'Search Friends',
      'Search functionality coming soon! You\'ll be able to find and connect with new friends.',
      [{ text: 'OK' }]
    );
  };

  const handleAddFriend = () => {
    lightFeedback();
    Alert.alert(
      'Add Friends',
      'Friend management coming soon! You\'ll be able to add friends, send invitations, and manage your connections.',
      [{ text: 'OK' }]
    );
  };

  const handleViewAllFriends = () => {
    lightFeedback();
    Alert.alert(
      'All Friends',
      'Friend list view coming soon! You\'ll see all your friends with detailed profiles and activity.',
      [{ text: 'OK' }]
    );
  };

  const handleJoinNewChallenge = () => {
    lightFeedback();
    Alert.alert(
      'Join Challenge',
      'Challenge discovery coming soon! Browse and join exciting challenges with your friends.',
      [{ text: 'OK' }]
    );
  };

  const handleFriendChat = (friend: any) => {
    lightFeedback();
    Alert.alert(
      `Chat with ${friend.name}`,
      `Direct messaging coming soon! You\'ll be able to chat with ${friend.name} and share your progress.`,
      [{ text: 'OK' }]
    );
  };

  const handleJoinChallenge = (challenge: any) => {
    lightFeedback();
    Alert.alert(
      'Challenge Joined!',
      `You've joined the "${challenge.title}" challenge! You'll receive updates and can track your progress.`,
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="px-6 pt-4 pb-6">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
            Social
          </Text>
          <View className="flex-row space-x-2">
            <TouchableOpacity 
              className="w-12 h-12 rounded-2xl items-center justify-center"
              style={{ backgroundColor: colors.surfaceSecondary }}
              onPress={handleSearch}
            >
              <Ionicons name="search" size={22} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity 
              className="w-12 h-12 rounded-2xl items-center justify-center"
              style={{ backgroundColor: colors.surfaceSecondary }}
              onPress={handleAddFriend}
            >
              <Ionicons name="add" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        {/* Friends Section */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-xl font-bold" style={{ color: colors.textPrimary }}>
              Friends
            </Text>
            <TouchableOpacity onPress={handleViewAllFriends}>
              <Text className="text-sm font-medium" style={{ color: colors.primary }}>
                View All
              </Text>
            </TouchableOpacity>
          </View>
          
          <View 
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: colors.surfaceSecondary }}
          >
            {friends.map((friend, index) => (
              <View key={friend.id}>
                <TouchableOpacity className="flex-row items-center p-4">
                  <View className="relative">
                    <Image
                      source={{ uri: friend.avatar }}
                      className="w-14 h-14 rounded-2xl"
                    />
                    <View 
                      className={`w-4 h-4 rounded-full absolute -bottom-1 -right-1 border-2 ${
                        friend.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                      style={{ borderColor: colors.background }}
                    />
                  </View>
                  <View className="flex-1 ml-4">
                    <Text className="font-bold text-base" style={{ color: colors.textPrimary }}>
                      {friend.name}
                    </Text>
                    <Text className="text-sm" style={{ color: colors.textSecondary }}>
                      {friend.streak} day streak
                    </Text>
                  </View>
                  <TouchableOpacity
                    className="w-10 h-10 rounded-2xl items-center justify-center"
                    style={{ backgroundColor: colors.primary + '20' }}
                    onPress={() => handleFriendChat(friend)}
                  >
                    <Ionicons name="chatbubble" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </TouchableOpacity>
                {index < friends.length - 1 && (
                  <View 
                    className="h-[0.5px] mx-4"
                    style={{ backgroundColor: colors.border }}
                  />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Challenges Section */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-xl font-bold" style={{ color: colors.textPrimary }}>
              Active Challenges
            </Text>
            <TouchableOpacity onPress={handleJoinNewChallenge}>
              <Text className="text-sm font-medium" style={{ color: colors.primary }}>
                Join New
              </Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            {challenges.map((challenge) => (
              <TouchableOpacity
                key={challenge.id}
                className="mr-4 p-5 rounded-2xl min-w-[200px]"
                style={{ backgroundColor: colors.surfaceSecondary }}
                onPress={() => handleJoinChallenge(challenge)}
              >
                <View className="flex-row items-center mb-3">
                  <View 
                    className="w-12 h-12 rounded-2xl items-center justify-center mr-3"
                    style={{ backgroundColor: colors.primary + '20' }}
                  >
                    <Ionicons name={challenge.icon as any} size={24} color={colors.primary} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-base" style={{ color: colors.textPrimary }}>
                      {challenge.title}
                    </Text>
                    <Text className="text-sm" style={{ color: colors.textSecondary }}>
                      {challenge.participants} participants
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-medium" style={{ color: colors.success }}>
                    {challenge.daysLeft} days left
                  </Text>
                  <TouchableOpacity
                    className="px-4 py-2 rounded-xl"
                    style={{ backgroundColor: colors.primary }}
                    onPress={() => handleJoinChallenge(challenge)}
                  >
                    <Text className="text-sm font-bold text-white">Join</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Leaderboard Section */}
        <View className="mb-6">
          <Text className="text-xl font-bold mb-4" style={{ color: colors.textPrimary }}>
            Leaderboard
          </Text>
          <View 
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: colors.surfaceSecondary }}
          >
            {[
              { rank: 1, name: 'Emma Davis', streak: 22, avatar: 'https://i.pravatar.cc/150?img=3' },
              { rank: 2, name: 'Sarah Johnson', streak: 15, avatar: 'https://i.pravatar.cc/150?img=1' },
              { rank: 3, name: 'Alex Rodriguez', streak: 12, avatar: 'https://i.pravatar.cc/150?img=4' },
              { rank: 4, name: 'Mike Chen', streak: 8, avatar: 'https://i.pravatar.cc/150?img=2' },
            ].map((user, index) => (
              <View key={user.rank}>
                <TouchableOpacity 
                  className="flex-row items-center p-4"
                  onPress={() => {
                    lightFeedback();
                    Alert.alert(
                      `${user.name}'s Profile`,
                      `View ${user.name}'s detailed profile, achievements, and progress.`,
                      [{ text: 'OK' }]
                    );
                  }}
                >
                  <View className="w-12 h-12 rounded-2xl items-center justify-center mr-4"
                        style={{ backgroundColor: colors.primary + '20' }}>
                    <Text className="text-lg font-bold" style={{ color: colors.primary }}>
                      {user.rank}
                    </Text>
                  </View>
                  <Image
                    source={{ uri: user.avatar }}
                    className="w-12 h-12 rounded-2xl mr-4"
                  />
                  <View className="flex-1">
                    <Text className="font-bold text-base" style={{ color: colors.textPrimary }}>
                      {user.name}
                    </Text>
                    <Text className="text-sm" style={{ color: colors.textSecondary }}>
                      {user.streak} day streak
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-2xl font-bold" style={{ color: colors.warning }}>
                      {user.streak}
                    </Text>
                  </View>
                </TouchableOpacity>
                {index < 3 && (
                  <View 
                    className="h-[0.5px] mx-4"
                    style={{ backgroundColor: colors.border }}
                  />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Bottom Spacing */}
        <View className="h-20" />
      </ScrollView>
    </SafeAreaView>
  );
};

export default Social;