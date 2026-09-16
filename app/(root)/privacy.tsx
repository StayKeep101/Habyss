import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';

import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import { useTheme } from '@/constants/themeContext';

import { useAppSettings } from '@/constants/AppSettingsContext';
import { deleteAllLocalData, restartAfterDeletion } from '@/lib/accountDeletion';

const Privacy = () => {
  // const colorScheme = useColorScheme();
  const { theme } = useTheme();
  const colors = Colors[theme];
  const isLight = theme === 'light';
  const isTrueDark = theme === 'trueDark';
  const { lightFeedback } = useHaptics();
  const { isAppLockEnabled, setIsAppLockEnabled } = useAppSettings();

  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This permanently removes your habits, streaks, history, settings and the downloaded AI model from this device. It cannot be undone, and we hold no copy to restore.\n\nAny subscription stays with your Apple ID; cancel it in Settings if you no longer want it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const report = await deleteAllLocalData();
            setDeleting(false);

            // Onboarding state is gone with the rest, so send the user back to the start.
            const restart = async () => {
              // A reload clears contexts and cached ids; navigation is the fallback.
              if (!(await restartAfterDeletion())) router.replace('/(auth)/welcome');
            };

            if (report.ok) {
              Alert.alert('Account deleted', 'Everything stored on this device has been removed.', [
                { text: 'OK', onPress: restart },
              ]);
            } else {
              Alert.alert(
                'Partly deleted',
                `Your data was removed, except: ${report.failed.map(step => step.label).join(', ')}. ` +
                'Deleting the app from your device removes anything left.',
                [{ text: 'OK', onPress: restart }],
              );
            }
          },
        },
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
          <Text style={[styles.title, { color: colors.textPrimary }]}>Privacy</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Settings */}
        <View style={styles.content}>
          {/* Data Collection */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>DATA COLLECTION</Text>
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
            <View style={styles.row}>
              <View style={styles.rowContent}>
                <Ionicons name="phone-portrait-outline" size={22} color={colors.textSecondary} />
                <View style={styles.textContent}>
                  <Text style={[styles.label, { color: colors.textPrimary }]}>Everything stays on this device</Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    Habyss has no analytics or tracking, and your habits are never uploaded to us.
                  </Text>
                </View>
              </View>
            </View>
          </VoidCard>

          {/* Security */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: 24 }]}>SECURITY</Text>
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
            <View style={styles.row}>
              <View style={styles.rowContent}>
                <Ionicons name="lock-closed-outline" size={22} color={colors.textSecondary} />
                <View style={styles.textContent}>
                  <Text style={[styles.label, { color: colors.textPrimary }]}>App Lock</Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Require FaceID/TouchID to open</Text>
                </View>
              </View>
              <Switch
                value={isAppLockEnabled}
                onValueChange={(v) => { lightFeedback(); setIsAppLockEnabled(v); }}
                trackColor={{ false: colors.border, true: colors.success }}
              />
            </View>
          </VoidCard>

          {/* Danger Zone */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: 24 }]}>DANGER ZONE</Text>
          <TouchableOpacity
            style={[styles.dangerBtn, { backgroundColor: colors.error + '15' }]}
            onPress={handleDeleteAccount}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            )}
            <Text style={[styles.dangerText, { color: colors.error }]}>
              {deleting ? 'Deleting…' : 'Delete Account'}
            </Text>
          </TouchableOpacity>
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
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
    fontFamily: 'Lexend_400Regular',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  textContent: {
    flex: 1,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Lexend',
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Lexend_400Regular',
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 8,
  },
  dangerText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Lexend',
  },
});

export default Privacy;
