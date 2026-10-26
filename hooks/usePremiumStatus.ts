import { useCallback } from 'react';
import { useAccess } from './useAccess';
import { useHaptics } from './useHaptics';
import { isOpen, refreshAccess, restore } from '@/lib/access';

export const PREMIUM_BUTTONS = [
  'ai_coaching_button'
];

/**
 * Everything is open while Habyss is yours or the free week is running
 * (lib/access.ts): there is one purchase, not tiers of features.
 */
export const usePremiumStatus = () => {
  const { access } = useAccess();
  const { lightFeedback } = useHaptics();
  const isPremium = isOpen(access);

  const paywallGuard = (buttonId: string, onAllow: () => void, onShowPaywall: () => void) => {
    if (isPremium || !PREMIUM_BUTTONS.includes(buttonId)) {
      onAllow();
    } else {
      lightFeedback();
      onShowPaywall();
    }
  };

  const refreshStatus = useCallback(async () => { await refreshAccess(); }, []);
  const restorePurchases = useCallback(() => restore(), []);

  return {
    isPremium,
    loading: access.kind === 'loading',
    refreshStatus,
    paywallGuard,
    restorePurchases
  };
};
