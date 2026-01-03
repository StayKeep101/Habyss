import { ThemeProvider } from "../constants/themeContext";
import { useFonts, Lexend_400Regular, Lexend_500Medium, Lexend_600SemiBold, Lexend_700Bold } from '@expo-google-fonts/lexend';
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
import { CreationModal } from '@/components/CreationModal';
import { HabitCreationModal } from '@/components/HabitCreationModal';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function MobileLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    Lexend_400Regular,
    Lexend_500Medium,
    Lexend_600SemiBold,
    Lexend_700Bold,
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();

      // Initialize notifications sequence
      const setupNotifications = async () => {
        await NotificationService.init();
        await NotificationService.registerForPushNotificationsAsync();
      };
      setupNotifications();
    }
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
          <GestureHandlerRootView style={{ flex: 1 }}>
            <InnerLayout />
          </GestureHandlerRootView>
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
        <StatusBar style={isDark ? "light" : "dark"} />
      </VoidShell>
    </View>
  );
}
