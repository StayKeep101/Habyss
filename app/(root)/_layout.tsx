import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Initialize SQLite database and start sync (only if available)
  useEffect(() => {
    async function initDB() {
      try {
        const database = await import('@/lib/database');

        if (database.isSQLiteAvailable()) {
          await database.getDatabase();
          console.log('[App] SQLite database initialized');

          const sync = await import('@/lib/syncService');
          sync.startSyncService();

          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await sync.fullSync(user.id);
          }
        } else {
          console.log('[App] Running in Supabase-only mode (Expo Go)');
        }
      } catch (error) {
        console.log('[App] SQLite not available, using Supabase-only mode');
      }
    }
    initDB();
  }, []);

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
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

        {/* app-settings removed */}
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
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="habit-detail"
          options={{
            headerShown: false,
            presentation: 'modal'
          }}
        />
        {/* statistics removed */}
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

        <Stack.Screen
          name="appearance"
          options={{
            headerShown: false,
            presentation: 'modal'
          }}
        />
        <Stack.Screen
          name="integrations"
          options={{
            headerShown: false,
            presentation: 'modal'
          }}
        />
        <Stack.Screen
          name="help"
          options={{
            headerShown: false,
            presentation: 'modal'
          }}
        />
        <Stack.Screen
          name="contact"
          options={{
            headerShown: false,
            presentation: 'modal'
          }}
        />
        <Stack.Screen
          name="about"
          options={{
            headerShown: false,
            presentation: 'modal'
          }}
        />
        <Stack.Screen
          name="routine-detail"
          options={{
            headerShown: false,
            presentation: 'modal'
          }}
        />
      </Stack>
    </>
  );
}
