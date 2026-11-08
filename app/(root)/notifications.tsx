import { useState, useEffect } from 'react';
import { getNotificationPrefs, setNotificationPrefs } from '@/lib/notificationPrefs';
import { ScrollView, View, Text, Alert, Linking } from 'react-native';
import { AppSwitch as Switch } from '@/components/ui/AppSwitch';
import { IconTile } from '@/components/ui/IconTile';
import { Colors } from '@/theme/colors';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';
import { useAppSettings } from '@/context/AppSettingsContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { SheetScreen } from '@/components/ui/SheetScreen';
import { VoidCard } from '@/components/ui/VoidCard';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import * as Notifs from 'expo-notifications';
import { morningAlarmAvailable } from '@/lib/morningAlarm';
import { planAlertsOn, setPlanAlertsOn } from '@/lib/planAlerts';
import HabyssLiveActivity from '@/modules/habyss-live-activity';
import { NotificationService } from '@/lib/notificationService';
import { TimeRow } from '@/components/ui/TimeRow';
import { cachedDayWindow, DEFAULT_DAY, getDayWindow, updateDayWindow, type DayWindow } from '@/lib/echo';
import { scheduledActivitiesEnabled, setScheduledActivitiesEnabled, scheduledActivitiesCapability } from '@/lib/scheduledActivities';
import { styles } from '@/styles/screens/notifications.styles';

const Notifications = () => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { lightFeedback } = useHaptics();
  const { notificationsEnabled, setNotificationsEnabled } = useAppSettings();
  const { primary: accentColor } = useAccentGradient();

  const [asking, setAsking] = useState(false);

  // When not to be interrupted. This lived on the Echo page, which is about
  // how Echo talks rather than when anything is allowed to reach you at all.
  // Only the end that was changed is saved; the other stays as it was saved.
  const saveDay = (patch: Partial<DayWindow>) => {
    setDay(current => ({ ...current, ...patch }));
    updateDayWindow(patch)
      .then(saved => { setDay(saved); return NotificationService.refreshReminders(); })
      .catch(() => undefined);
  };
  // Your saved day from the start, never the default first (lib/echo.ts).
  const [day, setDay] = useState(() => cachedDayWindow() ?? DEFAULT_DAY);
  const [activities, setActivities] = useState(true);
  const [ready, setReady] = useState(false);
  const capability = scheduledActivitiesCapability();
  useEffect(() => {
    let alive = true;
    Promise.all([getDayWindow(), scheduledActivitiesEnabled()]).then(([window, enabled]) => {
      if (alive) { setDay(window); setActivities(enabled); setReady(true); }
    }).catch(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);
  const toggleActivities = async (wanted: boolean) => {
    setAsking(true);
    try { await setScheduledActivitiesEnabled(wanted); setActivities(wanted); }
    catch { Alert.alert('Could not save setting', 'Please try again.'); }
    finally { setAsking(false); }
  };

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
  // Guided through the day: now, next, a heads-up, meals, events (lib/dayGuide.ts).
  const [planChanges, setPlanChanges] = useState(true);
  useEffect(() => { void planAlertsOn().then(setPlanChanges); }, []);
  const [dayGuide, setDayGuide] = useState(true);
  // Leave now and Start now as alarms (iOS 26+): ring through Silent, buzz the Watch.
  const [alarms, setAlarms] = useState(true);
  const alarmsAvailable = morningAlarmAvailable() && !!HabyssLiveActivity?.scheduleMomentAlarms;
  useEffect(() => { void getNotificationPrefs().then(prefs => { setDayGuide(prefs.dayGuide); setAlarms(prefs.alarms); }).catch(() => undefined); }, []);
  // Echo, when the timeline moves something you did not get to in time.


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

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* On and off, nothing else. Echo's nudges live in Echo's settings. */}
          <VoidCard style={styles.card}>
            <SettingRow icon="notifications" color={accentColor} label="Notifications"
              value={notificationsEnabled} disabled={asking}
              onChange={v => { lightFeedback(); void toggleAll(v); }} />
            <SettingRow icon="navigate" color={colors.success} label="Guide me through the day"
              value={dayGuide && notificationsEnabled} disabled={!notificationsEnabled}
              onChange={v => { lightFeedback(); setDayGuide(v); void setNotificationPrefs({ dayGuide: v }).then(() => NotificationService.refreshReminders()); }} />
            {alarmsAvailable ? (
              <SettingRow icon="watch" color={colors.error} label="Leave and start as alarms"
                value={alarms && dayGuide && notificationsEnabled} disabled={!notificationsEnabled || !dayGuide}
                onChange={v => { lightFeedback(); setAlarms(v); void setNotificationPrefs({ alarms: v }).then(() => NotificationService.refreshReminders()); }} />
            ) : null}
            <SettingRow icon="alarm" color={colors.warning} label="Habit reminders"
              value={habitReminders && notificationsEnabled} disabled={!notificationsEnabled}
              onChange={v => toggleSetting('notif_habits', v, setHabitReminders)} />
            <SettingRow icon="git-compare" color={accentColor} label="Echo: plan changes"
              value={planChanges && notificationsEnabled} disabled={!notificationsEnabled}
              onChange={v => { lightFeedback(); setPlanChanges(v); void setPlanAlertsOn(v); }} />
            <SettingRow icon="phone-portrait" color={colors.success} label="Live Activities"
              value={activities && capability !== 'unavailable'} disabled={!ready || asking || capability === 'unavailable'}
              onChange={wanted => void toggleActivities(wanted)} />
          </VoidCard>

          {/* Nothing reaches you outside these hours. */}
          <VoidCard style={[styles.card, { opacity: notificationsEnabled ? 1 : 0.5 }]}>
            <TimeRow icon="sunny-outline" label="Wake up" value={day.wake} accent={accentColor} onChange={time => saveDay({ wake: time })} />
            <TimeRow icon="moon-outline" label="Sleep" value={day.sleep} accent={accentColor} onChange={time => saveDay({ sleep: time })} />
          </VoidCard>
        </ScrollView>
      </SheetScreen>
  );
};


/** One setting: its icon on a solid tile, its name, and a switch. */
const SettingRow = ({ icon, color, label, value, disabled, onChange }: {
  icon: string; color: string; label: string; value: boolean; disabled?: boolean; onChange: (value: boolean) => void;
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { primary } = useAccentGradient();
  return (
    <View style={[styles.row, { opacity: disabled ? 0.5 : 1 }]}>
      <View style={styles.rowContent}>
        <IconTile icon={icon} color={color} size={30} shape="square" />
        <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
      </View>
      <Switch accessibilityLabel={label} value={value} disabled={disabled} onValueChange={onChange} />
    </View>
  );
};

export default Notifications;
