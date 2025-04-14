import { Link } from "expo-router";
import React from "react";
import { View, Text, Image, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const Profile = () => {
  return (
    <ScrollView className="flex-1 bg-gray-100">
      <SafeAreaView className="flex-1">
        {/* Profile Header */}
        <View className="w-full items-center bg-white py-8 shadow-sm">
          <Image
            source={{ uri: "https://via.placeholder.com/100" }} // Replace with actual profile image
            className="w-24 h-24 rounded-full mb-2"
          />
          <Text className="text-3xl font-semibold text-gray-900">John Doe</Text>
          <Text className="text-gray-500">johndoe@example.com</Text>
        </View>

        {/* Settings Section */}
        <View className="mt-6 mx-4 bg-white rounded-2xl shadow-sm divide-y divide-gray-200">
          <Link href="/(root)/setting" asChild>
            <Pressable className="p-4 flex-row justify-between items-center">
              <Text className="text-lg text-gray-800">⚙️ Settings</Text>
              <Text className="text-gray-400">›</Text>
            </Pressable>
          </Link>

          <Pressable className="p-4 flex-row justify-between items-center">
            <Text className="text-lg text-gray-800">📊 Progress</Text>
            <Text className="text-gray-400">›</Text>
          </Pressable>

          <Pressable className="p-4 flex-row justify-between items-center">
            <Text className="text-lg text-gray-800">📝 Edit Profile</Text>
            <Text className="text-gray-400">›</Text>
          </Pressable>
        </View>

        {/* Logout Section */}
        <View className="mt-6 mx-4 bg-white rounded-2xl shadow-sm">
          <Pressable className="p-4 flex-row justify-center items-center">
            <Text className="text-lg font-semibold text-red-500">🚪 Log Out</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </ScrollView>
  );
};

export default Profile;
