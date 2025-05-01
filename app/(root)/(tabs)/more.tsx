import React, { useState } from "react";
import { View, Text, Image, Pressable, ScrollView, Switch, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';

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
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

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
    <Pressable 
      onPress={onPress}
      className={`flex-row items-center px-4 py-3 ${theme.surface} active:opacity-70`}
    >
      <View className="w-8 mr-3 items-center">
        <Ionicons name={icon} size={22} color={color} />
        {showBadge && (
          <View className="w-2 h-2 bg-red-500 rounded-full absolute -right-1 -top-1" />
        )}
      </View>
      <View className="flex-1">
        <Text className={`text-[17px] ${theme.textPrimary}`}>{label}</Text>
        {subtitle && (
          <Text className={`text-sm ${theme.textSecondary} mt-0.5`}>{subtitle}</Text>
        )}
      </View>
      {rightElement || (isLink && <Ionicons name="chevron-forward" size={20} color={isDark ? '#94a3b8' : '#64748b'} />)}
    </Pressable>
  );
};

interface SectionHeaderProps {
  title: string;
  action?: React.ReactNode;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, action }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View className="flex-row justify-between items-center px-4 py-2">
      <Text className={`text-[14px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase`}>{title}</Text>
      {action}
    </View>
  );
};

const More = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [isDarkMode, setIsDarkMode] = useState(isDark);

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
    <ScrollView className={`flex-1 ${theme.background}`}>
      <SafeAreaView className="pt-10">
        {/* Profile Header */}
        <View className={`px-4 pb-6 ${theme.surface} border-b ${theme.border}`}>
          <View className="flex-row items-center mb-6">
            <Image
              source={{ uri: "https://i.pravatar.cc/150?img=12" }}
              className="w-24 h-24 rounded-full"
            />
            <View className="ml-4 flex-1">
              <Text className={`text-2xl font-bold ${theme.textPrimary}`}>John Doe</Text>
              <Text className={`${theme.textSecondary}`}>@johndoe</Text>
              <Link href="/profile" asChild>
                <TouchableOpacity 
                  className={`${theme.accent} rounded-full px-4 py-2 mt-2 self-start`}
                >
                  <Text className="text-white font-medium">Edit Profile</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>

          {/* Quick Stats */}
          <View className="flex-row justify-between">
            <View className="items-center flex-1">
              <Text className={`text-2xl font-bold ${theme.textPrimary}`}>12</Text>
              <Text className={`text-sm ${theme.textSecondary}`}>Day Streak</Text>
            </View>
            <View className="items-center flex-1">
              <Text className={`text-2xl font-bold ${theme.textPrimary}`}>87%</Text>
              <Text className={`text-sm ${theme.textSecondary}`}>Productivity</Text>
            </View>
            <View className="items-center flex-1">
              <Text className={`text-2xl font-bold ${theme.textPrimary}`}>24</Text>
              <Text className={`text-sm ${theme.textSecondary}`}>Tasks Done</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="mt-6">
          <SectionHeader title="Quick Actions" />
          <View className={theme.surface}>
            <Link href="/stats" asChild>
              <SettingsItem
                icon="stats-chart"
                label="Statistics"
                subtitle="View your detailed progress"
              />
            </Link>
            <View className={`h-[0.5px] ${theme.border} mx-4`} />
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
          <View className={theme.surface}>
            <SettingsItem
              icon="notifications-outline"
              label="Notifications"
              subtitle="Manage your alerts"
              showBadge={true}
            />
            <View className={`h-[0.5px] ${theme.border} mx-4`} />
            <SettingsItem
              icon="moon-outline"
              label="Dark Mode"
              rightElement={
                <Switch
                  value={isDarkMode}
                  onValueChange={setIsDarkMode}
                  trackColor={{ false: '#e2e8f0', true: '#4f46e5' }}
                  thumbColor={isDarkMode ? '#818cf8' : '#f1f5f9'}
                />
              }
              isLink={false}
            />
            <View className={`h-[0.5px] ${theme.border} mx-4`} />
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
          <View className={theme.surface}>
            <SettingsItem
              icon="help-circle-outline"
              label="Help & Support"
              subtitle="Get assistance and FAQs"
            />
            <View className={`h-[0.5px] ${theme.border} mx-4`} />
            <SettingsItem
              icon="document-text-outline"
              label="Terms & Privacy Policy"
              subtitle="Read our terms and conditions"
            />
            <View className={`h-[0.5px] ${theme.border} mx-4`} />
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
