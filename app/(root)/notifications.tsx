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
import { morningAlarmAvailable, syncMorningAlarm } from '@/lib/morningAlarm';
import { PUSH_KINDS, pushOff, setPushKind } from '@/lib/pushPrefs';
import HabyssLiveActivity from '@/modules/habyss-live-activity';
import { NotificationService } from '@/lib/notificationService';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { cachedDayWindow, cachedEchoConfig, DEFAULT_DAY, DEFAULT_ECHO, getDayWindow, getEchoConfig, minutesOf, updateEchoConfig, type EchoConfig } from '@/lib/echo';
import { clockLabel } from '@/lib/dayFlow';
import { scheduledActivitiesEnabled, setScheduledActivitiesEnabled, scheduledActivitiesCapability } from '@/lib/scheduledActivities';
import { styles } from '@/styles/screens/notifications.styles';

const Notifications = () => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { lightFeedback } = useHaptics();
  const { notificationsEnabled, setNotificationsEnabled } = useAppSettings();
  const { primary: accentColor } = useAccentGradient();

  const [asking, setAsking] = useState(false);

  // Your saved day from the start, never the default first (lib/echo.ts).
  const [day, setDay] = useState(() => cachedDayWindow() ?? DEFAULT_DAY);
  // Echo's check-ins and the morning alarm: when they reach you lives here, how Echo words them on Echo's page.
  const [echo, setEcho] = useState<EchoConfig>(() => cachedEchoConfig() ?? DEFAULT_ECHO);
  useEffect(() => { void getEchoConfig().then(setEcho).catch(() => undefined); }, []);
  const saveEcho = (patch: Partial<EchoConfig>) => {
    lightFeedback();
    setEcho(current => ({ ...current, ...patch }));
    void updateEchoConfig(patch).then(stored => { setEcho(stored); return NotificationService.refreshReminders(); }).catch(() => undefined);
  };
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
  // The day as it happens: each thing as it starts, time's up, bedtime (lib/dayGuide.ts).
  const [dayGuide, setDayGuide] = useState(true);
  // Said in Echo's voice, or the plain sound.
  const [echoVoice, setEchoVoice] = useState(true);
  // Community: each kind pushed, or kept to the inbox (lib/pushPrefs.ts).
  const [off, setOff] = useState<Set<string>>(new Set());
  useEffect(() => { void pushOff().then(setOff); }, []);
  const togglePush = (id: string, on: boolean) => {
    lightFeedback();
    setOff(current => { const next = new Set(current); if (on) next.delete(id); else next.add(id); return next; });
    void setPushKind(id, on).catch(() => Alert.alert('Not saved', 'Could not reach Habyss. Check your connection and try again.'));
  };
  // Leave now and Start now as alarms (iOS 26+): ring through Silent, buzz the Watch.
  const [alarms, setAlarms] = useState(true);
  const alarmsAvailable = morningAlarmAvailable() && !!HabyssLiveActivity?.scheduleMomentAlarms;
  useEffect(() => { void getNotificationPrefs().then(prefs => { setDayGuide(prefs.dayGuide); setAlarms(prefs.alarms); setEchoVoice(prefs.echoVoice); }).catch(() => undefined); }, []);
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
            <SettingRow icon="mic" color={accentColor} label="Echo announces"
              value={echoVoice && dayGuide && notificationsEnabled} disabled={!notificationsEnabled || !dayGuide}
              onChange={v => { lightFeedback(); setEchoVoice(v); void setNotificationPrefs({ echoVoice: v }).then(() => NotificationService.refreshReminders()); }} />
            {alarmsAvailable ? (
              <SettingRow icon="watch" color={colors.error} label="Leave and start as alarms"
                value={alarms && dayGuide && notificationsEnabled} disabled={!notificationsEnabled || !dayGuide}
                onChange={v => { lightFeedback(); setAlarms(v); void setNotificationPrefs({ alarms: v }).then(() => NotificationService.refreshReminders()); }} />
            ) : null}
            <SettingRow icon="alarm" color={colors.warning} label="Habit reminders"
              value={habitReminders && notificationsEnabled} disabled={!notificationsEnabled}
              onChange={v => toggleSetting('notif_habits', v, setHabitReminders)} />
            <SettingRow icon="phone-portrait" color={colors.success} label="Live Activities"
              value={activities && capability !== 'unavailable'} disabled={!ready || asking || capability === 'unavailable'}
              onChange={wanted => void toggleActivities(wanted)} />
          </VoidCard>

          {/* Community: on, a notification; off, it waits quietly in the inbox. */}
          <View>
          <Text style={[styles.detail, { color: colors.textSecondary }]}>Community · off keeps it in your inbox</Text>
          <VoidCard style={[styles.card, { opacity: notificationsEnabled ? 1 : 0.5 }]}>
            {PUSH_KINDS.map(kind => (
              <SettingRow key={kind.id} icon={kind.icon} color={accentColor} label={kind.label}
                value={!off.has(kind.id) && notificationsEnabled} disabled={!notificationsEnabled}
                onChange={v => togglePush(kind.id, v)} />
            ))}
          </VoidCard>
          </View>

          {/* Echo's own times: the alarm at wake, a word in the morning and before bed, the week's review. */}
          <SettingsGroup title="Wake up & check-ins">
            <SettingsRow icon="alarm" color={colors.warning} label="Morning alarm"
              value={morningAlarmAvailable() ? undefined : 'iOS 26'}
              toggle={echo.morningAlarm === true} disabled={!morningAlarmAvailable()}
              onToggle={value => {
                saveEcho({ morningAlarm: value });
                setTimeout(() => {
                  void syncMorningAlarm().then(result => {
                    if (result === 'denied') Alert.alert('Alarms are off for Habyss', 'Allow alarms for Habyss in Settings → Apps → Habyss, then turn this on again.');
                    if (result === 'failed') Alert.alert('Could not set the alarm', 'Please try again.');
                  });
                }, 300);
              }} />
            <SettingsRow icon="sunny" color={colors.warning} label="Morning check-in" toggle={echo.morning}
              disabled={!notificationsEnabled} onToggle={value => saveEcho({ morning: value })} />
            <SettingsRow icon="moon" color={accentColor} label="Before bed" toggle={echo.evening}
              disabled={!notificationsEnabled} onToggle={value => saveEcho({ evening: value })} />
            <SettingsRow icon="calendar" color={colors.error} label="Weekly review" toggle={echo.weeklyReview !== false}
              disabled={!notificationsEnabled}
              onToggle={value => { saveEcho({ weeklyReview: value }); setTimeout(() => { void (require('@/lib/weeklyReviewNotice') as typeof import('@/lib/weeklyReviewNotice')).syncWeeklyReviewNotice(); }, 300); }} />
          </SettingsGroup>

          {/* Nothing reaches you outside your day: its hours are set once, in Day & calendar. */}
          <SettingsGroup title="Quiet hours">
            <SettingsRow icon="moon" color={accentColor} label="Quiet from"
              value={`${clockLabel(minutesOf(day.sleep))} – ${clockLabel(minutesOf(day.wake))}`}
              onPress={() => router.push('/(root)/meals' as never)} />
          </SettingsGroup>
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
