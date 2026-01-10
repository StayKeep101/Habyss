import { ThemeProvider } from "../constants/themeContext";
import { useFonts, Lexend_400Regular, Lexend_500Medium, Lexend_600SemiBold, Lexend_700Bold } from '@expo-google-fonts/lexend';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { Stack } from 'expo-router';
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
  }, [loaded]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        // App became active
      }
    });

    return () => {
      subscription.remove();
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
