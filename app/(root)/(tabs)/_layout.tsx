import { Tabs } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/theme/colors';
import { GlassDock } from '@/components/TabBar/GlassDock';
import { useDayCardPublisher } from '@/hooks/useDayCardPublisher';
import { useAppSounds } from '@/hooks/useAppSounds';
import { useLivePulse } from '@/hooks/useLivePulse';
import { useFocusStatus, useStatusBroadcast } from '@/hooks/useStatusBroadcast';
import { READABLE_WIDTH, useResponsiveLayout } from '@/hooks/useResponsiveLayout';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  // Today's progress card, kept current for your friends' chats.
  useDayCardPublisher();
  // Sounds for the app's moments: a task done, a day closed, a goal reached.
  useAppSounds();
  // Friends see your day change as it happens.
  useLivePulse();
  // Your status for friends: live, locked in, or (at your bedtime) asleep.
  useStatusBroadcast();
  useFocusStatus();
  // iPad and an open foldable: the tabs become a rail down the left and each
  // page keeps a readable width in the space beside it.
  const { railed } = useResponsiveLayout();

  return (
    <Tabs
      tabBar={(props) => <GlassDock {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarPosition: railed ? 'left' : 'bottom',
        sceneStyle: railed ? { width: '100%', maxWidth: READABLE_WIDTH, alignSelf: 'center', backgroundColor: colors.background } : undefined,
        tabBarStyle: {
          position: 'absolute',
        }
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home"
        }}
      />
      <Tabs.Screen
        name="roadmap"
        options={{
          title: "Calendar"
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: "Community"
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Profile"
        }}
      />
    </Tabs>
  );
}