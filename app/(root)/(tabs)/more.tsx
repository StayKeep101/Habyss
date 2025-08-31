import React, { useState } from "react";
import { View, Text, Image, Pressable, ScrollView, Switch, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';

interface SettingsItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  color?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  isLink?: boolean;
  showBadge?: boolean;
}

const SettingsItem: React.FC<SettingsItemProps> = ({ 
  icon, 
  label, 
  subtitle,
  color = "#007AFF", 
  onPress, 
  rightElement, 
  isLink = true,
  showBadge
}) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Pressable 
      onPress={onPress}
      className="flex-row items-center p-4 active:opacity-70"
    >
      <View className="w-10 h-10 rounded-full items-center justify-center mr-3 relative"
            style={{ backgroundColor: color + '20' }}>
        <Ionicons name={icon} size={20} color={color} />
        {showBadge && (
          <View className="w-2 h-2 bg-red-500 rounded-full absolute -right-1 -top-1" />
        )}
      </View>
      <View className="flex-1">
        <Text className="font-semibold text-base" style={{ color: colors.textPrimary }}>
          {label}
        </Text>
        {subtitle && (
          <Text className="text-sm mt-0.5" style={{ color: colors.textSecondary }}>
            {subtitle}
          </Text>
        )}
      </View>
      {rightElement || (isLink && <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />)}
    </Pressable>
  );
};

interface SectionHeaderProps {
  title: string;
  action?: React.ReactNode;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, action }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View className="flex-row justify-between items-center px-4 py-2">
      <Text className="text-sm font-semibold" style={{ color: colors.textSecondary }}>
        {title.toUpperCase()}
      </Text>
      {action}
    </View>
  );
};

