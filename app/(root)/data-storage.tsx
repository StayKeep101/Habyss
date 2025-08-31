import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';

interface StorageItem {
  id: string;
  name: string;
  size: string;
  icon: string;
  color: string;
  category: 'app' | 'user' | 'cache' | 'media';
}

const DataStorage = () => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { lightFeedback, mediumFeedback } = useHaptics();

  const [storageItems, setStorageItems] = useState<StorageItem[]>([
    {
      id: '1',
      name: 'App Data',
      size: '45.2 MB',
      icon: 'apps',
      color: colors.primary,
      category: 'app'
    },
    {
      id: '2',
      name: 'User Data',
      size: '128.7 MB',
      icon: 'person',
      color: colors.success,
      category: 'user'
    },
    {
      id: '3',
      name: 'Cache Files',
      size: '23.1 MB',
      icon: 'folder',
      color: colors.warning,
      category: 'cache'
    },
    {
      id: '4',
      name: 'Media Files',
      size: '67.3 MB',
      icon: 'images',
      color: colors.secondary,
      category: 'media'
    },
    {
      id: '5',
      name: 'Logs',
      size: '12.8 MB',
      icon: 'document-text',
      color: colors.accent,
      category: 'app'
    }
  ]);

  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
  const [lastBackup, setLastBackup] = useState('2 hours ago');
  const [nextBackup, setNextBackup] = useState('In 22 hours');

  const totalStorage = storageItems.reduce((total, item) => {
    const size = parseFloat(item.size.split(' ')[0]);
    return total + size;
  }, 0);

  const handleClearCache = () => {
    lightFeedback();
    Alert.alert(
      'Clear Cache',
      'This will free up 23.1 MB of space. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => {
          setStorageItems(prev => prev.map(item => 
            item.category === 'cache' 
              ? { ...item, size: '0.0 MB' }
              : item
          ));
          Alert.alert('Success', 'Cache cleared successfully!');
        }}
      ]
    );
  };

  const handleBackupNow = () => {
    mediumFeedback();
    setSyncStatus('syncing');
    Alert.alert(
      'Backup Started',
      'Your data is being backed up to the cloud...',
      [{ text: 'OK' }]
    );
    
    // Simulate backup completion
    setTimeout(() => {
      setSyncStatus('synced');
      setLastBackup('Just now');
      Alert.alert('Backup Complete', 'Your data has been successfully backed up!');
    }, 3000);
  };

  const handleRestoreData = () => {
    lightFeedback();
    Alert.alert(
      'Restore Data',
      'This will replace your current data with the backup. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restore', style: 'destructive', onPress: () => {
          Alert.alert('Success', 'Data restored successfully!');
        }}
      ]
    );
  };

  const handleOptimizeStorage = () => {
    lightFeedback();
    Alert.alert(
      'Optimize Storage',
      'This will compress and optimize your data to save space.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Optimize', onPress: () => {
          // Simulate optimization
          setStorageItems(prev => prev.map(item => ({
            ...item,
            size: item.category === 'cache' ? '0.0 MB' : 
                  item.category === 'user' ? '98.2 MB' :
                  item.category === 'media' ? '45.1 MB' : item.size
          })));
          Alert.alert('Success', 'Storage optimized! Saved 67.8 MB of space.');
        }}
      ]
    );
  };

  const getSyncStatusColor = () => {
    switch (syncStatus) {
      case 'synced': return colors.success;
      case 'syncing': return colors.warning;
      case 'error': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const getSyncStatusIcon = () => {
    switch (syncStatus) {
      case 'synced': return 'checkmark-circle';
      case 'syncing': return 'sync';
      case 'error': return 'close-circle';
      default: return 'help-circle';
    }
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
                Data & Storage
              </Text>
              <Text className="text-sm" style={{ color: colors.textSecondary }}>
                Manage your data and storage
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-6">
        {/* Storage Overview */}
        <View className="mb-6">
          <View 
            className="p-6 rounded-2xl"
            style={{ backgroundColor: colors.primary }}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-white text-lg font-semibold">
                Total Storage Used
              </Text>
              <Text className="text-white text-2xl font-bold">
                {totalStorage.toFixed(1)} MB
              </Text>
            </View>
            <View className="w-full bg-white bg-opacity-20 rounded-full h-2 mb-4">
              <View 
                className="bg-white rounded-full h-2"
                style={{ width: `${Math.min((totalStorage / 500) * 100, 100)}%` }}
              />
            </View>
            <Text className="text-white text-sm opacity-80">
              {totalStorage.toFixed(1)} MB of 500 MB used
            </Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="mb-6">
          <Text className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
            Quick Actions
          </Text>
          <View className="flex-row space-x-3">
            <TouchableOpacity
              className="flex-1 p-4 rounded-2xl items-center"
              style={{ backgroundColor: colors.surfaceSecondary }}
              onPress={handleClearCache}
            >
              <Ionicons name="trash" size={24} color={colors.warning} />
              <Text className="font-semibold mt-2" style={{ color: colors.textPrimary }}>
                Clear Cache
              </Text>
              <Text className="text-xs text-center mt-1" style={{ color: colors.textSecondary }}>
                Free up space
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 p-4 rounded-2xl items-center"
              style={{ backgroundColor: colors.surfaceSecondary }}
              onPress={handleOptimizeStorage}
            >
              <Ionicons name="compass" size={24} color={colors.success} />
              <Text className="font-semibold mt-2" style={{ color: colors.textPrimary }}>
                Optimize
              </Text>
              <Text className="text-xs text-center mt-1" style={{ color: colors.textSecondary }}>
                Save space
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sync Status */}
        <View className="mb-6">
          <Text className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
            Cloud Sync
          </Text>
          <View 
            className="p-4 rounded-2xl"
            style={{ backgroundColor: colors.surfaceSecondary }}
          >
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                <Ionicons 
                  name={getSyncStatusIcon() as any} 
                  size={20} 
                  color={getSyncStatusColor()} 
                />
                <Text className="ml-2 font-semibold" style={{ color: colors.textPrimary }}>
                  Sync Status
                </Text>
              </View>
              <Text 
                className="text-sm font-medium"
                style={{ color: getSyncStatusColor() }}
              >
                {syncStatus === 'syncing' ? 'Syncing...' : 
                 syncStatus === 'synced' ? 'Synced' : 'Error'}
              </Text>
            </View>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sm" style={{ color: colors.textSecondary }}>
                Last Backup
              </Text>
              <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                {lastBackup}
              </Text>
            </View>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sm" style={{ color: colors.textSecondary }}>
                Next Backup
              </Text>
              <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                {nextBackup}
              </Text>
            </View>
            <View className="flex-row space-x-3">
              <TouchableOpacity
                className="flex-1 p-3 rounded-xl items-center"
                style={{ backgroundColor: colors.primary + '20' }}
                onPress={handleBackupNow}
                disabled={syncStatus === 'syncing'}
              >
                <Ionicons name="cloud-upload" size={16} color={colors.primary} />
                <Text className="text-sm font-medium mt-1" style={{ color: colors.primary }}>
                  Backup Now
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 p-3 rounded-xl items-center"
                style={{ backgroundColor: colors.success + '20' }}
                onPress={handleRestoreData}
              >
                <Ionicons name="cloud-download" size={16} color={colors.success} />
                <Text className="text-sm font-medium mt-1" style={{ color: colors.success }}>
                  Restore
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Storage Breakdown */}
        <View className="mb-6">
          <Text className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
            Storage Breakdown
          </Text>
          <View 
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: colors.surfaceSecondary }}
          >
            {storageItems.map((item, index) => (
              <View key={item.id}>
                <View className="flex-row items-center p-4">
                  <View 
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: item.color + '20' }}
                  >
                    <Ionicons name={item.icon as any} size={20} color={item.color} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-semibold" style={{ color: colors.textPrimary }}>
                      {item.name}
                    </Text>
                    <Text className="text-sm" style={{ color: colors.textSecondary }}>
                      {item.category.charAt(0).toUpperCase() + item.category.slice(1)} Data
                    </Text>
                  </View>
                  <Text className="font-semibold" style={{ color: colors.textPrimary }}>
                    {item.size}
                  </Text>
                </View>
                {index < storageItems.length - 1 && (
                  <View 
                    className="h-[0.5px] mx-4"
                    style={{ backgroundColor: colors.border }}
                  />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Storage Tips */}
        <View className="mb-6">
          <Text className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
            Storage Tips
          </Text>
          <View 
            className="p-4 rounded-2xl"
            style={{ backgroundColor: colors.success + '20' }}
          >
            <View className="flex-row items-center mb-2">
              <Ionicons name="bulb" size={20} color={colors.success} />
              <Text className="ml-2 font-semibold" style={{ color: colors.success }}>
                Save Space
              </Text>
            </View>
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              • Clear cache regularly to free up space{'\n'}
              • Optimize storage to compress data{'\n'}
              • Remove unused media files{'\n'}
              • Keep backups in the cloud
            </Text>
          </View>
        </View>

        {/* Bottom Spacing */}
        <View className="h-20" />
      </ScrollView>
    </SafeAreaView>
  );
};

export default DataStorage;
