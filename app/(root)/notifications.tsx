import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';
import { useAppSettings } from '@/constants/AppSettingsContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';

const Notifications = () => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const isLight = theme === 'light';
  const isTrueDark = theme === 'trueDark';
  const { lightFeedback } = useHaptics();
  const { notificationsEnabled, setNotificationsEnabled } = useAppSettings();
  const { primary: accentColor } = useAccentGradient();

  const [habitReminders, setHabitReminders] = useState(true);
  const [streakAlerts, setStreakAlerts] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(false);

  // Load saved preferences
  useEffect(() => {
    const loadPrefs = async () => {
      const h = await AsyncStorage.getItem('notif_habits');
      const s = await AsyncStorage.getItem('notif_streaks');
      const w = await AsyncStorage.getItem('notif_weekly');
      if (h !== null) setHabitReminders(h === 'true');
      if (s !== null) setStreakAlerts(s === 'true');
      if (w !== null) setWeeklyReport(w === 'true');
    };
    loadPrefs();
  }, []);

  const toggleSetting = async (key: string, value: boolean, setter: (v: boolean) => void) => {
    lightFeedback();
    setter(value);
    await AsyncStorage.setItem(key, value.toString());
  };

  return (
    <VoidShell>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Notifications</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Settings */}
        <View style={styles.content}>
          {/* Master Toggle */}
          <VoidCard
            glass={!isTrueDark}
            intensity={isLight ? 20 : 80}
            style={[
              styles.card,
              {
                borderColor: colors.border,
                backgroundColor: isLight ? colors.surfaceSecondary : undefined
              }
            ]}
          >
            <View style={styles.row}>
              <View style={styles.rowContent}>
                <Ionicons name="notifications" size={22} color={accentColor} />
                <View style={styles.textContent}>
                  <Text style={[styles.label, { color: colors.textPrimary }]}>Push Notifications</Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Enable all notifications</Text>
                </View>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={(v) => {
                  lightFeedback();
                  setNotificationsEnabled(v);
                }}
                trackColor={{ false: colors.border, true: accentColor }}
              />
            </View>
          </VoidCard>

          {/* Individual Settings */}
          <VoidCard
            glass={!isTrueDark}
            intensity={isLight ? 20 : 80}
            style={[
              styles.card,
              {
                borderColor: colors.border,
                backgroundColor: isLight ? colors.surfaceSecondary : undefined,
                opacity: notificationsEnabled ? 1 : 0.5
              }
            ]}
          >
            <View style={styles.row}>
              <View style={styles.rowContent}>
                <Ionicons name="alarm-outline" size={22} color={colors.textSecondary} />
                <Text style={[styles.label, { color: colors.textPrimary }]}>Habit Reminders</Text>
              </View>
              <Switch
                value={habitReminders && notificationsEnabled}
                onValueChange={(v) => toggleSetting('notif_habits', v, setHabitReminders)}
                disabled={!notificationsEnabled}
                trackColor={{ false: colors.border, true: accentColor }}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.row}>
              <View style={styles.rowContent}>
                <Ionicons name="flame-outline" size={22} color={colors.textSecondary} />
                <Text style={[styles.label, { color: colors.textPrimary }]}>Streak Alerts</Text>
              </View>
              <Switch
                value={streakAlerts && notificationsEnabled}
                onValueChange={(v) => toggleSetting('notif_streaks', v, setStreakAlerts)}
                disabled={!notificationsEnabled}
                trackColor={{ false: colors.border, true: accentColor }}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.row}>
              <View style={styles.rowContent}>
                <Ionicons name="bar-chart-outline" size={22} color={colors.textSecondary} />
                <Text style={[styles.label, { color: colors.textPrimary }]}>Weekly Report</Text>
              </View>
              <Switch
                value={weeklyReport && notificationsEnabled}
                onValueChange={(v) => toggleSetting('notif_weekly', v, setWeeklyReport)}
                disabled={!notificationsEnabled}
                trackColor={{ false: colors.border, true: accentColor }}
              />
            </View>
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
});

export default Notifications;
