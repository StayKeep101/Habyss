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
import { AIPersonalityProvider } from '@/constants/AIPersonalityContext';
import { AppSettingsProvider } from '@/constants/AppSettingsContext';
import { AccentProvider } from '@/constants/AccentContext';
import { FocusTimeProvider } from '@/constants/FocusTimeContext';
import { CreationModal } from '@/components/CreationModal';
import { HabitCreationModal } from '@/components/HabitCreationModal';
// Tutorial removed

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

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

  // --- Live Activity & App State ---
  useEffect(() => {
    const updateLiveActivity = async () => {
      try {
        const { getHabits, getLastNDaysCompletions } = require('@/lib/habitsSQLite');
        const { LiveActivityService } = require('@/lib/liveActivityService');

        const habits = await getHabits();
        const activeHabits = habits.filter((h: any) => !h.isGoal && !h.isArchived);
        const todayCompletions = await getLastNDaysCompletions(1);
        const completedToday = todayCompletions[0]?.completedIds?.length || 0;

        // Find next uncompleted habit
        const completedSet = new Set(todayCompletions[0]?.completedIds || []);
        const nextHabit = activeHabits.find((h: any) => !completedSet.has(h.id));

        await LiveActivityService.startDailyProgress({
          completed: completedToday,
          total: activeHabits.length,
          topHabitName: nextHabit?.name,
        });
      } catch (e) {
        // Live Activity is optional — don't break the app
      }
    };

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        updateLiveActivity();
      }
    });

    // Also start on mount
    updateLiveActivity();

    // Listen for habit completions to update Live Activity
    const { DeviceEventEmitter } = require('react-native');
    const completionListener = DeviceEventEmitter.addListener('habit_completion_updated', () => {
      updateLiveActivity();
    });

    return () => {
      subscription.remove();
      completionListener.remove();
    };
  }, []);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider>
      {/* <StripeAppProvider> */}
      <AppSettingsProvider>
        <AIPersonalityProvider>
          <AccentProvider>
            <FocusTimeProvider>
              {/* TutorialProvider removed */}
              <GestureHandlerRootView style={{ flex: 1 }}>
                <InnerLayout />
              </GestureHandlerRootView>
              {/* TutorialProvider removed */}
            </FocusTimeProvider>
          </AccentProvider>
        </AIPersonalityProvider>
      </AppSettingsProvider>
      {/* </StripeAppProvider> */}
    </ThemeProvider>
  );
}

function InnerLayout() {
  const theme = useColorScheme();
  const isDark = theme !== 'light';

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
        {/* TutorialOverlay removed */}
        <StatusBar style={isDark ? "light" : "dark"} />
      </VoidShell>
    </View>
  );
}
