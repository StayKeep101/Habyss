import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';

interface PrivacySetting {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  enabled: boolean;
  category: 'data' | 'sharing' | 'security' | 'analytics';
}

const Privacy = () => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { lightFeedback, mediumFeedback } = useHaptics();

  const [privacySettings, setPrivacySettings] = useState<PrivacySetting[]>([
    {
      id: '1',
      title: 'Data Collection',
      subtitle: 'Allow us to collect usage data to improve the app',
      icon: 'analytics',
      enabled: true,
      category: 'data'
    },
    {
      id: '2',
      title: 'Crash Reports',
      subtitle: 'Send crash reports to help fix bugs',
      icon: 'bug',
      enabled: true,
      category: 'data'
    },
    {
      id: '3',
      title: 'Personalized Ads',
      subtitle: 'Show ads based on your interests',
      icon: 'megaphone',
      enabled: false,
      category: 'sharing'
    },
    {
      id: '4',
      title: 'Share Progress',
      subtitle: 'Allow friends to see your progress',
      icon: 'share-social',
      enabled: true,
      category: 'sharing'
    },
    {
      id: '5',
      title: 'Biometric Lock',
      subtitle: 'Use Face ID or Touch ID to unlock the app',
      icon: 'finger-print',
      enabled: false,
      category: 'security'
    },
    {
      id: '6',
      title: 'Auto-Lock',
      subtitle: 'Lock app after 5 minutes of inactivity',
      icon: 'lock-closed',
      enabled: true,
      category: 'security'
    },
    {
      id: '7',
      title: 'Usage Analytics',
      subtitle: 'Help improve the app with anonymous usage data',
      icon: 'bar-chart',
      enabled: true,
      category: 'analytics'
    },
    {
      id: '8',
      title: 'Performance Monitoring',
      subtitle: 'Monitor app performance and stability',
      icon: 'speedometer',
      enabled: true,
      category: 'analytics'
    }
  ]);

  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  const [locationSharing, setLocationSharing] = useState(false);

  const togglePrivacySetting = (id: string) => {
    lightFeedback();
    setPrivacySettings(prev => 
      prev.map(setting => 
        setting.id === id 
          ? { ...setting, enabled: !setting.enabled }
          : setting
      )
    );
  };

  const handleDeleteAccount = () => {
    mediumFeedback();
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirm Deletion',
              'Are you absolutely sure? This will delete all your habits, progress, and data.',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Delete Account', 
                  style: 'destructive',
                  onPress: () => {
                    Alert.alert('Account Deleted', 'Your account has been permanently deleted.');
                  }
                }
              ]
            );
          }
        }
      ]
    );
  };

  const handleDownloadData = () => {
    lightFeedback();
    Alert.alert(
      'Download Data',
      'Your personal data will be prepared and sent to your email address.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Download', onPress: () => {
          Alert.alert('Success', 'Data download started! You\'ll receive an email shortly.');
        }}
      ]
    );
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'data': return colors.primary;
      case 'sharing': return colors.success;
      case 'security': return colors.warning;
      case 'analytics': return colors.secondary;
      default: return colors.primary;
    }
  };

  const groupedSettings = privacySettings.reduce((acc, setting) => {
    if (!acc[setting.category]) {
      acc[setting.category] = [];
    }
    acc[setting.category].push(setting);
    return acc;
  }, {} as Record<string, PrivacySetting[]>);

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
                Privacy
              </Text>
              <Text className="text-sm" style={{ color: colors.textSecondary }}>
                Control your data and privacy
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-6">
        {/* Privacy Overview */}
        <View className="mb-6">
          <View 
            className="p-4 rounded-2xl"
            style={{ backgroundColor: colors.primary + '20' }}
          >
            <View className="flex-row items-center mb-2">
              <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
              <Text className="ml-2 text-lg font-semibold" style={{ color: colors.primary }}>
                Your Privacy Matters
              </Text>
            </View>
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              We respect your privacy and give you full control over your data. 
              You can customize these settings at any time.
            </Text>
          </View>
        </View>

        {/* Security Settings */}
        <View className="mb-6">
          <Text className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
            Security
          </Text>
          <View 
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: colors.surfaceSecondary }}
          >
            <TouchableOpacity className="flex-row items-center p-4">
              <View 
                className="w-10 h-10 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: colors.warning + '20' }}
              >
                <Ionicons name="finger-print" size={20} color={colors.warning} />
              </View>
              <View className="flex-1">
                <Text className="font-semibold" style={{ color: colors.textPrimary }}>
                  Two-Factor Authentication
                </Text>
                <Text className="text-sm" style={{ color: colors.textSecondary }}>
                  Add an extra layer of security
                </Text>
              </View>
              <Switch
                value={twoFactorAuth}
                onValueChange={() => {
                  lightFeedback();
                  setTwoFactorAuth(!twoFactorAuth);
                }}
                trackColor={{ false: '#e2e8f0', true: colors.warning }}
                thumbColor={twoFactorAuth ? 'white' : '#f1f5f9'}
              />
            </TouchableOpacity>
            <View 
              className="h-[0.5px] mx-4"
              style={{ backgroundColor: colors.border }}
            />
            <TouchableOpacity className="flex-row items-center p-4">
              <View 
                className="w-10 h-10 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: colors.primary + '20' }}
              >
                <Ionicons name="location" size={20} color={colors.primary} />
              </View>
              <View className="flex-1">
                <Text className="font-semibold" style={{ color: colors.textPrimary }}>
                  Location Services
                </Text>
                <Text className="text-sm" style={{ color: colors.textSecondary }}>
                  Use location for habit context
                </Text>
              </View>
              <Switch
                value={locationSharing}
                onValueChange={() => {
                  lightFeedback();
                  setLocationSharing(!locationSharing);
                }}
                trackColor={{ false: '#e2e8f0', true: colors.primary }}
                thumbColor={locationSharing ? 'white' : '#f1f5f9'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Privacy Categories */}
        {Object.entries(groupedSettings).map(([category, categorySettings]) => (
          <View key={category} className="mb-6">
            <Text className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
              {category.charAt(0).toUpperCase() + category.slice(1)} & Privacy
            </Text>
            <View 
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: colors.surfaceSecondary }}
            >
              {categorySettings.map((setting, index) => (
                <View key={setting.id}>
                  <TouchableOpacity
                    className="flex-row items-center p-4"
                    onPress={() => togglePrivacySetting(setting.id)}
                  >
                    <View 
                      className="w-10 h-10 rounded-full items-center justify-center mr-3"
                      style={{ backgroundColor: getCategoryColor(setting.category) + '20' }}
                    >
                      <Ionicons 
                        name={setting.icon as any} 
                        size={20} 
                        color={getCategoryColor(setting.category)} 
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold" style={{ color: colors.textPrimary }}>
                        {setting.title}
                      </Text>
                      <Text className="text-sm" style={{ color: colors.textSecondary }}>
                        {setting.subtitle}
                      </Text>
                    </View>
                    <Switch
                      value={setting.enabled}
                      onValueChange={() => togglePrivacySetting(setting.id)}
                      trackColor={{ false: '#e2e8f0', true: getCategoryColor(setting.category) }}
                      thumbColor={setting.enabled ? 'white' : '#f1f5f9'}
                    />
                  </TouchableOpacity>
                  {index < categorySettings.length - 1 && (
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

        {/* Data Management */}
        <View className="mb-6">
          <Text className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
            Data Management
          </Text>
          <View className="space-y-3">
            <TouchableOpacity
              className="flex-row items-center p-4 rounded-2xl"
              style={{ backgroundColor: colors.surfaceSecondary }}
              onPress={handleDownloadData}
            >
              <View 
                className="w-10 h-10 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: colors.success + '20' }}
              >
                <Ionicons name="download" size={20} color={colors.success} />
              </View>
              <View className="flex-1">
                <Text className="font-semibold" style={{ color: colors.textPrimary }}>
                  Download My Data
                </Text>
                <Text className="text-sm" style={{ color: colors.textSecondary }}>
                  Get a copy of all your data
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center p-4 rounded-2xl"
              style={{ backgroundColor: colors.error + '20' }}
              onPress={handleDeleteAccount}
            >
              <View 
                className="w-10 h-10 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: colors.error + '40' }}
              >
                <Ionicons name="trash" size={20} color={colors.error} />
              </View>
              <View className="flex-1">
                <Text className="font-semibold" style={{ color: colors.error }}>
                  Delete Account
                </Text>
                <Text className="text-sm" style={{ color: colors.textSecondary }}>
                  Permanently delete your account and data
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Privacy Policy */}
        <View className="mb-6">
          <View 
            className="p-4 rounded-2xl"
            style={{ backgroundColor: colors.surfaceSecondary }}
          >
            <View className="flex-row items-center mb-3">
              <Ionicons name="document-text" size={20} color={colors.primary} />
              <Text className="ml-2 font-semibold" style={{ color: colors.textPrimary }}>
                Privacy Policy
              </Text>
            </View>
            <Text className="text-sm mb-3" style={{ color: colors.textSecondary }}>
              Read our complete privacy policy to understand how we collect, use, and protect your data.
            </Text>
            <TouchableOpacity
              className="p-3 rounded-xl items-center"
              style={{ backgroundColor: colors.primary + '20' }}
              onPress={() => {
                lightFeedback();
                Alert.alert('Privacy Policy', 'Privacy policy will open in your browser.');
              }}
            >
              <Text className="font-medium" style={{ color: colors.primary }}>
                Read Privacy Policy
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Spacing */}
        <View className="h-20" />
      </ScrollView>
    </SafeAreaView>
  );
};

export default Privacy;
