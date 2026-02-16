import { useState, useEffect, useCallback } from 'react';
import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RevenueCatService, { ProStatus } from '@/lib/RevenueCat';
import { useHaptics } from './useHaptics';

export const PREMIUM_BUTTONS = [
  'ai_coaching_button'
];

export const usePremiumStatus = () => {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const { lightFeedback } = useHaptics();

  const refreshStatus = useCallback(async () => {
    // 1. Check cache first for instant load
    try {
      const cached = await AsyncStorage.getItem('is_premium_cache');
      if (cached !== null) {
        setIsPremium(JSON.parse(cached));
        setLoading(false); // Enable UI immediately based on cache
      }
    } catch (e) {
      // Ignore cache errors
    }

    // 2. Fetch fresh status from RevenueCat
    try {
      console.log('[usePremiumStatus] Refreshing status...');
      const isPro = await RevenueCatService.checkProStatus();
      console.log('[usePremiumStatus] Result:', isPro);

      setIsPremium(isPro);
      setLoading(false); // Ensure loading is off

      // 3. Update cache
      await AsyncStorage.setItem('is_premium_cache', JSON.stringify(isPro));

    } catch (error) {
      console.error('Error refreshing premium status:', error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();

    // Listen for updates (e.g. from Paywall purchase)
    const subscription = DeviceEventEmitter.addListener('premium_status_updated', () => {
      refreshStatus();
    });

    return () => {
      subscription.remove();
    };
  }, [refreshStatus]);

  const paywallGuard = (buttonId: string, onAllow: () => void, onShowPaywall: () => void) => {
    if (isPremium || !PREMIUM_BUTTONS.includes(buttonId)) {
      onAllow();
    } else {
      lightFeedback();
      onShowPaywall();
    }
  };

  const restorePurchases = useCallback(async () => {
    setLoading(true);
    const success = await RevenueCatService.restorePurchases();
    if (success) {
      setIsPremium(true);
    }
    setLoading(false);
    return success;
  }, []);

  return {
    isPremium,
    loading,
    refreshStatus,
    paywallGuard,
    restorePurchases
  };
};
