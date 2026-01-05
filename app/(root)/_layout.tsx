import React from 'react';
import { Stack } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { HabitCreationModal } from '@/components/HabitCreationModal';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="notifications"
          options={{
            headerShown: false,
            presentation: 'modal'
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            headerShown: false,
            presentation: 'modal'
          }}
        />
        <Stack.Screen
          name="privacy"
          options={{
            headerShown: false,
            presentation: 'modal'
          }}
        />
        <Stack.Screen
          name="data-storage"
          options={{
            headerShown: false,
            presentation: 'modal'
          }}
        />
        <Stack.Screen
          name="create"
          options={{
            headerShown: false,
            presentation: 'modal'
          }}
        />
        <Stack.Screen
          name="roadmap"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="habit-detail"
          options={{
            headerShown: false,
            presentation: 'modal'
          }}
        />
        <Stack.Screen
          name="statistics"
          options={{
            headerShown: false,
            presentation: 'modal'
          }}
        />
        <Stack.Screen
          name="goal-detail"
          options={{
            headerShown: false,
            presentation: 'modal'
          }}
        />
        <Stack.Screen
          name="ai-settings"
          options={{
            headerShown: false,
            presentation: 'modal'
          }}
        />
      </Stack>
      <HabitCreationModal />
    </>
  );
}
