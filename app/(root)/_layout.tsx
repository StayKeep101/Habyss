import { useEffect } from 'react';
import { AccessGate } from '@/components/Paywall/AccessGate';
import { Stack } from 'expo-router';
import { DemonEdge } from '@/components/ui/DemonEdge';
import { TiltToFocus } from '@/hooks/useTiltToFocus';
import { useTaskPressure } from '@/hooks/useTaskPressure';

// A direct account/email link still needs a screen beneath its modal.
export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {

  // Initialize SQLite database (sync removed — local-only mode)
  useEffect(() => {
    async function initDB() {
      try {
        const database = await import('@/lib/database');

        if (database.isSQLiteAvailable()) {
          await database.getDatabase();
          console.log('[App] SQLite database initialized');
        }
      } catch (error) {
        console.log('[App] SQLite not available:', error);
      }
    }
    initDB();
  }, []);

  const pressure = useTaskPressure();
  const demon = pressure.level === 4 && pressure.demonAllowed;

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="ai-config" options={{ presentation: 'modal' }} />
        <Stack.Screen name="guide" options={{ headerShown: false, presentation: 'modal' }} />
        {/* Focus mode: the whole screen, no swipe away (leaving is the × , which pauses). */}
        <Stack.Screen name="focus" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="goals-overview" options={{ presentation: 'modal' }} />
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
            presentation: 'modal',
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
          name="ui-catalog"
          options={{
            headerShown: false,
            presentation: 'modal'
          }}
        />
        <Stack.Screen
          name="account"
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen
          name="all-habits"
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen
          name="goal-roadmap"
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen
          name="progress"
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen
          name="goal-stats"
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen
          name="task-stats"
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen
          name="focus-stats"
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen
          name="meals"
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen
          name="goal-plan"
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen
          name="add-friend"
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen
          name="leaderboard"
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen
          name="brain-dump"
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen
          name="inbox"
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen
          name="sharing"
          options={{ headerShown: false, presentation: 'modal' }}
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

      </Stack>
      {/* The free week, and the lock after it until Habyss is bought. */}
      <AccessGate />
      {/* Demon mode: far behind on tasks, the edge of the screen glows red (lib/taskPressure.ts). */}
      <DemonEdge on={demon} />
      {/* Phone on its side: focus on what is due now. */}
      <TiltToFocus />
    </>
  );
}
