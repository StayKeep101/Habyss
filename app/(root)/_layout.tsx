import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { Dimensions } from 'react-native';
import { DemonEdge } from '@/components/ui/DemonEdge';
import { useTaskPressure } from '@/hooks/useTaskPressure';

/**
 * How tall the habit sheet opens: room for the same things on every phone
 * (the close and edit buttons, the icon and a two-line name, Mark done and
 * the row of stats, clear of the fade under them), about 410 pt. Half of a
 * big phone; more of a small one, so the stats never sit under the fade.
 */
const HABIT_SHEET_OPEN = Math.min(0.8, Math.max(0.45, 410 / Dimensions.get('window').height));

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
        {/* Fades in, not up: the page becomes the void Focus opens from (components/Focus/FocusPortal). */}
        <Stack.Screen name="focus" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }} />
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
            // Opens at half (HABIT_SHEET_OPEN): the icon, the name, the tick and
            // the stats. Pull it up (or scroll) for the rest: the heat map, settings.
            presentation: 'formSheet',
            sheetAllowedDetents: [HABIT_SHEET_OPEN, 1],
            sheetInitialDetentIndex: 0,
            sheetGrabberVisible: true,
            sheetExpandsWhenScrolledToEdge: true,
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
          name="plus-button"
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
      {/* Demon mode: far behind on tasks, the edge of the screen glows red (lib/taskPressure.ts). */}
      <DemonEdge on={demon} />
      {/* Phone on its side: focus on what is due now. */}
    </>
  );
}
