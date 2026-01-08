import { Redirect } from "expo-router";
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, useColorScheme } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Colors } from '@/constants/Colors';
import { SpinningLogo } from "@/components/SpinningLogo";

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'light' ? 'light' : 'abyss'];

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <SpinningLogo />
      </View>
    );
  }

  if (session) {
    return <Redirect href="/(root)/(tabs)/home" />;
  }

  return <Redirect href="/(auth)/welcome" />;
};


