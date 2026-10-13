import '@/lib/polyfills'; // Must be first
import { getLocalUserId } from '@/lib/localUser';
import { ThemeProvider } from "@/context/ThemeContext";
import { useFonts, Lexend_400Regular, Lexend_500Medium, Lexend_600SemiBold, Lexend_700Bold } from '@expo-google-fonts/lexend';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { Colors } from '@/theme/colors';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import '../global.css';
import { useColorScheme } from '@/hooks/useColorScheme';
import { DarkTheme, LightTheme } from "@/theme/navigation";
import React from "react";
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import {View, AppState, Alert} from 'react-native';
import { VoidShell } from '@/components/ui/VoidShell';
import { NotificationService } from '@/lib/notificationService';
import '@/lib/LocationService'; // Register background tasks
import { AIPersonalityProvider } from '@/context/AIPersonalityContext';
import { AppSettingsProvider } from '@/context/AppSettingsContext';
import { AccentProvider, useAccentGradient } from '@/context/AccentContext';
import { FocusTimeProvider, useFocusTime } from '@/context/FocusTimeContext';
import { CreationModal } from '@/components/Create/CreationModal';
import { DayCompleteCelebration } from '@/components/Celebrations/DayCompleteCelebration';
import { MilestoneCelebration } from '@/components/Celebrations/MilestoneCelebration';
import { HabitSheet } from '@/components/Create/HabitSheet';
import { GoalSheet } from '@/components/Create/GoalSheet';
import { TaskFormModal } from '@/components/Tasks/TaskFormModal';
import { FeedbackSheet } from '@/components/Common/FeedbackSheet';
import { flushFeedback } from '@/lib/feedback';
import RevenueCatService from '@/lib/RevenueCat';
// import { SuperwallProvider, SuperwallExpoModule } from 'expo-superwall';
// import * as Linking from 'expo-linking';
import { BiometricGuard } from '@/components/Auth/BiometricGuard';
import { ErrorBoundary } from '@/components/Common/ErrorBoundary';
import { QuietLoading } from '@/components/Loading/QuietLoading';
import { SiriService } from '@/lib/siriService';
import { emit, on, onAny } from '@/lib/appEvents';

SplashScreen.preventAutoHideAsync().catch(() => { });

/**
 * Backs up when the app comes to the foreground, if signed in.
 *
 * At most every few minutes, so switching apps does not upload each time. A
 * failure is silent here: the data is safe on the phone, the next attempt
 * retries, and the Account screen reports the state honestly.
 */
const BACKUP_INTERVAL_MS = 3 * 60 * 1000;
let lastBackgroundBackup = 0;
async function backUpInBackground() {
    if (Date.now() - lastBackgroundBackup < BACKUP_INTERVAL_MS) return;
    lastBackgroundBackup = Date.now();
    try {
        const { currentAccount } = require('@/lib/account');
        if (!(await currentAccount())) return;
        const { syncNow } = require('@/lib/cloudSync');
        await syncNow();
    } catch (error) {
        console.warn('[Backup] background sync failed', error);
    }
}

