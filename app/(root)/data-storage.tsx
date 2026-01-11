import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAccentGradient } from '@/constants/AccentContext';

import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import { useTheme } from '@/constants/themeContext';

const DataStorage = () => {
  // const colorScheme = useColorScheme();
  const { theme } = useTheme();
  const colors = Colors[theme];
  const isLight = theme === 'light';
  const isTrueDark = theme === 'trueDark';
  const { primary: accentColor, colors: accentColors } = useAccentGradient();
  const { lightFeedback, successFeedback } = useHaptics();

  const [isBackingUp, setIsBackingUp] = useState(false);
  const [lastBackup, setLastBackup] = useState('Never');

  const handleBackup = async () => {
    lightFeedback();
    setIsBackingUp(true);
    // Simulate backup
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsBackingUp(false);
    setLastBackup(new Date().toLocaleDateString());
    successFeedback();
    Alert.alert('Backup Complete', 'Your data has been backed up successfully.');
  };

  const handleRestore = () => {
    Alert.alert(
      'Restore Data',
      'This will replace your current data with the last backup. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restore', onPress: () => Alert.alert('Restored', 'Data restored successfully.') }
      ]
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will clear cached data. Your habits and settings will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear', onPress: () => {
            successFeedback();
            Alert.alert('Cache Cleared', 'Cache has been cleared.');
          }
        }
      ]
    );
  };

  return (
    <VoidShell>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Backup & Storage</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Backup Status */}
          <VoidCard
            glass={!isTrueDark}
            intensity={isLight ? 20 : 80}
            style={[
              styles.card,
              {
                backgroundColor: isLight ? colors.surfaceSecondary : undefined,
                borderColor: colors.border
              }
            ]}
          >
            <View style={styles.statusRow}>
              <View>
                <Text style={[styles.label, { color: colors.textPrimary }]}>Last Backup</Text>
                <Text style={[styles.value, { color: colors.textSecondary }]}>{lastBackup}</Text>
              </View>
              <Ionicons name="cloud-done-outline" size={28} color={accentColor} />
            </View>
          </VoidCard>

          {/* Actions */}
          <TouchableOpacity onPress={handleBackup} disabled={isBackingUp}>
            <LinearGradient
              colors={accentColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryBtn}
            >
              {isBackingUp ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
                  <Text style={styles.primaryBtnText}>Backup Now</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <VoidCard
            glass={!isTrueDark}
            intensity={isLight ? 20 : 80}
            style={[
              styles.card,
              {
                backgroundColor: isLight ? colors.surfaceSecondary : undefined,
                borderColor: colors.border
              }
            ]}
          >
            <TouchableOpacity style={styles.actionRow} onPress={handleRestore}>
              <View style={styles.rowContent}>
                <Ionicons name="cloud-download-outline" size={22} color={accentColor} />
                <Text style={[styles.label, { color: colors.textPrimary }]}>Restore from Backup</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <TouchableOpacity style={styles.actionRow} onPress={handleClearCache}>
              <View style={styles.rowContent}>
                <Ionicons name="trash-bin-outline" size={22} color={colors.textSecondary} />
                <Text style={[styles.label, { color: colors.textPrimary }]}>Clear Cache</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </VoidCard>
        </View>
      </SafeAreaView>
    </VoidShell>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Lexend',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Lexend',
  },
  value: {
    fontSize: 13,
    fontFamily: 'Lexend_400Regular',
    marginTop: 4,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Lexend',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
});

export default DataStorage;