const More = () => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [isDarkMode, setIsDarkMode] = useState(colorScheme === 'dark');
  const { lightFeedback, mediumFeedback } = useHaptics();

  const handleEditProfile = () => {
    lightFeedback();
    Alert.alert(
      'Edit Profile',
      'Profile editing feature coming soon!',
      [{ text: 'OK' }]
    );
  };

  const handleStatistics = () => {
    lightFeedback();
    router.push('/stats');
  };

  const handleSettings = () => {
    lightFeedback();
    router.push('/settings');
  };

  const handleNotifications = () => {
    lightFeedback();
    router.push('/notifications');
  };

  const handleDarkModeToggle = () => {
    mediumFeedback();
    setIsDarkMode(!isDarkMode);
    Alert.alert(
      'Theme Changed',
      `Switched to ${!isDarkMode ? 'dark' : 'light'} mode!`,
      [{ text: 'OK' }]
    );
  };

  const handlePrivacy = () => {
    lightFeedback();
    router.push('/privacy');
  };

  const handleHelpSupport = () => {
    lightFeedback();
    router.push('/help-support');
  };

  const handleTermsPrivacy = () => {
    lightFeedback();
    Alert.alert(
      'Terms & Privacy Policy',
      'Terms and privacy policy coming soon!',
      [{ text: 'OK' }]
    );
  };

  const handleSignOut = () => {
    mediumFeedback();
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: () => {
            Alert.alert('Signed Out', 'You have been signed out successfully!');
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="px-6 pt-4 pb-6">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
            Profile
          </Text>
          <TouchableOpacity 
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.surfaceSecondary }}
            onPress={handleEditProfile}
          >
            <Ionicons name="create" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1 px-6">
        {/* Profile Header */}
        <View className="mb-6">
          <View 
            className="p-6 rounded-2xl"
            style={{ backgroundColor: colors.primary }}
          >
            <View className="flex-row items-center mb-6">
              <Image
                source={{ uri: "https://i.pravatar.cc/150?img=12" }}
                className="w-20 h-20 rounded-full"
              />
              <View className="ml-4 flex-1">
                <Text className="text-xl font-bold text-white">John Doe</Text>
                <Text className="text-blue-100">@johndoe</Text>
                <Text className="text-blue-100 text-sm mt-1">Premium Member</Text>
              </View>
            </View>

            {/* Quick Stats */}
            <View className="flex-row justify-between">
              <View className="items-center flex-1">
                <Text className="text-white text-2xl font-bold">12</Text>
                <Text className="text-blue-100 text-sm">Day Streak</Text>
              </View>
              <View className="items-center flex-1">
                <Text className="text-white text-2xl font-bold">87%</Text>
                <Text className="text-blue-100 text-sm">Productivity</Text>
              </View>
              <View className="items-center flex-1">
                <Text className="text-white text-2xl font-bold">24</Text>
                <Text className="text-blue-100 text-sm">Tasks Done</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="mb-6">
          <SectionHeader title="Quick Actions" />
          <View 
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: colors.surfaceSecondary }}
          >
            <SettingsItem
              icon="stats-chart"
              label="Statistics"
              subtitle="View your detailed progress"
              color={colors.primary}
              onPress={handleStatistics}
            />
            <View className="h-[0.5px] mx-4" style={{ backgroundColor: colors.border }} />
            <SettingsItem
              icon="settings-outline"
              label="Settings"
              subtitle="App preferences and account settings"
              color={colors.success}
              onPress={handleSettings}
            />
          </View>
        </View>

        {/* Notifications & Privacy */}
        <View className="mb-6">
          <SectionHeader title="Notifications & Privacy" />
          <View 
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: colors.surfaceSecondary }}
          >
            <SettingsItem
              icon="notifications-outline"
              label="Notifications"
              subtitle="Manage your alerts"
              color={colors.warning}
              showBadge={true}
              onPress={handleNotifications}
            />
            <View className="h-[0.5px] mx-4" style={{ backgroundColor: colors.border }} />
            <SettingsItem
              icon="moon-outline"
              label="Dark Mode"
              color={colors.secondary}
              rightElement={
                <Switch
                  value={isDarkMode}
                  onValueChange={handleDarkModeToggle}
                  trackColor={{ false: '#e2e8f0', true: colors.primary }}
                  thumbColor={isDarkMode ? 'white' : '#f1f5f9'}
                />
              }
              isLink={false}
            />
            <View className="h-[0.5px] mx-4" style={{ backgroundColor: colors.border }} />
            <SettingsItem
              icon="lock-closed-outline"
              label="Privacy"
              subtitle="Manage your privacy settings"
              color={colors.accent}
              onPress={handlePrivacy}
            />
          </View>
        </View>

        {/* Support & About */}
        <View className="mb-6">
          <SectionHeader title="Support & About" />
          <View 
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: colors.surfaceSecondary }}
          >
            <SettingsItem
              icon="help-circle-outline"
              label="Help & Support"
              subtitle="Get assistance and FAQs"
              color={colors.primary}
              onPress={handleHelpSupport}
            />
            <View className="h-[0.5px] mx-4" style={{ backgroundColor: colors.border }} />
            <SettingsItem
              icon="document-text-outline"
              label="Terms & Privacy Policy"
              subtitle="Read our terms and conditions"
              color={colors.success}
              onPress={handleTermsPrivacy}
            />
            <View className="h-[0.5px] mx-4" style={{ backgroundColor: colors.border }} />
            <SettingsItem
              icon="log-out-outline"
              label="Sign Out"
              subtitle="Sign out of your account"
              color={colors.error}
              onPress={handleSignOut}
            />
          </View>
        </View>

        {/* App Info */}
        <View className="mb-6">
          <SectionHeader title="App Information" />
          <View 
            className="p-4 rounded-2xl"
            style={{ backgroundColor: colors.surfaceSecondary }}
          >
            <View className="flex-row items-center justify-between mb-2">
              <Text className="font-semibold" style={{ color: colors.textPrimary }}>
                App Version
              </Text>
              <Text style={{ color: colors.textSecondary }}>
                1.0.0
              </Text>
            </View>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="font-semibold" style={{ color: colors.textPrimary }}>
                Build Number
              </Text>
              <Text style={{ color: colors.textSecondary }}>
                2024.1.0
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="font-semibold" style={{ color: colors.textPrimary }}>
                Last Updated
              </Text>
              <Text style={{ color: colors.textSecondary }}>
                Today
              </Text>
            </View>
          </View>
        </View>

        {/* Bottom Spacing */}
        <View className="h-20" />
      </ScrollView>
    </SafeAreaView>
  );
};

export default More;