export default function MobileLayout() {
  const [loaded] = useFonts({
    'Lexend': Lexend_700Bold,
    Lexend_400Regular,
    Lexend_500Medium,
    Lexend_600SemiBold,
    Lexend_700Bold,
    SpaceGrotesk_700Bold,
  });
  const [bootReady, setBootReady] = React.useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        if (loaded) {
          // Initialize notifications sequence safely
          try {
            await NotificationService.init();
            // Permissions are requested when the user enables a reminder.
            void NotificationService.refreshHabitReminders().catch(error => console.warn('Reminder refresh failed', error));
            await RevenueCatService.init().catch(error => console.warn('Purchases unavailable', error));
            await SiriService.syncTodayProgress();
            // On-device AI in the background: Apple's built-in model when the
            // phone has one, otherwise the Llama model, downloaded on Wi-Fi the
            // first time. Never blocks startup and never throws.
            import('@/lib/onDeviceAI').then(ai => ai.prepareOnDeviceAI()).catch(() => undefined);
          } catch (e) {
            console.warn("Notification initialization failed", e);
          }
        }
      } catch (e) {
        console.warn("Preparation failed", e);
      } finally {
        if (loaded) {
          setBootReady(true);
          await SplashScreen.hideAsync();
        }
      }
    }
    prepare();
  }, [loaded]);

  // Realtime Notifications removed — will be re-enabled with premium cloud sync

  // --- Notification Deep Linking ---
  useEffect(() => {
    const handle = async (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      try {
        await NotificationService.handleEchoResponse(response);
        await Notifications.clearLastNotificationResponseAsync();
        const url = response.notification.request.content.data?.url;
        if (typeof url === 'string' && url.startsWith('/')) {
          setTimeout(() => { require('expo-router').router.push(url); }, 500);
        }
      } catch (error) {
        console.warn('Could not apply notification action', error);
        if (['ECHO_DONE', 'ECHO_SNOOZE'].includes(response.actionIdentifier)) {
          Alert.alert('Action could not finish', 'Open the item in Habyss and try again.');
        }
      }
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(response => { void handle(response); });
    void Notifications.getLastNotificationResponseAsync().then(handle).catch(() => undefined);

    return () => subscription.remove();
  }, []);

  // --- Superwall Deep Linking ---
  // useEffect(() => {
  //   const handleDeepLink = async ({ url }: { url: string }) => {
  //     if (url) {
  //       try {
  //         await SuperwallExpoModule.handleDeepLink(url);
  //       } catch (e) {
  //         console.warn('[Superwall] Deep link error:', e);
  //       }
  //     }
  //   };

  //   const subscription = Linking.addEventListener('url', handleDeepLink);

  //   // Check initial URL
  //   // Linking.getInitialURL().then((url) => {
  //   //   if (url) handleDeepLink({ url });
  //   // });

  //   return () => {
  //     // subscription.remove();
  //   };
  // }, []);

  // --- Local User + RevenueCat Init ---
  useEffect(() => {
    async function initLocalUser() {
      try {
        const userId = await getLocalUserId();
        await RevenueCatService.logIn(userId);
      } catch (e) {
        console.warn('[Auth] Local user init failed:', e);
      }
    }
    initLocalUser();
  }, []);

  if (!loaded || !bootReady) {
    return <QuietLoading />;
  }

  return (
    // <SuperwallProvider apiKeys={{ ios: "pk_UMIRgoqWMWWOJ9H2Lp6RG" }}>
    <ErrorBoundary>
      <ThemeProvider>
        <AppSettingsProvider>
          <AIPersonalityProvider>
            <AccentProvider>
              <FocusTimeProvider>
                  <GestureHandlerRootView style={{ flex: 1 }}>
                    <BiometricGuard>
                      <InnerLayout />
                    </BiometricGuard>
                  </GestureHandlerRootView>
              </FocusTimeProvider>
            </AccentProvider>
          </AIPersonalityProvider>
        </AppSettingsProvider>
      </ThemeProvider>
    </ErrorBoundary>
    // </SuperwallProvider>
  );
}

