/**
 * Premium Feature Gate
 * 
 * Controls access to premium features gated behind the $20 one-time purchase.
 * Uses RevenueCat as the single source of truth for premium status.
 */

import RevenueCatService from './RevenueCat';

/**
 * Check if user has premium access
 */
export async function isPremium(): Promise<boolean> {
    try {
        return await RevenueCatService.checkProStatus();
    } catch (e) {
        console.warn('[PremiumGate] Error checking premium status:', e);
        return false;
    }
}

/**
 * Features gated behind premium ($20 one-time purchase)
 * Used by UI components to determine what to show/hide
 */
export const PREMIUM_FEATURES = {
    cloudSync: true,        // Supabase cloud sync across devices
    socialFeatures: true,   // Friends, shared goals, nudges, leaderboard
    integrations: true,     // Strava, Spotify, Garmin, Plaid
    aiCloud: true,          // Cloud AI coaching (DeepSeek edge functions)
    pushNotifications: true, // Push notifications from friends (nudges)
} as const;

export type PremiumFeature = keyof typeof PREMIUM_FEATURES;
