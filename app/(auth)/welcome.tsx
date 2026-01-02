import React, { useState } from 'react';
import { View, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { VoidShell } from '@/components/Layout/VoidShell';
import { GenesisIntro } from '@/components/Onboarding/GenesisIntro';
import { GenesisCarousel } from '@/components/Onboarding/GenesisCarousel';
import Animated, { FadeIn } from 'react-native-reanimated';

export default function WelcomeScreen() {
  const [showIntro, setShowIntro] = useState(true);

  const handleIntroComplete = () => {
    setShowIntro(false);
  };

  const handleFinish = () => {
    router.push('/(auth)/sign-up');
  };

  const handleLogin = () => {
    router.push('/(auth)/sign-in');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar barStyle="light-content" />

      {showIntro ? (
        <GenesisIntro onComplete={handleIntroComplete} />
      ) : (
        <VoidShell>
          <Animated.View style={{ flex: 1 }} entering={FadeIn.duration(1000)}>
            <GenesisCarousel
              onFinish={handleFinish}
              onLogin={handleLogin}
            />
          </Animated.View>
        </VoidShell>
      )}
    </View>
  );
}