function InnerLayout() {
  const theme = useColorScheme();
  const isDark = theme !== 'light';
  const { foreground } = useAccentGradient();
  const palette = Colors[theme];
  const navigationTheme = {
    ...(isDark ? DarkTheme : LightTheme),
    colors: {
      ...(isDark ? DarkTheme : LightTheme).colors,
      primary: foreground, background: palette.background, card: palette.surface,
      text: palette.textPrimary, border: palette.border, notification: palette.error,
    },
  };

  // Anything written without signal is sent now rather than waiting for the
  // person to remember they ever wrote it.
  useEffect(() => { void flushFeedback().catch(() => undefined); }, []);

  // Every account that existed before profiles were shared has a name and a
  // picture on the phone and neither on the server, so friends see a handle and
  // a grey circle. This sends whichever of them has not arrived yet.
  //
  // It listens rather than firing once: a mount effect runs before Supabase has
  // restored the stored session, so the single attempt always found nobody
  // signed in and quietly did nothing.
  useEffect(() => {
    const stop = (require('@/lib/profileSync') as typeof import('@/lib/profileSync')).startProfileSync();
    return stop;
  }, []);

  // --- App Intents Listener (Siri/Shortcuts) ---
  const { startTimer, stopTimer: globalStopTimer } = useFocusTime();

  useEffect(() => {
    const checkIntents = async () => {
      try {
        const SharedDefaults = require('@/lib/SharedDefaults').default;

        // 1. Check for Stop Focus Intent (NEW)
        const stopFlag = await SharedDefaults.getDouble('intent_stop_focus_timestamp');
        if (stopFlag > 0) {
          console.log('[AppIntents] Stopping focus session via Siri');
          globalStopTimer();
          await SharedDefaults.remove('intent_stop_focus');
          await SharedDefaults.remove('intent_stop_focus_timestamp');
        }

        // 2. Check for Start Focus Intent
        const focusDuration = await SharedDefaults.getInteger('intent_start_focus_duration');
        if (focusDuration > 0) {
          console.log('[AppIntents] Starting focus for', focusDuration, 'minutes');
          startTimer('intent_habit', 'Focus Session', focusDuration * 60);
          await SharedDefaults.remove('intent_start_focus_duration');
        }

        // 3. Completions arriving from Siri Shortcuts.
        // Previously this toggled unconditionally, so logging an already
        // completed habit switched it back off, and it keyed the completion by
        // UTC date, which lands on tomorrow in western timezones late in the day.
        const { drainPendingShortcutLogs } = require('@/lib/shortcutsInbox');
        const drained = await drainPendingShortcutLogs();
        if (drained.logged.length || drained.unmatched.length) {
          console.log('[AppIntents] Shortcut logs applied:', drained);
        }

        // Tasks and habits named from Siri, Spotlight, the Action button or a Shortcut.
        const { drainQuickAdds } = require('@/lib/shortcutsInbox');
        const added = await drainQuickAdds();
        if (added.tasks.length) emit('tasks_changed');
        if (added.habits.length) emit('habit_updated', {});

        // Rows ticked on the widget while the app was closed, habits and tasks alike.
        const { drainWidgetToggles } = require('@/lib/widgetSync');
        const fromWidget = await drainWidgetToggles();
        if (fromWidget.habits || fromWidget.tasks) {
          emit('habit_completion_updated', {});
          emit('tasks_changed');
        }

      } catch (e) {
        console.warn('[AppIntents] Error checking intents:', e);
      }
    };

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        checkIntents();
        void NotificationService.refreshHabitReminders().catch(error => console.warn('Reminder refresh failed', error));
        void backUpInBackground();
      }
    });

    // Check on mount too
    checkIntents();

    return () => {
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;
    let again = false;
    const refresh = async (leavingApp = false) => {
      if (!alive || (!leavingApp && AppState.currentState !== 'active')) return;
      if (running) { again = true; return; }
      running = true;
      try {
        do {
          again = false;
          const { drainWidgetToggles, syncWidgets } = require('@/lib/widgetSync');
          const applied = await drainWidgetToggles();
          if (applied.habits || applied.tasks) {
            emit('habit_completion_updated', {});
            emit('tasks_changed');
          }
          await syncWidgets();
          if (leavingApp) continue;
          await require('@/lib/scheduledActivities').refreshScheduledActivities();
          await require('@/lib/dayComplete').checkDayComplete();
          await require('@/lib/milestones').checkMilestones();
        } while (again && alive);
      } catch (error) { console.warn('Could not refresh widgets or scheduled activities', error); }
      finally { running = false; }
    };
    const enqueue = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void refresh(); }, 150);
    };
    const stop = onAny(['habit_completion_updated', 'habit_created', 'habit_updated', 'habit_deleted',
      'goal_deleted', 'tasks_changed', 'cloud_restored', 'engagement_settings_changed', 'daily_focus_target_changed'], enqueue);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') enqueue();
      else {
        // Do not abandon the last task edit when the user immediately goes Home.
        if (timer) clearTimeout(timer);
        void refresh(true);
      }
    });
    // Native ActivityKit schedules the exact start. This foreground fallback
    // also covers older iOS and replenishes the upcoming cards while browsing.
    const interval = setInterval(enqueue, 60000);
    enqueue();
    return () => { alive = false; stop(); subscription.remove(); clearInterval(interval); if (timer) clearTimeout(timer); };
  }, [foreground]);

  return (
    <NavigationThemeProvider value={navigationTheme}>
    <View style={{ flex: 1 }} className={theme}>
      <VoidShell>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(root)" />
          <Stack.Screen name="+not-found" />
        </Stack>
        <DayCompleteCelebration />
        <MilestoneCelebration />
        <CreationModal />
        <HabitSheet listenToGlobalEvents />
        <GoalSheet listenToGlobalEvents />
        <TaskFormModal listenToGlobalEvents />
        {/* Mounted once, raised from anywhere with `show_feedback`. Telling us
            something should never depend on being on the right screen. */}
        <FeedbackSheet />
        <StatusBar style={isDark ? "light" : "dark"} />
      </VoidShell>
    </View>
    </NavigationThemeProvider>
  );
}
