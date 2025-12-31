import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Alert, TextInput, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeMode } from '@/constants/themeContext';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { IntegrationService } from '@/lib/integrationService';
import { NotificationService } from '@/lib/notificationService';
import { HealthService } from '@/lib/healthService';

import DateTimePicker from '@react-native-community/datetimepicker';

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

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  iconType: 'ionicons' | 'custom';
  color: string;
  connected: boolean;
  lastSync?: string;
  loading?: boolean;
  docUrl: string;
}

const Settings = () => {
  const { theme, setTheme } = useTheme();
  // We can trust theme is 'light' | 'abyss' | 'trueDark'
  const colors = Colors[theme];
  const { lightFeedback, mediumFeedback } = useHaptics();

  const [searchQuery, setSearchQuery] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(true);
  const [quietHours, setQuietHours] = useState({ start: '22:00', end: '07:00' });
  const [showPicker, setShowPicker] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    const loadNotificationSettings = async () => {
      const enabled = await NotificationService.areNotificationsEnabled();
      const qEnabled = await NotificationService.isQuietHoursEnabled();
      const qHours = await NotificationService.getQuietHours();
      setNotificationsEnabled(enabled);
      setQuietHoursEnabled(qEnabled);
      setQuietHours(qHours);

      // Update the settings list values
      setSettings(prev => prev.map(s => {
        if (s.id === '1') return { ...s, value: enabled };
        if (s.id === '11') return { ...s, value: qEnabled };
        return s;
      }));
    };
    loadNotificationSettings();
  }, []);

  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'apple-health',
      name: 'Apple Health',
      description: 'Sync steps, sleep, and heart rate data.',
      icon: 'heart',
      iconType: 'ionicons',
      color: '#FF2D55',
      connected: false,
      docUrl: 'https://www.apple.com/ios/health/'
    },
    {
      id: 'strava',
      name: 'Strava',
      description: 'Import your runs, rides, and swims.',
      icon: 'bicycle',
      iconType: 'ionicons',
      color: '#FC6100',
      connected: false,
      docUrl: 'https://www.strava.com/'
    },
    {
      id: 'spotify',
      name: 'Spotify',
      description: 'Track your focus music and podcasts.',
      icon: 'musical-notes',
      iconType: 'ionicons',
      color: '#1DB954',
      connected: false,
      docUrl: 'https://www.spotify.com/'
    },
    {
      id: 'duolingo',
      name: 'Duolingo',
      description: 'Monitor your language learning progress.',
      icon: 'language',
      iconType: 'ionicons',
      color: '#58CC02',
      connected: false,
      docUrl: 'https://www.duolingo.com/'
    },
    {
      id: 'plaid',
      name: 'Plaid',
      description: 'Sync financial habits and spending.',
      icon: 'wallet',
      iconType: 'ionicons',
      color: '#000000',
      connected: false,
      docUrl: 'https://plaid.com/'
    },
    {
      id: 'kindle',
      name: 'Kindle',
      description: 'Track your daily reading progress.',
      icon: 'book',
      iconType: 'ionicons',
      color: '#00A8E1',
      connected: false,
      docUrl: 'https://www.amazon.com/kindle-dbs/fd/kcp'
    },
    {
      id: 'garmin',
      name: 'Garmin Connect',
      description: 'Sync advanced fitness and health metrics.',
      icon: 'watch',
      iconType: 'ionicons',
      color: '#000000',
      connected: false,
      docUrl: 'https://connect.garmin.com/'
    }
  ]);

  const filteredIntegrations = useMemo(() => {
    if (!searchQuery) return integrations;
    const query = searchQuery.toLowerCase();
    return integrations.filter(i => 
      i.name.toLowerCase().includes(query) || 
      i.description.toLowerCase().includes(query)
    );
  }, [integrations, searchQuery]);

  const handleToggleIntegration = async (id: string) => {
    lightFeedback();
    
    // Find the integration
    const integration = integrations.find(i => i.id === id);
    if (!integration) return;

    if (integration.connected) {
      // Disconnect
      Alert.alert(
        'Disconnect Service',
        `Are you sure you want to disconnect ${integration.name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Disconnect', 
            style: 'destructive', 
            onPress: () => {
              setIntegrations(prev => prev.map(i => 
                i.id === id ? { ...i, connected: false, lastSync: undefined } : i
              ));
            } 
          }
        ]
      );
    } else {
      // Mock OAuth Flow
      setIntegrations(prev => prev.map(i => i.id === id ? { ...i, loading: true } : i));
      
      try {
        // Simulate network delay for OAuth
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Randomly succeed or fail for demo purposes
        const success = Math.random() > 0.1;
        
        if (success) {
          setIntegrations(prev => prev.map(i => 
            i.id === id ? { ...i, connected: true, loading: false, lastSync: 'Just now' } : i
          ));
          Alert.alert('Success', `Successfully connected to ${integration.name}!`);
        } else {
          throw new Error('OAuth process cancelled or failed.');
        }
      } catch (error) {
        setIntegrations(prev => prev.map(i => i.id === id ? { ...i, loading: false } : i));
        Alert.alert('Connection Failed', `Could not connect to ${integration.name}. Please try again.`);
      }
    }
  };

  const [settings, setSettings] = useState<SettingItem[]>([
    {
      id: '1',
      title: 'Notifications',
      subtitle: 'Receive reminders for your habits',
      icon: 'notifications',
      type: 'toggle',
      value: false
    },
    {
      id: '11',
      title: 'Quiet Hours',
      subtitle: 'Mute reminders during specific hours',
      icon: 'moon',
      type: 'toggle',
      value: true
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

  const toggleSetting = async (id: string) => {
    lightFeedback();
    
    // Handle persistent storage for notifications
    if (id === '1') {
      const newValue = !notificationsEnabled;
      setNotificationsEnabled(newValue);
      await NotificationService.setNotificationsEnabled(newValue);
      if (newValue) {
        await NotificationService.requestNotificationPermission();
      }
    } else if (id === '11') {
      const newValue = !quietHoursEnabled;
      setQuietHoursEnabled(newValue);
      await NotificationService.setQuietHoursEnabled(newValue);
    }

    setSettings(prev => {
      const updated = prev.map(setting => 
        setting.id === id 
          ? { ...setting, value: !setting.value }
          : setting
      );
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

  const handleLogout = () => {
    mediumFeedback();
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Log Out', 
          style: 'destructive', 
          onPress: async () => {
            const { error } = await supabase.auth.signOut();
            if (error) {
                Alert.alert("Error", error.message);
            } else {
                router.replace('/(auth)/welcome');
            }
          } 
        }
      ]
    );
  };

  const handleTimeChange = async (event: any, selectedDate?: Date) => {
    if (event.type === 'set' && selectedDate && showPicker) {
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;
      
      const newQuietHours = {
        ...quietHours,
        [showPicker]: timeStr
      };
      
      setQuietHours(newQuietHours);
      await NotificationService.setQuietHours(newQuietHours.start, newQuietHours.end);
      mediumFeedback();
    }
    setShowPicker(null);
  };

  const ThemeOption = ({ mode, label, icon }: { mode: ThemeMode; label: string; icon: any }) => {
      const isSelected = theme === mode;
      return (
          <TouchableOpacity 
              onPress={() => {
                  lightFeedback();
                  setTheme(mode);
              }}
              className="flex-1 items-center justify-center py-3 rounded-xl mx-1"
              style={{ 
                  backgroundColor: isSelected ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: isSelected ? colors.primary : colors.border
              }}
          >
              <Ionicons name={icon as any} size={24} color={isSelected ? 'white' : colors.textSecondary} />
              <Text className="text-sm font-semibold mt-1" style={{ color: isSelected ? 'white' : colors.textSecondary }}>
                  {label}
              </Text>
          </TouchableOpacity>
      )
  }

  const IntegrationRow = ({ integration }: { integration: Integration }) => (
    <View 
      key={integration.id}
      className="p-4 rounded-2xl mb-4"
      style={{ backgroundColor: colors.surfaceSecondary }}
    >
      <View className="flex-row items-center mb-3">
        <View 
          className="w-12 h-12 rounded-full items-center justify-center mr-4"
          style={{ backgroundColor: integration.color + '20' }}
        >
          <Ionicons name={integration.icon as any} size={24} color={integration.color} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>
              {integration.name}
            </Text>
            {integration.loading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Switch
                value={integration.connected}
                onValueChange={() => handleToggleIntegration(integration.id)}
                trackColor={{ false: '#e2e8f0', true: colors.primary }}
                thumbColor={integration.connected ? 'white' : '#f1f5f9'}
              />
            )}
          </View>
          <Text className="text-sm" style={{ color: colors.textSecondary }}>
            {integration.description}
          </Text>
        </View>
      </View>

      {integration.connected && (
        <TouchableOpacity 
          className="mb-3 py-2 px-4 rounded-xl flex-row items-center justify-center border"
          style={{ borderColor: colors.border, backgroundColor: colors.surface }}
          onPress={() => Alert.alert('Configuration', `Manage settings for ${integration.name}`)}
        >
          <Ionicons name="settings-outline" size={16} color={colors.textPrimary} className="mr-2" />
          <Text className="font-semibold text-sm" style={{ color: colors.textPrimary }}>Configure {integration.name}</Text>
        </TouchableOpacity>
      )}

      <View className="flex-row items-center justify-between pt-3 border-t" style={{ borderColor: colors.border }}>
        <View className="flex-row items-center">
          <View 
            className="w-2 h-2 rounded-full mr-2"
            style={{ backgroundColor: integration.connected ? colors.success : colors.textTertiary }}
          />
          <Text className="text-xs" style={{ color: colors.textSecondary }}>
            {integration.connected ? `Connected • Last sync: ${integration.lastSync}` : 'Disconnected'}
          </Text>
        </View>
        <TouchableOpacity 
          onPress={() => Linking.openURL(integration.docUrl)}
          className="flex-row items-center"
        >
          <Text className="text-xs mr-1" style={{ color: colors.primary }}>Learn more</Text>
          <Ionicons name="open-outline" size={12} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

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
        {/* Appearance Section */}
        <View className="mb-6">
            <Text className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
                Appearance
            </Text>
            <View 
                className="p-2 rounded-2xl flex-row"
                style={{ backgroundColor: colors.surfaceSecondary }}
            >
                <ThemeOption mode="light" label="Light" icon="sunny" />
                <ThemeOption mode="abyss" label="Abyss" icon="moon" />
                <ThemeOption mode="trueDark" label="Pure Dark" icon="contrast" />
            </View>
        </View>

        {/* Quiet Hours Picker (Visible if notifications & quiet hours enabled) */}
        {notificationsEnabled && quietHoursEnabled && (
          <View className="mb-6">
            <Text className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
              Quiet Hours Schedule
            </Text>
            <View 
              className="p-4 rounded-2xl flex-row justify-between items-center"
              style={{ backgroundColor: colors.surfaceSecondary }}
            >
              <TouchableOpacity 
                onPress={() => {
                  lightFeedback();
                  setShowPicker('start');
                }}
                className="flex-1 items-center p-2 rounded-xl"
                style={{ backgroundColor: colors.surface }}
              >
                <Text className="text-xs mb-1" style={{ color: colors.textSecondary }}>Starts at</Text>
                <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>{quietHours.start}</Text>
              </TouchableOpacity>
              
              <View className="px-4">
                <Ionicons name="arrow-forward" size={20} color={colors.textTertiary} />
              </View>

              <TouchableOpacity 
                onPress={() => {
                  lightFeedback();
                  setShowPicker('end');
                }}
                className="flex-1 items-center p-2 rounded-xl"
                style={{ backgroundColor: colors.surface }}
              >
                <Text className="text-xs mb-1" style={{ color: colors.textSecondary }}>Ends at</Text>
                <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>{quietHours.end}</Text>
              </TouchableOpacity>
            </View>

            {showPicker && (
              <DateTimePicker
                value={(() => {
                  const [h, m] = quietHours[showPicker].split(':').map(Number);
                  const d = new Date();
                  d.setHours(h, m, 0, 0);
                  return d;
                })()}
                mode="time"
                is24Hour={true}
                display="default"
                onChange={handleTimeChange}
              />
            )}

            <Text className="text-xs mt-2 px-2" style={{ color: colors.textSecondary }}>
              Notifications scheduled during these hours will be delayed until quiet hours end.
            </Text>
          </View>
        )}

        {/* App Preferences */}
        <View className="mb-6">
          <Text className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
            App Preferences
          </Text>
          <View 
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: colors.surfaceSecondary }}
          >
            {settings.slice(0, 5).map((setting, index) => (
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
                </TouchableOpacity>
                {index < 4 && (
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
            {settings.slice(5, 8).map((setting, index) => (
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
            {settings.slice(8).map((setting, index) => (
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

        {/* Integrations Section */}
        <View className="mb-8">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
              Integrations
            </Text>
            {integrations.some(i => i.connected) && (
              <View 
                className="px-3 py-1 rounded-full"
                style={{ backgroundColor: colors.success + '20' }}
              >
                <Text className="text-xs font-bold" style={{ color: colors.success }}>
                  {integrations.filter(i => i.connected).length} Connected
                </Text>
              </View>
            )}
          </View>

          {/* Search Bar */}
          <View 
            className="flex-row items-center px-4 py-3 rounded-2xl mb-6 border"
            style={{ 
              backgroundColor: colors.surface,
              borderColor: colors.border
            }}
          >
            <Ionicons name="search" size={20} color={colors.textTertiary} />
            <TextInput
              className="flex-1 ml-3 text-base"
              placeholder="Search services..."
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{ color: colors.textPrimary }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          {filteredIntegrations.length > 0 ? (
            filteredIntegrations.map((integration) => (
              <IntegrationRow key={integration.id} integration={integration} />
            ))
          ) : (
            <View className="py-10 items-center justify-center">
              <Ionicons name="search-outline" size={48} color={colors.textTertiary} />
              <Text className="text-lg font-semibold mt-4" style={{ color: colors.textPrimary }}>
                No services found
              </Text>
              <Text className="text-sm text-center mt-2 px-10" style={{ color: colors.textSecondary }}>
                Try searching for a different service name or description.
              </Text>
            </View>
          )}
        </View>

        {/* Reset Settings & Logout */}
        <View className="mb-6 gap-4">
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

          <TouchableOpacity
            className="p-4 rounded-2xl items-center border"
            style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={24} color={colors.textPrimary} />
            <Text className="font-semibold mt-2" style={{ color: colors.textPrimary }}>
              Log Out
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
