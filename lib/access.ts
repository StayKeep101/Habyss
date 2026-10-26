/**
 * Whether Habyss is open to you: a 7-day free trial, then one payment of $20
 * to keep it for good. Somebody who came through a friend's invite pays half,
 * and so does whoever invites three people who join.
 *
 * The trial is Apple's way for an app with no subscription: a free
 * "7-day Trial" purchase (App Store Review Guideline 3.1.1), so the day it
 * started is kept by the App Store and survives a reinstall. If that product
 * cannot be reached the trial starts on this phone alone.
 *
 * Nothing is ever locked when there is no way to pay (the paywall switched
 * off, or no store key on this build): a lock you cannot open is a bug.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PAYWALL_ENABLED } from '@/constants/features';

export const TRIAL_DAYS = 7;
export const FRIENDS_NEEDED = 3;
export const PRODUCTS = {
    /** $19.99, non-consumable. */
    full: 'habyss_lifetime',
    /** $9.99, non-consumable: the friend price. */
    friend: 'habyss_lifetime_friend',
    /** $0, non-consumable, named "7-day Trial". */
    trial: 'habyss_trial_7day',
} as const;

const DAY = 24 * 60 * 60 * 1000;
const TRIAL_KEY = 'habyss_trial_started';

export type Access =
    | { kind: 'loading' }
    | { kind: 'owned' }
    | { kind: 'not_started' }
    | { kind: 'trial'; daysLeft: number; endsAt: number }
    | { kind: 'ended' };

export interface Referral { invitedBy: string | null; joined: number }

/** Where you stand, from what is known. Pure, so it is tested. */
export function accessFrom({ billing, owned, trialStart, now }: { billing: boolean; owned: boolean; trialStart: number | null; now: number }): Access {
    if (!billing || owned) return { kind: 'owned' };
    if (trialStart === null) return { kind: 'not_started' };
    const endsAt = trialStart + TRIAL_DAYS * DAY;
    if (now >= endsAt) return { kind: 'ended' };
    return { kind: 'trial', daysLeft: Math.max(1, Math.ceil((endsAt - now) / DAY)), endsAt };
}

/** Half price: you were invited, or three people you invited have joined. */
export const friendPrice = (referral: Referral | null) => !!referral && (!!referral.invitedBy || referral.joined >= FRIENDS_NEEDED);

/** You can use the app: it is yours or the trial is running. */
export const isOpen = (access: Access) => access.kind === 'owned' || access.kind === 'trial' || access.kind === 'loading';

/* ------------------------------------------------------------- the store */

type State = { access: Access; referral: Referral | null };
let state: State = { access: { kind: 'loading' }, referral: null };
const listeners = new Set<() => void>();
const set = (next: Partial<State>) => { state = { ...state, ...next }; listeners.forEach(listener => listener()); };

export const getAccess = () => state;
export function subscribeAccess(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

const revenueCat = () => (require('@/lib/RevenueCat') as typeof import('@/lib/RevenueCat')).default;
const billingAvailable = () => PAYWALL_ENABLED && revenueCat().isConfigured();

async function localTrialStart(): Promise<number | null> {
    try {
        const saved = await AsyncStorage.getItem(TRIAL_KEY);
        return saved ? Number(saved) || null : null;
    } catch { return null; }
}

/** Asks the store again: is it bought, when did the trial start, who invited whom. */
export async function refreshAccess(): Promise<Access> {
    const billing = billingAvailable();
    let owned = false;
    let trialStart = await localTrialStart();
    if (billing) {
        const info = await revenueCat().customerInfo();
        if (info) {
            owned = info.owned;
            // The App Store's date wins: it is the same on every phone.
            if (info.trialStart !== null) trialStart = trialStart === null ? info.trialStart : Math.min(trialStart, info.trialStart);
        }
    }
    const access = accessFrom({ billing, owned, trialStart, now: Date.now() });
    set({ access });
    if (billing && access.kind !== 'owned') {
        const { referralStatus } = require('@/lib/referrals') as typeof import('@/lib/referrals');
        void referralStatus().then(referral => set({ referral })).catch(() => undefined);
    }
    return access;
}

/** Starts the 7 free days (Apple's free trial purchase where there is one). */
export async function startTrial(): Promise<'started' | 'cancelled'> {
    if (billingAvailable()) {
        const service = revenueCat();
        const product = await service.getOneOff(PRODUCTS.trial);
        if (product) {
            const result = await service.buyOneOff(product);
            if (result === 'cancelled') return 'cancelled';
        }
    }
    const start = Date.now();
    try { await AsyncStorage.setItem(TRIAL_KEY, String(start)); } catch { /* the store's date still holds */ }
    void remindBeforeTheEnd(start);
    await refreshAccess();
    return 'started';
}

/** Buys Habyss for good, at full or friend price. */
export async function buy(price: 'full' | 'friend'): Promise<'bought' | 'cancelled' | 'failed'> {
    const service = revenueCat();
    const product = await service.getOneOff(PRODUCTS[price]);
    if (!product) return 'failed';
    const result = await service.buyOneOff(product);
    if (result === 'bought') {
        await refreshAccess();
        (require('@/lib/appEvents') as typeof import('@/lib/appEvents')).emit('premium_status_updated');
    }
    return result;
}

export async function restore(): Promise<boolean> {
    try { await revenueCat().restorePurchases(); } catch { return false; }
    const access = await refreshAccess();
    return access.kind === 'owned';
}

/** A day before the trial ends, a quiet note (only if notifications are already allowed). */
async function remindBeforeTheEnd(start: number) {
    try {
        const Notifications = require('expo-notifications') as typeof import('expo-notifications');
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return;
        const at = new Date(start + (TRIAL_DAYS - 1) * DAY);
        await Notifications.scheduleNotificationAsync({
            identifier: 'habyss-trial-ending',
            content: { title: 'Your free week ends tomorrow', body: 'Keep Habyss for good with one payment, or half price with friends.' },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
        });
    } catch { /* a reminder is a kindness, not a requirement */ }
}

/** Developer tools: test the end of the trial without waiting a week. */
export async function setTrialStartForTesting(start: number | null) {
    try {
        if (start === null) await AsyncStorage.removeItem(TRIAL_KEY);
        else await AsyncStorage.setItem(TRIAL_KEY, String(start));
    } catch { /* nothing */ }
    await refreshAccess();
}
export const TRIAL_LENGTH_MS = TRIAL_DAYS * DAY;
