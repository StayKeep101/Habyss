import { Redirect } from "expo-router";
import React, { useState, useEffect } from 'react';
import { View, useColorScheme } from 'react-native';
import { getLocalUserId, isOnboardingComplete } from '@/lib/localUser';
import { getHabits } from '@/lib/habitsSQLite';
import { Colors } from '@/constants/Colors';
import { HabyssBootScreen } from "@/components/Loading/HabyssBootScreen";

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'light' ? 'light' : 'abyss'];

  useEffect(() => {
    async function init() {
      // Always succeeds — creates a local user ID if none exists
      await getLocalUserId();
      let complete = await isOnboardingComplete();
      if (!complete) {
        // Someone who already has habits has used the app before; sending them
        // through setup again would be wrong even if the flag is missing.
        try {
          const habits = await getHabits();
          if (habits.length > 0) complete = true;
        } catch {
          // Storage unavailable: fall back to the flag alone.
        }
      }
      setOnboarded(complete);
      setReady(true);
    }
    init();
  }, []);

  if (!ready) {
    return <HabyssBootScreen subtitle="Booting your private system" />;
  }

  if (onboarded) {
    return <Redirect href="/(root)/(tabs)/home" />;
  }

  return <Redirect href="/(auth)/onboarding" />;
};
