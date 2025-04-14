import React, { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, Image, ScrollView, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";

interface Story {
  id: string;
  type?: "add";
  name?: string;
  avatar?: string;
  hasStory?: boolean;
}

interface User {
  name: string;
  avatar: string;
}

interface Post {
  id: string;
  user: User;
  content: string;
  image?: string;
  likes: number;
  comments: number;
  timeAgo: string;
}

const stories: Story[] = [
  { id: "add", type: "add" },
  { id: "1", name: "Alice J", avatar: "https://i.pravatar.cc/150?img=1", hasStory: true },
  { id: "2", name: "Michael", avatar: "https://i.pravatar.cc/150?img=2", hasStory: true },
  { id: "3", name: "Sophia", avatar: "https://i.pravatar.cc/150?img=3", hasStory: false },
  { id: "4", name: "James", avatar: "https://i.pravatar.cc/150?img=4", hasStory: true },
  { id: "5", name: "Emma", avatar: "https://i.pravatar.cc/150?img=5", hasStory: false },
];

const posts: Post[] = [
  {
    id: "1",
    user: { name: "Alice Johnson", avatar: "https://i.pravatar.cc/150?img=1" },
    content: "Just completed my morning meditation! 🧘‍♀️ Starting the day with positive energy.",
    image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60",
    likes: 24,
    comments: 5,
    timeAgo: "2h",
  },
  {
    id: "2",
    user: { name: "Michael Smith", avatar: "https://i.pravatar.cc/150?img=2" },
    content: "Hit a new personal record at the gym today! 💪 Consistency is key.",
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60",
    likes: 42,
    comments: 8,
    timeAgo: "4h",
  },
];

const Social = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const StoryCircle = ({ story }: { story: Story }) => (
    <TouchableOpacity className="items-center mr-4">
      {story.type === "add" ? (
        <View className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center border-2 border-gray-300">
          <Ionicons name="add" size={24} color="#4B5563" />
        </View>
      ) : (
        <View className={`${story.hasStory ? 'border-2 border-blue-500 p-[2px]' : ''} rounded-full`}>
          <Image source={{ uri: story.avatar }} className="w-16 h-16 rounded-full" />
        </View>
      )}
      <Text className="text-xs mt-1 text-gray-700" numberOfLines={1}>
        {story.type === "add" ? "Your Story" : story.name}
      </Text>
    </TouchableOpacity>
  );

  const PostCard = ({ post }: { post: Post }) => (
    <View className="bg-white mb-4">
      {/* Post Header */}
      <View className="flex-row items-center p-4">
        <Image source={{ uri: post.user.avatar }} className="w-10 h-10 rounded-full" />
        <View className="flex-1 ml-3">
          <Text className="font-semibold text-gray-900">{post.user.name}</Text>
          <Text className="text-xs text-gray-500">{post.timeAgo}</Text>
        </View>
        <TouchableOpacity>
          <Ionicons name="ellipsis-horizontal" size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Post Content */}
      <Text className="px-4 mb-3 text-gray-800">{post.content}</Text>
      {post.image && (
        <Image 
          source={{ uri: post.image }} 
          className="w-full h-72"
          resizeMode="cover"
        />
      )}

      {/* Post Actions */}
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity className="flex-row items-center mr-6">
          <Ionicons name="heart-outline" size={24} color="#6B7280" />
          <Text className="ml-2 text-gray-600">{post.likes}</Text>
        </TouchableOpacity>
        <TouchableOpacity className="flex-row items-center">
          <Ionicons name="chatbubble-outline" size={22} color="#6B7280" />
          <Text className="ml-2 text-gray-600">{post.comments}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-4 py-2 flex-row items-center justify-between border-b border-gray-200">
        <Text className="text-2xl font-bold text-gray-900">Social</Text>
        <View className="flex-row">
          <TouchableOpacity className="mr-4">
            <Ionicons name="heart-outline" size={24} color="#374151" />
          </TouchableOpacity>
          <TouchableOpacity>
            <Ionicons name="paper-plane-outline" size={24} color="#374151" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View className="px-4 py-2">
        <View className="flex-row items-center bg-gray-200 rounded-full px-4 py-2">
          <Ionicons name="search" size={20} color="#6B7280" />
          <TextInput
            className="flex-1 ml-2 text-gray-700"
            placeholder="Search"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Stories */}
        <View className="py-4 border-b border-gray-200">
          <FlatList
            data={stories}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <StoryCircle story={item} />}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          />
        </View>

        {/* Posts Feed */}
        <View className="pb-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Social;
