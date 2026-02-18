import '@/lib/polyfills'; // Must be first
import { ThemeProvider } from "../constants/themeContext";
import { useFonts, Lexend_400Regular, Lexend_500Medium, Lexend_600SemiBold, Lexend_700Bold } from '@expo-google-fonts/lexend';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { Stack } from 'expo-router';
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

import { View, AppState } from 'react-native';
import { VoidShell } from '@/components/Layout/VoidShell';
import { NotificationService } from '@/lib/notificationService';
import '@/lib/LocationService'; // Register background tasks
import { AIPersonalityProvider } from '@/constants/AIPersonalityContext';
import { AppSettingsProvider } from '@/constants/AppSettingsContext';
import { AccentProvider } from '@/constants/AccentContext';
import { FocusTimeProvider, useFocusTime } from '@/constants/FocusTimeContext';
import { RoutineProvider } from '@/constants/RoutineContext';
import { CreationModal } from '@/components/CreationModal';
import { HabitCreationModal } from '@/components/HabitCreationModal';
import RevenueCatService from '@/lib/RevenueCat';
// import { SuperwallProvider, SuperwallExpoModule } from 'expo-superwall';
// import * as Linking from 'expo-linking';
import { BiometricGuard } from '@/components/BiometricGuard';
// // Prevent the splash screen from auto-hiding before asset loading is complete.
// SplashScreen.preventAutoHideAsync();

