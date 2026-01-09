import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAccentGradient } from '@/constants/AccentContext';
import { BackupService } from '@/lib/backupService';
import { VoidCard } from '@/components/Layout/VoidCard';

const DataStorage = () => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const isLight = colorScheme === 'light';
  const { primary: accentColor, colors: accentColors } = useAccentGradient();
  const { lightFeedback, successFeedback } = useHaptics();

  const [isExporting, setIsExporting] = useState(false);
  const [storageStats, setStorageStats] = useState<{
    habitsCount: number;
    goalsCount: number;
    completionsCount: number;
    estimatedSizeMB: number;
  } | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    loadStorageStats();
  }, []);

  const loadStorageStats = async () => {
    setIsLoadingStats(true);
    const stats = await BackupService.getStorageUsage();
    setStorageStats(stats);
    setIsLoadingStats(false);
  };

  const handleExport = async () => {
    lightFeedback();
    setIsExporting(true);
    const success = await BackupService.exportAllData();
    setIsExporting(false);
    if (success) {
      successFeedback();
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will clear cached data like custom colors and focus stats. Your habits and settings will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            const success = await BackupService.clearLocalCache();
            if (success) {
              successFeedback();
              Alert.alert('Cache Cleared', 'Local cache has been cleared.');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Backup & Storage</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Storage Stats */}
          <VoidCard glass intensity={isLight ? 20 : 80} style={[styles.statsCard, isLight && { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>STORAGE USAGE</Text>
            {isLoadingStats ? (
              <ActivityIndicator color={accentColor} style={{ marginVertical: 20 }} />
            ) : storageStats && (
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Ionicons name="checkbox-outline" size={24} color={accentColor} />
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>{storageStats.habitsCount}</Text>
                  <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Habits</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="flag-outline" size={24} color={accentColor} />
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>{storageStats.goalsCount}</Text>
                  <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Goals</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="checkmark-done-outline" size={24} color={accentColor} />
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>{storageStats.completionsCount}</Text>
                  <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Completions</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="server-outline" size={24} color={accentColor} />
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>{storageStats.estimatedSizeMB.toFixed(2)}</Text>
                  <Text style={[styles.statLabel, { color: colors.textTertiary }]}>MB Used</Text>
                </View>
              </View>
            )}
          </VoidCard>

          {/* Export Button */}
          <TouchableOpacity onPress={handleExport} disabled={isExporting}>
            <LinearGradient
              colors={accentColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryBtn}
            >
              {isExporting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={20} color="#fff" />
                  <Text style={styles.primaryBtnText}>Export Data (JSON)</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <Text style={[styles.exportHint, { color: colors.textTertiary }]}>
            Export your habits, goals, and settings to a JSON file you can save or share.
          </Text>

          {/* Other Actions */}
          <VoidCard glass intensity={isLight ? 20 : 80} style={[styles.actionsCard, isLight && { backgroundColor: colors.surfaceSecondary }]}>
            <TouchableOpacity style={styles.actionRow} onPress={loadStorageStats}>
              <View style={styles.rowContent}>
                <Ionicons name="refresh-outline" size={22} color={accentColor} />
                <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>Refresh Stats</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <TouchableOpacity style={styles.actionRow} onPress={handleClearCache}>
              <View style={styles.rowContent}>
                <Ionicons name="trash-bin-outline" size={22} color="#EF4444" />
                <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>Clear Local Cache</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </VoidCard>

          {/* Cloud Sync Info */}
          <VoidCard glass intensity={isLight ? 20 : 80} style={[styles.infoCard, isLight && { backgroundColor: colors.surfaceSecondary }]}>
            <View style={styles.infoHeader}>
              <Ionicons name="cloud-done-outline" size={20} color="#10B981" />
              <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>Cloud Sync Active</Text>
            </View>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Your data is automatically synced to Supabase. Local export is for additional backup.
            </Text>
          </VoidCard>
        </ScrollView>
      </SafeAreaView>
    </View>
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
  statsCard: {
    padding: 20,
    borderRadius: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    fontFamily: 'Lexend',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: 'Lexend',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Lexend_400Regular',
    marginTop: 4,
  },
  exportHint: {
    fontSize: 12,
    fontFamily: 'Lexend_400Regular',
    textAlign: 'center',
    lineHeight: 18,
  },
  actionsCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Lexend',
  },
  infoCard: {
    padding: 16,
    borderRadius: 16,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Lexend',
  },
  infoText: {
    fontSize: 12,
    fontFamily: 'Lexend_400Regular',
    lineHeight: 18,
  },
});

export default DataStorage;
