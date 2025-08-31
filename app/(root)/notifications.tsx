import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';

interface NotificationSetting {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  enabled: boolean;
  category: 'general' | 'habits' | 'focus' | 'reminders';
}

const Notifications = () => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { lightFeedback, mediumFeedback } = useHaptics();

  const [notifications, setNotifications] = useState<NotificationSetting[]>([
    {
      id: '1',
      title: 'Daily Reminders',
      subtitle: 'Get reminded about your daily habits',
      icon: 'notifications',
      enabled: true,
      category: 'general'
    },
    {
      id: '2',
      title: 'Habit Streaks',
      subtitle: 'Celebrate your habit milestones',
      icon: 'flame',
      enabled: true,
      category: 'habits'
    },
    {
      id: '3',
      title: 'Focus Sessions',
      subtitle: 'Start and end focus timer notifications',
      icon: 'timer',
      enabled: true,
      category: 'focus'
    },
    {
      id: '4',
      title: 'Water Reminders',
      subtitle: 'Stay hydrated throughout the day',
      icon: 'water',
      enabled: false,
      category: 'reminders'
    },
    {
      id: '5',
      title: 'Break Reminders',
      subtitle: 'Take regular breaks during work',
      icon: 'cafe',
      enabled: true,
      category: 'reminders'
    },
    {
      id: '6',
      title: 'Weekly Reports',
      subtitle: 'Get your weekly progress summary',
      icon: 'stats-chart',
      enabled: true,
      category: 'general'
    },
    {
      id: '7',
      title: 'Goal Milestones',
      subtitle: 'Celebrate when you reach goals',
      icon: 'trophy',
      enabled: true,
      category: 'habits'
    },
    {
      id: '8',
      title: 'Bedtime Reminder',
      subtitle: 'Get ready for a good night\'s sleep',
      icon: 'bed',
      enabled: false,
      category: 'reminders'
    }
  ]);

  const [quietHours, setQuietHours] = useState(false);
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('08:00');

  const toggleNotification = (id: string) => {
    lightFeedback();
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, enabled: !notification.enabled }
          : notification
      )
    );
  };

  const toggleQuietHours = () => {
    mediumFeedback();
    setQuietHours(!quietHours);
  };

  const handleTestNotification = () => {
    lightFeedback();
    Alert.alert(
      'Test Notification',
      'This is a test notification from Habyss!',
      [{ text: 'OK' }]
    );
  };

  const handleSaveSettings = () => {
    mediumFeedback();
    Alert.alert(
      'Settings Saved',
      'Your notification preferences have been saved successfully!',
      [{ text: 'OK' }]
    );
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'general': return colors.primary;
      case 'habits': return colors.success;
      case 'focus': return colors.secondary;
      case 'reminders': return colors.warning;
      default: return colors.primary;
    }
  };

  const groupedNotifications = notifications.reduce((acc, notification) => {
    if (!acc[notification.category]) {
      acc[notification.category] = [];
    }
    acc[notification.category].push(notification);
    return acc;
  }, {} as Record<string, NotificationSetting[]>);

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
                Notifications
              </Text>
              <Text className="text-sm" style={{ color: colors.textSecondary }}>
                Manage your alerts and reminders
              </Text>
            </View>
          </View>
          <TouchableOpacity 
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.primary }}
            onPress={handleSaveSettings}
          >
            <Ionicons name="checkmark" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1 px-6">
        {/* Quick Actions */}
        <View className="mb-6">
          <View 
            className="p-4 rounded-2xl"
            style={{ backgroundColor: colors.surfaceSecondary }}
          >
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                Quick Actions
              </Text>
            </View>
            <View className="flex-row space-x-3">
              <TouchableOpacity
                className="flex-1 p-3 rounded-xl items-center"
                style={{ backgroundColor: colors.primary + '20' }}
                onPress={handleTestNotification}
              >
                <Ionicons name="notifications" size={20} color={colors.primary} />
                <Text className="text-sm font-medium mt-1" style={{ color: colors.primary }}>
                  Test
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 p-3 rounded-xl items-center"
                style={{ backgroundColor: colors.success + '20' }}
                onPress={() => {
                  lightFeedback();
                  setNotifications(prev => prev.map(n => ({ ...n, enabled: true })));
                }}
              >
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text className="text-sm font-medium mt-1" style={{ color: colors.success }}>
                  Enable All
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 p-3 rounded-xl items-center"
                style={{ backgroundColor: colors.error + '20' }}
                onPress={() => {
                  lightFeedback();
                  setNotifications(prev => prev.map(n => ({ ...n, enabled: false })));
                }}
              >
                <Ionicons name="close-circle" size={20} color={colors.error} />
                <Text className="text-sm font-medium mt-1" style={{ color: colors.error }}>
                  Disable All
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Quiet Hours */}
        <View className="mb-6">
          <Text className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
            Quiet Hours
          </Text>
          <View 
            className="p-4 rounded-2xl"
            style={{ backgroundColor: colors.surfaceSecondary }}
          >
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                <Ionicons name="moon" size={20} color={colors.primary} />
                <Text className="ml-2 font-medium" style={{ color: colors.textPrimary }}>
                  Do Not Disturb
                </Text>
              </View>
              <Switch
                value={quietHours}
                onValueChange={toggleQuietHours}
                trackColor={{ false: '#e2e8f0', true: colors.primary }}
                thumbColor={quietHours ? 'white' : '#f1f5f9'}
              />
            </View>
            {quietHours && (
              <View className="flex-row items-center space-x-4">
                <View className="flex-1">
                  <Text className="text-sm" style={{ color: colors.textSecondary }}>
                    Start Time
                  </Text>
                  <Text className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                    {quietStart}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm" style={{ color: colors.textSecondary }}>
                    End Time
                  </Text>
                  <Text className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                    {quietEnd}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Notification Categories */}
        {Object.entries(groupedNotifications).map(([category, categoryNotifications]) => (
          <View key={category} className="mb-6">
            <Text className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
              {category.charAt(0).toUpperCase() + category.slice(1)} Notifications
            </Text>
            <View 
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: colors.surfaceSecondary }}
            >
              {categoryNotifications.map((notification, index) => (
                <View key={notification.id}>
                  <TouchableOpacity
                    className="flex-row items-center p-4"
                    onPress={() => toggleNotification(notification.id)}
                  >
                    <View 
                      className="w-10 h-10 rounded-full items-center justify-center mr-3"
                      style={{ backgroundColor: getCategoryColor(notification.category) + '20' }}
                    >
                      <Ionicons 
                        name={notification.icon as any} 
                        size={20} 
                        color={getCategoryColor(notification.category)} 
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold" style={{ color: colors.textPrimary }}>
                        {notification.title}
                      </Text>
                      <Text className="text-sm" style={{ color: colors.textSecondary }}>
                        {notification.subtitle}
                      </Text>
                    </View>
                    <Switch
                      value={notification.enabled}
                      onValueChange={() => toggleNotification(notification.id)}
                      trackColor={{ false: '#e2e8f0', true: getCategoryColor(notification.category) }}
                      thumbColor={notification.enabled ? 'white' : '#f1f5f9'}
                    />
                  </TouchableOpacity>
                  {index < categoryNotifications.length - 1 && (
                    <View 
                      className="h-[0.5px] mx-4"
                      style={{ backgroundColor: colors.border }}
                    />
                  )}
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Bottom Spacing */}
        <View className="h-20" />
      </ScrollView>
    </SafeAreaView>
  );
};

export default Notifications;
