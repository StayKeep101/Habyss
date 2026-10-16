import { Tabs } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/theme/colors';
import { GlassDock } from '@/components/TabBar/GlassDock';
import { useDayCardPublisher } from '@/hooks/useDayCardPublisher';
import { useAppSounds } from '@/hooks/useAppSounds';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  // Today's progress card, kept current for your friends' chats.
  useDayCardPublisher();
  // Sounds for the app's moments: a task done, a day closed, a goal reached.
  useAppSounds();

  return (
    <Tabs
      tabBar={(props) => <GlassDock {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
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