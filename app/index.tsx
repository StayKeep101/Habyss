import { Redirect } from "expo-router";
import React, { useState, useEffect } from 'react';
import { View, useColorScheme } from 'react-native';
import { getLocalUserId, isOnboardingComplete } from '@/lib/localUser';
import { Colors } from '@/constants/Colors';
import { SpinningLogo } from "@/components/SpinningLogo";

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'light' ? 'light' : 'abyss'];

  useEffect(() => {
    async function init() {
      // Always succeeds — creates a local user ID if none exists
      await getLocalUserId();
      const complete = await isOnboardingComplete();
      setOnboarded(complete);
      setReady(true);
    }
    init();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <SpinningLogo />
      </View>
    );
  }

  if (onboarded) {
    return <Redirect href="/(root)/(tabs)/home" />;
  }

  return <Redirect href="/(auth)/welcome" />;
};
