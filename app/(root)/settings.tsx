import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTheme } from '@/constants/themeContext';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';

interface SettingItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  type: 'toggle' | 'navigation' | 'action';
  value?: boolean;
  route?: string;
  action?: () => void;
}

const Settings = () => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { lightFeedback, mediumFeedback } = useHaptics();
  const { isDarkMode, toggleTheme } = useTheme();

  const [settings, setSettings] = useState<SettingItem[]>([
    {
      id: '1',
      title: isDarkMode ? 'Light Mode' : 'Dark Mode',
      subtitle: isDarkMode ? 'Switch to light theme' : 'Use dark theme throughout the app',
      icon: isDarkMode ? 'sunny' : 'moon',
      type: 'toggle',
      value: isDarkMode
    },
    {
      id: '2',
      title: 'Haptic Feedback',
      subtitle: 'Feel vibrations when interacting',
      icon: 'phone-portrait',
      type: 'toggle',
      value: true
    },
    {
      id: '3',
      title: 'Sound Effects',
      subtitle: 'Play sounds for notifications',
      icon: 'volume-high',
      type: 'toggle',
      value: true
    },
    {
      id: '4',
      title: 'Auto-sync',
      subtitle: 'Sync data across devices',
      icon: 'sync',
      type: 'toggle',
      value: true
    },
    {
      id: '5',
      title: 'Notifications',
      subtitle: 'Manage your alerts and reminders',
      icon: 'notifications',
      type: 'navigation',
      route: '/notifications'
    },
    {
      id: '6',
      title: 'Privacy',
      subtitle: 'Manage your privacy settings',
      icon: 'lock-closed',
      type: 'navigation',
      route: '/privacy'
    },
    {
      id: '7',
      title: 'Data & Storage',
      subtitle: 'Manage your data and storage',
      icon: 'cloud',
      type: 'navigation',
      route: '/data-storage'
    },
    {
      id: '8',
      title: 'Export Data',
      subtitle: 'Download your data',
      icon: 'download',
      type: 'action',
      action: () => {
        lightFeedback();
        Alert.alert(
          'Export Data',
          'Your data will be exported and sent to your email.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Export', onPress: () => {
              Alert.alert('Success', 'Data export started! You\'ll receive an email shortly.');
            }}
          ]
        );
      }
    },
    {
      id: '9',
      title: 'Backup & Restore',
      subtitle: 'Backup or restore your data',
      icon: 'cloud-upload',
      type: 'action',
      action: () => {
        lightFeedback();
        Alert.alert(
          'Backup & Restore',
          'Choose an option:',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Backup Now', onPress: () => {
              Alert.alert('Success', 'Backup completed successfully!');
            }},
            { text: 'Restore', onPress: () => {
              Alert.alert('Restore', 'Restore from previous backup?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Restore', style: 'destructive', onPress: () => {
                  Alert.alert('Success', 'Data restored successfully!');
                }}
              ]);
            }}
          ]
        );
      }
    },
    {
      id: '10',
      title: 'Clear Cache',
      subtitle: 'Free up storage space',
      icon: 'trash',
      type: 'action',
      action: () => {
        lightFeedback();
        Alert.alert(
          'Clear Cache',
          'This will clear all cached data. Continue?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear', style: 'destructive', onPress: () => {
              Alert.alert('Success', 'Cache cleared successfully!');
            }}
          ]
        );
      }
    }
  ]);

  // Keep the Dark/Light row title and icon in sync with theme changes
  useEffect(() => {
    setSettings(prev => prev.map(s => s.id === '1' ? {
      ...s,
      title: isDarkMode ? 'Light Mode' : 'Dark Mode',
      subtitle: isDarkMode ? 'Switch to light theme' : 'Use dark theme throughout the app',
      icon: isDarkMode ? 'sunny' : 'moon',
      value: isDarkMode,
    } : s));
  }, [isDarkMode]);

  const toggleSetting = (id: string) => {
    lightFeedback();
    setSettings(prev => {
      const updated = prev.map(setting => 
        setting.id === id 
          ? { ...setting, value: !setting.value }
          : setting
      );
      // If toggling dark mode, also flip theme and update title/icon
      if (id === '1') {
        toggleTheme();
        return updated.map(s => s.id === '1' ? {
          ...s,
          title: !isDarkMode ? 'Light Mode' : 'Dark Mode',
          subtitle: !isDarkMode ? 'Switch to light theme' : 'Use dark theme throughout the app',
          icon: !isDarkMode ? 'sunny' : 'moon',
        } : s);
      }
      return updated;
    });
  };

  const handleSettingPress = (setting: SettingItem) => {
    if (setting.type === 'toggle') {
      toggleSetting(setting.id);
    } else if (setting.type === 'navigation' && setting.route) {
      lightFeedback();
      if (setting.route === '/notifications') {
        router.push('/notifications');
      } else if (setting.route === '/privacy') {
        router.push('/privacy');
      } else if (setting.route === '/data-storage') {
        router.push('/data-storage');
      }
    } else if (setting.type === 'action' && setting.action) {
      setting.action();
    }
  };

  const handleResetSettings = () => {
    mediumFeedback();
    Alert.alert(
      'Reset Settings',
      'This will reset all settings to default. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => {
          Alert.alert('Success', 'Settings reset to default!');
        }}
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="px-6 pt-4 pb-6">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <TouchableOpacity 
              className="w-10 h-10 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: colors.surfaceSecondary }}
              onPress={() => {
                lightFeedback();
                router.back();
              }}
            >
              <Ionicons name="arrow-back" size={20} color={colors.primary} />
            </TouchableOpacity>
            <View>
              <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                Settings
              </Text>
              <Text className="text-sm" style={{ color: colors.textSecondary }}>
                Customize your app experience
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-6">
        {/* App Preferences */}
        <View className="mb-6">
          <Text className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
            App Preferences
          </Text>
          <View 
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: colors.surfaceSecondary }}
          >
            {settings.slice(0, 4).map((setting, index) => (
              <View key={setting.id}>
                <TouchableOpacity
                  className="flex-row items-center p-4"
                  onPress={() => handleSettingPress(setting)}
                >
                  <View 
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: colors.primary + '20' }}
                  >
                    <Ionicons name={setting.icon as any} size={20} color={colors.primary} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-semibold" style={{ color: colors.textPrimary }}>
                      {setting.title}
                    </Text>
                    {setting.subtitle && (
                      <Text className="text-sm" style={{ color: colors.textSecondary }}>
                        {setting.subtitle}
                      </Text>
                    )}
                  </View>
                  {setting.type === 'toggle' && (
                    <Switch
                      value={setting.value}
                      onValueChange={() => handleSettingPress(setting)}
                      trackColor={{ false: '#e2e8f0', true: colors.primary }}
                      thumbColor={setting.value ? 'white' : '#f1f5f9'}
                    />
                  )}
                  {setting.type === 'navigation' && (
                    <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                  )}
                  {setting.type === 'action' && (
                    <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                  )}
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

        {/* Account & Privacy */}
        <View className="mb-6">
          <Text className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
            Account & Privacy
          </Text>
          <View 
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: colors.surfaceSecondary }}
          >
            {settings.slice(4, 7).map((setting, index) => (
              <View key={setting.id}>
                <TouchableOpacity
                  className="flex-row items-center p-4"
                  onPress={() => handleSettingPress(setting)}
                >
                  <View 
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: colors.success + '20' }}
                  >
                    <Ionicons name={setting.icon as any} size={20} color={colors.success} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-semibold" style={{ color: colors.textPrimary }}>
                      {setting.title}
                    </Text>
                    {setting.subtitle && (
                      <Text className="text-sm" style={{ color: colors.textSecondary }}>
                        {setting.subtitle}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                </TouchableOpacity>
                {index < 2 && (
                  <View 
                    className="h-[0.5px] mx-4"
                    style={{ backgroundColor: colors.border }}
                  />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Data Management */}
        <View className="mb-6">
          <Text className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
            Data Management
          </Text>
          <View 
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: colors.surfaceSecondary }}
          >
            {settings.slice(7).map((setting, index) => (
              <View key={setting.id}>
                <TouchableOpacity
                  className="flex-row items-center p-4"
                  onPress={() => handleSettingPress(setting)}
                >
                  <View 
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: colors.warning + '20' }}
                  >
                    <Ionicons name={setting.icon as any} size={20} color={colors.warning} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-semibold" style={{ color: colors.textPrimary }}>
                      {setting.title}
                    </Text>
                    {setting.subtitle && (
                      <Text className="text-sm" style={{ color: colors.textSecondary }}>
                        {setting.subtitle}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                </TouchableOpacity>
                {index < 2 && (
                  <View 
                    className="h-[0.5px] mx-4"
                    style={{ backgroundColor: colors.border }}
                  />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Reset Settings */}
        <View className="mb-6">
          <TouchableOpacity
            className="p-4 rounded-2xl items-center"
            style={{ backgroundColor: colors.error + '20' }}
            onPress={handleResetSettings}
          >
            <Ionicons name="refresh" size={24} color={colors.error} />
            <Text className="font-semibold mt-2" style={{ color: colors.error }}>
              Reset All Settings
            </Text>
            <Text className="text-sm text-center mt-1" style={{ color: colors.textSecondary }}>
              Reset to default preferences
            </Text>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View className="mb-6">
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

export default Settings;
