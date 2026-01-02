import { useState, useEffect, useCallback } from 'react';
import { StripeService, SubscriptionStatus } from '@/lib/stripeService';
import { useHaptics } from './useHaptics';

export const PREMIUM_BUTTONS = [
  'ai_coaching_button'
];

export const usePremiumStatus = () => {
  const [status, setStatus] = useState<SubscriptionStatus>({
    premium: false,
    status: 'inactive',
    expires: null
  });
  const [loading, setLoading] = useState(true);
  const { lightFeedback } = useHaptics();

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    try {
      const currentStatus = await StripeService.getSubscriptionStatus();
      setStatus(currentStatus);
    } catch (error) {
      console.error('Error refreshing premium status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const isPremium = status.premium;

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
    const success = await StripeService.restorePurchases();
    if (success) {
      await refreshStatus();
    }
    setLoading(false);
    return success;
  }, [refreshStatus]);


  return {
    isPremium,
    status,
    loading,
    refreshStatus,
    refreshStatus,
    paywallGuard,
    restorePurchases
  };
};
