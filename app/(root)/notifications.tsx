import { FontFamily, UIStyles, Radius } from '@/theme/designSystem';
import { useState, useEffect } from 'react';
import { ScrollView, View, Text, Switch, Alert, Linking, Pressable } from 'react-native';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { Colors } from '@/theme/colors';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';
import { useAppSettings } from '@/context/AppSettingsContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { SheetScreen } from '@/components/Layout/SheetScreen';
import { VoidCard } from '@/components/Layout/VoidCard';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import * as Notifs from 'expo-notifications';
import { NotificationService } from '@/lib/notificationService';
import { TimeRow } from '@/components/Common/TimeRow';
import { DEFAULT_ECHO, DEFAULT_DAY, getEchoConfig, saveEchoConfig, getDayWindow, saveDayWindow, type DayWindow } from '@/lib/echo';
import { aliveLine } from '@/lib/echoAlive';
import { scheduledActivitiesEnabled, setScheduledActivitiesEnabled, scheduledActivitiesCapability } from '@/lib/scheduledActivities';
import { PERSONALITY_MODES } from '@/constants/AIPersonalities';
import { styles } from '@/styles/screens/notifications.styles';

const Notifications = () => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const isLight = theme === 'light';
  const isTrueDark = theme === 'trueDark';
  const { lightFeedback } = useHaptics();
  const { notificationsEnabled, setNotificationsEnabled, aiPersonality } = useAppSettings();
  const { primary: accentColor } = useAccentGradient();

  const [asking, setAsking] = useState(false);

  // When not to be interrupted. This lived on the Echo page, which is about
  // how Echo talks rather than when anything is allowed to reach you at all.
  const saveDay = (next: DayWindow) => {
    setDay(next);
    saveDayWindow(next)
      .then(() => NotificationService.refreshReminders())
      .catch(() => undefined);
  };
  const [echo, setEcho] = useState(DEFAULT_ECHO);
  const [day, setDay] = useState(DEFAULT_DAY);
  const [activities, setActivities] = useState(true);
  const [ready, setReady] = useState(false);
  const capability = scheduledActivitiesCapability();
  useEffect(() => {
    let alive = true;
    Promise.all([getEchoConfig(), getDayWindow(), scheduledActivitiesEnabled()]).then(([config, window, enabled]) => {
      if (alive) { setEcho(config); setDay(window); setActivities(enabled); setReady(true); }
    }).catch(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);
  const updateEcho = async (patch: Partial<typeof echo>) => {
    setAsking(true);
    try {
      if (patch.alive && !(await NotificationService.requestPermissions())) {
        Alert.alert('Allow notifications for Echo', 'Enable Habyss notifications in iOS Settings.', [
          { text: 'Not now', style: 'cancel' }, { text: 'Open Settings', onPress: () => void Linking.openSettings() },
        ]);
        return;
      }
      if (patch.alive && !notificationsEnabled) await setNotificationsEnabled(true);
      const next = { ...echo, ...patch };
      await saveEchoConfig(next); setEcho(next);
      await NotificationService.refreshReminders();
    } catch { Alert.alert('Could not update Echo', 'Please try again.'); }
    finally { setAsking(false); }
  };
  const toggleActivities = async (wanted: boolean) => {
    setAsking(true);
    try { await setScheduledActivitiesEnabled(wanted); setActivities(wanted); }
    catch { Alert.alert('Could not save setting', 'Please try again.'); }
    finally { setAsking(false); }
  };
  const sample = { key: 'habit:run:preview', kind: 'habit' as const, id: 'run', title: 'Run 5 km', day: '', start: new Date(), end: new Date(), url: '' };
  const before = aliveLine(sample, 'before', aiPersonality);
  const after = aliveLine(sample, 'follow-up', aiPersonality);

  /**
   * iOS delivers nothing until it has been asked, and it only offers to ask
   * once. Nothing in the app was asking, so every reminder was being dropped
   * while this switch sat on "on".
   *
   * It refuses to stay on when the answer was no: a setting that claims to
   * work while the system quietly refuses is worse than one plainly off.
   */
  const toggleAll = async (wanted: boolean) => {
    if (!wanted) {
      await setNotificationsEnabled(false);
      await Notifs.cancelAllScheduledNotificationsAsync().catch(() => undefined);
      return;
    }

    setAsking(true);
    try {
      const current = await Notifs.getPermissionsAsync();
      let granted = current.granted || current.ios?.status === Notifs.IosAuthorizationStatus.PROVISIONAL;

      if (!granted && current.canAskAgain) {
        const asked = await Notifs.requestPermissionsAsync();
        granted = asked.granted || asked.ios?.status === Notifs.IosAuthorizationStatus.PROVISIONAL;
      }

      if (!granted) {
        await setNotificationsEnabled(false);
        Alert.alert(
          'Notifications are off',
          'iOS is not letting Habyss send reminders. Turn them on in Settings and come back.',
          [{ text: 'Not now', style: 'cancel' }, { text: 'Open Settings', onPress: () => void Linking.openSettings() }],
        );
        return;
      }

      await setNotificationsEnabled(true);
      await NotificationService.refreshHabitReminders().catch(() => undefined);
    } finally {
      setAsking(false);
    }
  };

  const [habitReminders, setHabitReminders] = useState(true);


  // Load saved preferences
  useEffect(() => {
    const loadPrefs = async () => {
      const h = await AsyncStorage.getItem('notif_habits');

      if (h !== null) setHabitReminders(h === 'true');

    };
    loadPrefs();
  }, []);

  const toggleSetting = async (key: string, value: boolean, setter: (v: boolean) => void) => {
    lightFeedback();
    setter(value);
    await AsyncStorage.setItem(key, value.toString());
    await NotificationService.refreshReminders();
  };

  return (
    <SheetScreen title="Notifications" onBack={() => router.back()}>

        {/* Settings */}
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
                  <Text style={[styles.label, { color: colors.textPrimary }]}>Notifications</Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Enable all notifications</Text>
                </View>
              </View>
              <Switch
                value={notificationsEnabled}
                disabled={asking}
                onValueChange={(v) => { lightFeedback(); void toggleAll(v); }}
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

          </VoidCard>

          <VoidCard glass={!isTrueDark} style={[styles.card, { borderColor: echo.alive ? accentColor + '66' : colors.border }]}>
            <View style={styles.row}>
              <View style={styles.rowContent}>
                <Ionicons name="sparkles-outline" size={22} color={accentColor} />
                <View style={styles.textContent}>
                  <Text style={[styles.label, { color: colors.textPrimary }]}>Echo Alive</Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>A little encouragement, right on time.</Text>
                </View>
              </View>
              <Switch accessibilityLabel="Echo Alive" value={!!echo.alive && notificationsEnabled} disabled={!ready || asking}
                onValueChange={alive => void updateEcho({ alive })} trackColor={{ false: colors.border, true: accentColor }} />
            </View>
            <Text style={[styles.detail, { color: colors.textSecondary }]}>For habits and tasks with a start time: Echo checks in 10 minutes before, using your chosen personality. Regular reminders for those items are replaced.</Text>
            <View style={[styles.preview, { backgroundColor: accentColor + '12' }]}>
              <Text style={[styles.previewTime, { color: accentColor }]}>7:50 AM · BEFORE YOUR 8 AM RUN</Text>
              <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>{before.title}</Text>
              <Text style={[styles.previewBody, { color: colors.textSecondary }]}>{before.body}</Text>
            </View>
            <View style={styles.row}>
              <View style={styles.textContent}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>Check in if I haven’t finished</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Once, 15 minutes after the planned session.</Text>
              </View>
              <Switch accessibilityLabel="Echo follow-up" value={echo.aliveFollowUp !== false} disabled={!echo.alive || !notificationsEnabled || asking}
                onValueChange={aliveFollowUp => void updateEcho({ aliveFollowUp })} trackColor={{ false: colors.border, true: accentColor }} />
            </View>
            {echo.aliveFollowUp !== false ? <View style={[styles.preview, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>{after.title}</Text>
              <Text style={[styles.previewBody, { color: colors.textSecondary }]}>{after.body}</Text>
            </View> : null}
            <Text style={[styles.detail, { color: colors.textTertiary }]}>Quiet hours: {day.sleep}–{day.wake}. Finishing or skipping cancels that session’s nudges. Untimed habits and tasks keep their usual reminders.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/(root)/ai-settings')} style={styles.echoLink}>
              <Text style={{ color: accentColor, fontFamily: FontFamily.medium }}>Echo’s voice · {PERSONALITY_MODES.find(mode => mode.id === aiPersonality)?.name}</Text>
              <Ionicons name="chevron-forward" size={16} color={accentColor} />
            </Pressable>
          </VoidCard>

          {/* Quiet hours, in the place that decides when you are interrupted. */}
          <VoidCard glass={!isTrueDark} style={[styles.card, { borderColor: colors.border, opacity: notificationsEnabled ? 1 : 0.5 }]}>
            <View style={styles.row}>
              <View style={styles.rowContent}>
                <Ionicons name="moon-outline" size={22} color={accentColor} />
                <View style={styles.textContent}>
                  <Text style={[styles.label, { color: colors.textPrimary }]}>Your day</Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Nothing reaches you outside these hours</Text>
                </View>
              </View>
            </View>
            <TimeRow icon="alarm-outline" label="Wake up" value={day.wake} accent={accentColor} onChange={time => saveDay({ ...day, wake: time })} />
            <TimeRow icon="bed-outline" label="Sleep" value={day.sleep} accent={accentColor} onChange={time => saveDay({ ...day, sleep: time })} />
          </VoidCard>

          <VoidCard glass={!isTrueDark} style={[styles.card, { borderColor: colors.border }]}>
            <View style={styles.row}>
              <View style={styles.rowContent}>
                <Ionicons name="time-outline" size={22} color={accentColor} />
                <View style={styles.textContent}>
                  <Text style={[styles.label, { color: colors.textPrimary }]}>Scheduled Live Activities</Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Your next step, on the Lock Screen.</Text>
                </View>
              </View>
              <Switch accessibilityLabel="Scheduled Live Activities" value={activities && capability !== 'unavailable'} disabled={!ready || asking || capability === 'unavailable'}
                onValueChange={wanted => void toggleActivities(wanted)} trackColor={{ false: colors.border, true: accentColor }} />
            </View>
            <Text style={[styles.detail, { color: colors.textSecondary }]}>{capability === 'scheduled'
              ? 'A card appears at the scheduled time, even when Habyss is closed. Finish or skip to clear it. iOS controls Live Activity availability and how many upcoming cards can be queued.'
              : capability === 'foreground' ? 'On this iOS version, timed cards start while Habyss is open. Automatic starts with the app closed require iOS 26 or later.'
              : 'Available in the native iOS app. Install the latest Habyss build to use scheduled cards.'}</Text>
          </VoidCard>
        </ScrollView>
      </SheetScreen>
  );
};


export default Notifications;
