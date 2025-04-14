import React, { useState } from "react";
import { View, Text, Image, Pressable, ScrollView, Switch, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { Ionicons } from '@expo/vector-icons';


interface SettingsItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  isLink?: boolean;
  subtitle?: string;
  showBadge?: boolean;
}

const SettingsItem: React.FC<SettingsItemProps> = ({ 
  icon, 
  label, 
  color = "#007AFF", 
  onPress, 
  rightElement, 
  isLink = true,
  subtitle,
  showBadge
}) => (
  <Pressable 
    onPress={onPress}
    className="flex-row items-center px-4 py-3 bg-white active:bg-gray-100"
  >
    <View className="w-8 mr-3 items-center">
      <Ionicons name={icon} size={22} color={color} />
      {showBadge && (
        <View className="w-2 h-2 bg-red-500 rounded-full absolute -right-1 -top-1" />
      )}
    </View>
    <View className="flex-1">
      <Text className="text-[17px] text-gray-900">{label}</Text>
      {subtitle && (
        <Text className="text-sm text-gray-500 mt-0.5">{subtitle}</Text>
      )}
    </View>
    {rightElement || (isLink && <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />)}
  </Pressable>
);

interface SectionHeaderProps {
  title: string;
  action?: React.ReactNode;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, action }) => (
  <View className="flex-row justify-between items-center px-4 py-2">
    <Text className="text-[14px] font-semibold text-gray-500 uppercase">{title}</Text>
    {action}
  </View>
);

const More = () => {
  

  return (
    <ScrollView className="flex-1 bg-gray-100">
      <SafeAreaView className="pt-10">
        {/* Profile Header */}
        <View className="px-4 pb-6 bg-white">
          <View className="flex-row items-center mb-6">
            <Image
              source={{ uri: "https://i.pravatar.cc/150?img=12" }}
              className="w-24 h-24 rounded-full"
            />
            <View className="ml-4 flex-1">
              <Text className="text-2xl font-bold text-gray-900">John Doe</Text>
              <Text className="text-gray-500">@johndoe</Text>
              <Link href="/profile" asChild>
                <TouchableOpacity 
                  className="bg-blue-500 rounded-full px-4 py-2 mt-2 self-start"
                >
                  <Text className="text-white font-medium">Edit Profile</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>

          {/* Quick Stats */}
          <View className="flex-row justify-between">
            <View className="items-center flex-1">
              <Text className="text-2xl font-bold text-gray-900">12</Text>
              <Text className="text-sm text-gray-500">Day Streak</Text>
            </View>
            <View className="items-center flex-1">
              <Text className="text-2xl font-bold text-gray-900">87%</Text>
              <Text className="text-sm text-gray-500">Productivity</Text>
            </View>
            <View className="items-center flex-1">
              <Text className="text-2xl font-bold text-gray-900">24</Text>
              <Text className="text-sm text-gray-500">Tasks Done</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="mt-6">
          <SectionHeader title="Quick Actions" />
          <View className="bg-white">
            <Link href="/stats" asChild>
              <SettingsItem
                icon="stats-chart"
                label="Statistics"
                subtitle="View your detailed progress"
              />
            </Link>
            <View className="h-[0.5px] bg-gray-200 mx-4" />
            <Link href="/setting" asChild>
              <SettingsItem
                icon="settings-outline"
                label="Settings"
                subtitle="App preferences and account settings"
              />
            </Link>
          </View>
        </View>

        {/* Notifications & Privacy */}
        <View className="mt-6">
          <SectionHeader title="Notifications & Privacy" />
          <View className="bg-white">
            <SettingsItem
              icon="notifications-outline"
              label="Notifications"
              subtitle="Manage your alerts"
              showBadge={true}
            />
            <View className="h-[0.5px] bg-gray-200 mx-4" />
            <SettingsItem
            icon="moon-outline"
            label="Dark Mode"
            rightElement={
              <Switch
                ios_backgroundColor="#3e3e3e"
              />
              }
              isLink={false}
            />
            <View className="h-[0.5px] bg-gray-200 mx-4" />
            <SettingsItem
              icon="lock-closed-outline"
              label="Privacy"
              subtitle="Manage your privacy settings"
            />
          </View>
        </View>

        {/* Support & About */}
        <View className="mt-6 mb-6">
          <SectionHeader title="Support & About" />
          <View className="bg-white">
            <SettingsItem
              icon="help-circle-outline"
              label="Help & Support"
              subtitle="Get assistance and FAQs"
            />
            <View className="h-[0.5px] bg-gray-200 mx-4" />
            <SettingsItem
              icon="document-text-outline"
              label="Terms & Privacy Policy"
              subtitle="Read our terms and conditions"
            />
            <View className="h-[0.5px] bg-gray-200 mx-4" />
            <SettingsItem
              icon="log-out-outline"
              label="Sign Out"
              color="#FF3B30"
              onPress={() => {}}
            />
          </View>
        </View>
      </SafeAreaView>
    </ScrollView>
  );
};

export default More;