export default function MobileLayout() {
  const [loaded] = useFonts({
    'Lexend': Lexend_700Bold,
    Lexend_400Regular,
    Lexend_500Medium,
    Lexend_600SemiBold,
    Lexend_700Bold,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    async function prepare() {
      try {
        if (loaded) {
          // Initialize notifications sequence safely
          try {
            await NotificationService.init();
            await NotificationService.registerForPushNotificationsAsync();
            await RevenueCatService.init();
            // Initialize Local LLM in background to avoid blocking startup too much
            // We catch errors internally so it doesn't crash the app if model is missing
            import('@/lib/LocalLLMService').then(service => service.default.init());
          } catch (e) {
            console.warn("Notification initialization failed", e);
          }
        }
      } catch (e) {
        console.warn("Preparation failed", e);
      } finally {
        if (loaded) {
          await SplashScreen.hideAsync();
        }
      }
    }
    prepare();
  }, [loaded]);

  // --- Realtime Notifications Listener ---
  useEffect(() => {
    let channel: any = null;
    const setupListener = async () => {
      // Subscribe to Supabase realtime notifications (for Nudges, etc.)
      channel = await NotificationService.subscribeToRealtimeNotifications(async (notification) => {
        // Show local notification immediately when received
        await Notifications.scheduleNotificationAsync({
          content: {
            title: notification.title,
            body: notification.body,
            sound: 'default',
            data: notification.data
          },
          trigger: null // Immediate
        });
      });
    };

    setupListener();

    return () => {
      if (channel) NotificationService.unsubscribe(channel);
    };
  }, []);

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

  // --- Auth & RevenueCat Sync ---
  useEffect(() => {
    const { supabase } = require('@/lib/supabase');

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      if (session?.user) {
        RevenueCatService.logIn(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: string, session: any) => {
      if (session?.user) {
        console.log('[Auth] User signed in, identifying in RevenueCat');
        await RevenueCatService.logIn(session.user.id);
      } else {
        console.log('[Auth] User signed out, resetting RevenueCat');
        // RevenueCatService.logOut() // Or reset() if defined
        // We might want to keep anonymous access if they log out, but usually for extensive apps we reset.
        // But RevenueCat.ts might not have logOut method exposed properly yet.
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (!loaded) {
    return null;
  }

  return (
    // <SuperwallProvider apiKeys={{ ios: "pk_UMIRgoqWMWWOJ9H2Lp6RG" }}>
    <ThemeProvider>
      <AppSettingsProvider>
        <AIPersonalityProvider>
          <AccentProvider>
            <FocusTimeProvider>
              <RoutineProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <BiometricGuard>
                    <InnerLayout />
                  </BiometricGuard>
                </GestureHandlerRootView>
              </RoutineProvider>
            </FocusTimeProvider>
          </AccentProvider>
        </AIPersonalityProvider>
      </AppSettingsProvider>
    </ThemeProvider>
    // </SuperwallProvider>
  );
}

function InnerLayout() {
  const theme = useColorScheme();
  const isDark = theme !== 'light';

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

        // 3. Check for Log Habit Intent
        const pendingLogs = await SharedDefaults.getArray('pending_habit_logs');
        if (pendingLogs && pendingLogs.length > 0) {
          console.log('[AppIntents] Processing pending logs:', pendingLogs);
          const { toggleCompletion, getHabits } = require('@/lib/habitsSQLite');
          const habits = await getHabits();

          for (const habitName of pendingLogs) {
            const habit = habits.find((h: any) => h.name.toLowerCase() === habitName.toLowerCase());
            if (habit) {
              await toggleCompletion(habit.id, new Date().toISOString().split('T')[0]);
            }
          }
          await SharedDefaults.remove('pending_habit_logs');
        }

      } catch (e) {
        console.warn('[AppIntents] Error checking intents:', e);
      }
    };

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        checkIntents();
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
    const updateLiveActivity = async () => {
      try {
        const { getHabits, getLastNDaysCompletions } = require('@/lib/habitsSQLite');
        const { LiveActivityService } = require('@/lib/liveActivityService');
        const { WidgetService } = require('@/lib/widgetService');

        // Always sync habits to widget (home screen + lock screen widgets)
        const habits = await getHabits();
        const activeHabits = habits.filter((h: any) => !h.isGoal && !h.isArchived);
        const todayCompletions = await getLastNDaysCompletions(1);
        const completedToday = todayCompletions[0]?.completedIds?.length || 0;
        const completedSet = new Set(todayCompletions[0]?.completedIds || []);

        // Sync habit data to widget
        const widgetHabits = activeHabits.map((h: any) => ({
          id: h.id,
          name: h.name,
          isCompleted: completedSet.has(h.id)
        }));
        await WidgetService.syncHabitsToWidget(widgetHabits);

        // 1. If Timer is running, show Focus Timer in Live Activity
        if (isRunning && activeHabitName) {
          const now = Date.now();
          const targetDate = now + (timeLeft * 1000);

          await LiveActivityService.startDailyProgress({
            completed: completedToday,
            total: activeHabits.length,
            activeHabitName: activeHabitName,
            targetDate: targetDate,
            habits: widgetHabits,
          });
          return;
        }

        // 2. Otherwise show Daily Progress (Default)
        const nextHabit = activeHabits.find((h: any) => !completedSet.has(h.id));

        await LiveActivityService.startDailyProgress({
          completed: completedToday,
          total: activeHabits.length,
          topHabitName: nextHabit?.name,
          habits: widgetHabits,
        });
      } catch (e) {
        // Live Activity is optional
        console.log('Live Activity Update Error:', e);
      }
    };

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        updateLiveActivity();
      }
    });

    // Initial update
    updateLiveActivity();

    // Listen for habit completions
    const { DeviceEventEmitter } = require('react-native');
    const completionListener = DeviceEventEmitter.addListener('habit_completion_updated', () => {
      updateLiveActivity();
    });

    return () => {
      subscription.remove();
      completionListener.remove();
    };
  }, [isRunning, activeHabitName]); // Re-run when timer state changes

  return (
    <View style={{ flex: 1 }} className={theme}>
      <VoidShell>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(root)" />
          <Stack.Screen name="+not-found" />
        </Stack>
        <CreationModal />
        <HabitCreationModal />
        <StatusBar style={isDark ? "light" : "dark"} />
      </VoidShell>
    </View>
  );
}
