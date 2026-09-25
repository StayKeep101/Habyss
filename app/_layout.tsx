import '@/lib/polyfills'; // Must be first
import { getLocalUserId } from '@/lib/localUser';
import { ThemeProvider } from "../constants/themeContext";
import { useFonts, Lexend_400Regular, Lexend_500Medium, Lexend_600SemiBold, Lexend_700Bold } from '@expo-google-fonts/lexend';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { Colors } from '@/constants/Colors';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import '../global.css';
import { useColorScheme } from '@/hooks/useColorScheme';
import { DarkTheme, LightTheme } from "../constants/Themes";
import React from "react";
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import {View, AppState} from 'react-native';
import { VoidShell } from '@/components/Layout/VoidShell';
import { NotificationService } from '@/lib/notificationService';
import '@/lib/LocationService'; // Register background tasks
import { AIPersonalityProvider } from '@/constants/AIPersonalityContext';
import { AppSettingsProvider } from '@/constants/AppSettingsContext';
import { AccentProvider, useAccentGradient } from '@/constants/AccentContext';
import { FocusTimeProvider, useFocusTime } from '@/constants/FocusTimeContext';
import { CreationModal } from '@/components/CreationModal';
import { DayCompleteCelebration } from '@/components/DayCompleteCelebration';
import { HabitSheet } from '@/components/Create/HabitSheet';
import { GoalSheet } from '@/components/Create/GoalSheet';
import { TaskFormModal } from '@/components/Tasks/TaskFormModal';
import RevenueCatService from '@/lib/RevenueCat';
// import { SuperwallProvider, SuperwallExpoModule } from 'expo-superwall';
// import * as Linking from 'expo-linking';
import { BiometricGuard } from '@/components/BiometricGuard';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { QuietLoading } from '@/components/Loading/QuietLoading';
import { SiriService } from '@/lib/siriService';
import { emit, on } from '@/lib/appEvents';

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
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const url = response.notification.request.content.data?.url;
      if (url && typeof url === 'string') {
        // Use setTimeout to ensure navigation is ready
        setTimeout(() => {
          try {
            const { router } = require('expo-router');
            router.push(url);
          } catch (e) {
            console.warn('Deep link navigation failed:', e);
          }
        }, 500);
      }
    });

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

  // Connect Live Activity to Focus Context
  // ... (existing code for Live Activity?)

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
  const { isRunning, activeHabitName, totalDuration, timeLeft } = useFocusTime();

  useEffect(() => {
    // One place decides what "today" is for the widget, the lock screen and
    // the Dynamic Island, so they can never disagree with the app.
    const push = async () => {
      try {
        const { syncWidgets } = require('@/lib/widgetSync');
        const { LiveActivityService } = require('@/lib/liveActivityService');
        const day = await syncWidgets();
        if (!day) return;

        await LiveActivityService.startDailyProgress({
          completed: day.completed,
          total: day.total,
          streakDays: day.streak || undefined,
          // While the timer runs the activity counts that down instead.
          ...(isRunning && activeHabitName
            ? { activeHabitName, targetDate: Date.now() + timeLeft * 1000 }
            : { topHabitName: day.nextUp }),
          habits: day.items,
        });
      } catch (error) {
        // The widget being out of date is never worth an error on screen.
        console.log('Widget update failed:', error);
      }
    };

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') push();
    });
    push();

    const completionListener = on('habit_completion_updated', () => {
      push();
      // Finishing the last thing due today is worth marking, once a day.
      require('@/lib/dayComplete').checkDayComplete();
    });
    const taskListener = on('tasks_changed', () => {
      push();
      require('@/lib/dayComplete').checkDayComplete();
    });
    const habitListener = on('habit_updated', () => push());

    return () => {
      subscription.remove();
      completionListener.remove();
      taskListener.remove();
      habitListener.remove();
    };
  }, [isRunning, activeHabitName, timeLeft]);

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
        <CreationModal />
        <HabitSheet listenToGlobalEvents />
        <GoalSheet listenToGlobalEvents />
        <TaskFormModal listenToGlobalEvents />
        <StatusBar style={isDark ? "light" : "dark"} />
      </VoidShell>
    </View>
    </NavigationThemeProvider>
  );
}
