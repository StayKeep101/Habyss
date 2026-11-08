/**
 * What Habyss costs: nothing. Every part of the phone app is free, for good,
 * and so is the desktop app on its own.
 *
 * Habyss Pro is the one thing for sale: your phone and the desktop app kept
 * in sync, $4.99 a month, an auto-renewing subscription through the App Store
 * (cancel any time in Settings → Apple ID → Subscriptions). Nothing on the
 * phone is ever locked behind it; whether you have it is read here and shown
 * on its page (components/Paywall/Paywall.tsx).
 *
 * The desktop app checks the same entitlement for the same account
 * (RevenueCat's app user id is the Supabase account id, app/_layout.tsx).
 */
import { PAYWALL_ENABLED } from '@/constants/features';

export const PRO = {
    /** $4.99, auto-renewing, one month. */
    product: 'habyss_pro_monthly',
    /** Shown before the store answers; the store's own price, in the person's currency, replaces it. */
    fallbackPrice: '$4.99',
} as const;

/** Older purchases: Habyss bought for life before it went free counts as Pro, for good. */
export const LEGACY_LIFETIME = ['habyss_lifetime', 'habyss_lifetime_friend'] as const;

export type Pro =
    | { kind: 'loading' }
    | { kind: 'free' }
    /** `until` is null for a lifetime purchase; `renews` false once cancelled (it runs to `until`). */
    | { kind: 'pro'; until: number | null; renews: boolean };

export interface ProInfo { active: boolean; until: number | null; renews: boolean }

/** Where you stand, from what the store says. Pure, so it is tested. */
export function proFrom(info: ProInfo | null): Pro {
    if (!info || !info.active) return { kind: 'free' };
    return { kind: 'pro', until: info.until, renews: info.renews };
}

const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

/** What the line under the price says once Pro is on. */
export function proStatusLine(pro: Pro): string | null {
    if (pro.kind !== 'pro') return null;
    if (pro.until === null) return 'Pro is yours for good.';
    return pro.renews ? `Pro is on. Renews ${day(pro.until)}.` : `Pro is on until ${day(pro.until)}. It won’t renew.`;
}

/* ------------------------------------------------------------- the store */

let state: Pro = { kind: 'loading' };
const listeners = new Set<() => void>();
const set = (next: Pro) => { state = next; listeners.forEach(listener => listener()); };

export const getPro = () => state;
export function onProChange(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

const revenueCat = () => (require('@/lib/RevenueCat') as typeof import('@/lib/RevenueCat')).default;
/** Whether Pro can be bought on this build: the store switched on and a key present. */
export const canBuyPro = () => PAYWALL_ENABLED && revenueCat().isConfigured();

let cleared = false;
/** Asks the store again whether Pro is active. */
export async function refreshPro(): Promise<Pro> {
    if (!cleared) {
        cleared = true;
        // The old free-trial reminder, scheduled by earlier versions: there is no trial now.
        try {
            const Notifications = require('expo-notifications') as typeof import('expo-notifications');
            void Notifications.cancelScheduledNotificationAsync('habyss-trial-ending').catch(() => undefined);
        } catch { /* nothing to clear */ }
    }
    const pro = proFrom(canBuyPro() ? await revenueCat().proInfo() : null);
    set(pro);
    return pro;
}

/** Subscribes to Pro: Apple's sheet shows the price and the renewal before anything is charged. */
export async function buyPro(): Promise<'bought' | 'cancelled' | 'failed'> {
    const service = revenueCat();
    const product = await service.getSubscription(PRO.product);
    if (!product) return 'failed';
    const result = await service.buyOneOff(product);
    if (result === 'bought') await refreshPro();
    return result;
}

export async function restorePro(): Promise<boolean> {
    try { await revenueCat().restorePurchases(); } catch { return false; }
    return (await refreshPro()).kind === 'pro';
}

/** Apple's own subscription page: change or cancel, in two taps. */
export async function manageSubscription(): Promise<void> {
    await revenueCat().manageSubscriptions();
}
