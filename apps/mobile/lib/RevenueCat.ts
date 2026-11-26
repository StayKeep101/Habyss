import Purchases, { PurchasesOffering, PurchasesPackage, PurchasesStoreProduct, CustomerInfo, LOG_LEVEL, PRODUCT_CATEGORY } from 'react-native-purchases';
import { Platform } from 'react-native';
import { PAYWALL_ENABLED } from '@/constants/features';

// No fallback key on purpose: a test-store key silently breaks real purchases and
// App Review. Missing config must surface, not degrade quietly.
const API_KEYS = {
    apple: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY || '',
    google: process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY || '',
};

const ENTITLEMENT_IDS = ['Habyss Pro', 'pro'];

export interface ProStatus {
    isPro: boolean;
    activeSubscription: string | null;
    expirationDate: string | null;
}

class RevenueCatService {
    private static instance: RevenueCatService;
    private isInitialized = false;
    private currentAppUserId?: string;

    private constructor() { }

    static getInstance(): RevenueCatService {
        if (!RevenueCatService.instance) {
            RevenueCatService.instance = new RevenueCatService();
        }
        return RevenueCatService.instance;
    }

    private getApiKeyForCurrentPlatform(): string | null {
        if (Platform.OS === 'ios') return API_KEYS.apple || null;
        if (Platform.OS === 'android') return API_KEYS.google || null;
        return null;
    }

    isConfigured(): boolean {
        return !!this.getApiKeyForCurrentPlatform();
    }

    private async ensureInitialized(userId?: string): Promise<boolean> {
        const desiredUserId = userId || this.currentAppUserId;

        if (!this.isConfigured()) {
            // Only worth saying when somebody is actually trying to sell
            // something. With the paywall off this is a warning about a
            // deliberate decision, printed on every launch.
            if (PAYWALL_ENABLED) console.warn(`[RevenueCat] Missing API key for ${Platform.OS}`);
            return false;
        }

        if (!this.isInitialized) {
            await this.init(desiredUserId);
            return this.isInitialized;
        }

        if (desiredUserId && desiredUserId !== this.currentAppUserId) {
            try {
                await Purchases.logIn(desiredUserId);
                this.currentAppUserId = desiredUserId;
            } catch (e) {
                console.error('[RevenueCat] Login sync error:', e);
                return false;
            }
        }

        return true;
    }

    async init(userId?: string) {
        if (this.isInitialized) return;

        const apiKey = this.getApiKeyForCurrentPlatform();
        if (!apiKey) {
            // A warning, not a throw: a missing key must only disable purchases,
            // never the notifications, Siri and widgets that start alongside it.
            // The paywall shows its unconfigured state — and while the paywall
            // is off, a missing key is the configuration rather than a fault.
            if (PAYWALL_ENABLED) {
                console.warn(
                    `[RevenueCat] No API key for ${Platform.OS}. Set EXPO_PUBLIC_REVENUECAT_`
                    + `${Platform.OS === 'ios' ? 'APPLE' : 'GOOGLE'}_API_KEY (eas env:create)`
                    + ' — purchases cannot work without it.',
                );
            }
            return;
        }

        Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);

        Purchases.configure({ apiKey, appUserID: userId });

        this.isInitialized = true;
        this.currentAppUserId = userId;
        console.log('[RevenueCat] Initialized');
    }

    async logIn(userId: string) {
        const initialized = await this.ensureInitialized(userId);
        if (!initialized) {
            return;
        }

        try {
            await Purchases.logIn(userId);
            this.currentAppUserId = userId;
        } catch (e) {
            console.error('[RevenueCat] Login error:', e);
        }
    }

    async logOut() {
        if (!this.isInitialized) return;

        try {
            await Purchases.logOut();
            console.log('[RevenueCat] Logged out');
        } catch (e) {
            console.error('[RevenueCat] Logout error:', e);
        }
    }

    async getOfferings(): Promise<PurchasesOffering | null> {
        const initialized = await this.ensureInitialized();
        if (!initialized) return null;

        try {
            const offerings = await Purchases.getOfferings();
            if (offerings.current !== null) {
                return offerings.current;
            }
            return null;
        } catch (e) {
            console.error('[RevenueCat] Error fetching offerings:', e);
            return null;
        }
    }

    async purchasePackage(
        pkg: PurchasesPackage
    ): Promise<{ isPro: boolean; customerInfo: CustomerInfo }> {
        const initialized = await this.ensureInitialized();
        if (!initialized) {
            throw new Error(`RevenueCat is not configured for ${Platform.OS}`);
        }

        try {
            const { customerInfo } = await Purchases.purchasePackage(pkg);
            const isPro = this.checkProEntitlement(customerInfo);
            return { isPro, customerInfo };
        } catch (e: any) {
            if (!e.userCancelled) {
                console.error('[RevenueCat] Purchase error:', e);
                throw e;
            }
            throw new Error('User cancelled');
        }
    }

    /** A one-off purchase (the coffee), or null when the store or key is not set up. */
    async getOneOff(productId: string): Promise<PurchasesStoreProduct | null> {
        if (!(await this.ensureInitialized())) return null;
        try {
            const [product] = await Purchases.getProducts([productId], PRODUCT_CATEGORY.NON_SUBSCRIPTION);
            return product ?? null;
        } catch {
            return null;
        }
    }

    /** Buys it. 'cancelled' when the person closes Apple's sheet; that is not an error. */
    async buyOneOff(product: PurchasesStoreProduct): Promise<'bought' | 'cancelled' | 'failed'> {
        if (!(await this.ensureInitialized())) return 'failed';
        try {
            await Purchases.purchaseStoreProduct(product);
            return 'bought';
        } catch (e: any) {
            return e?.userCancelled ? 'cancelled' : 'failed';
        }
    }

    /** A subscription (Habyss Pro), or null when the store or key is not set up. */
    async getSubscription(productId: string): Promise<PurchasesStoreProduct | null> {
        if (!(await this.ensureInitialized())) return null;
        try {
            const [product] = await Purchases.getProducts([productId], PRODUCT_CATEGORY.SUBSCRIPTION);
            return product ?? null;
        } catch {
            return null;
        }
    }

    /** Whether Habyss Pro is active, until when and whether it renews, or null if the store is unreachable. */
    async proInfo(): Promise<{ active: boolean; until: number | null; renews: boolean } | null> {
        if (!(await this.ensureInitialized())) return null;
        try {
            const info = await Purchases.getCustomerInfo();
            const entitlement = ENTITLEMENT_IDS.map(id => info.entitlements.active[id]).find(Boolean);
            if (entitlement) return { active: true, until: entitlement.expirationDateMillis ?? null, renews: entitlement.willRenew };
            // Bought for life before Habyss went free: Pro for good.
            const { LEGACY_LIFETIME } = require('@/lib/access') as typeof import('@/lib/access');
            const lifetime = info.nonSubscriptionTransactions.some(transaction => (LEGACY_LIFETIME as readonly string[]).includes(transaction.productIdentifier));
            return { active: lifetime, until: null, renews: false };
        } catch {
            return null;
        }
    }

    /** Apple's subscription page for this app. */
    async manageSubscriptions(): Promise<void> {
        if (!(await this.ensureInitialized())) return;
        try { await Purchases.showManageSubscriptions(); } catch { /* Settings still has it */ }
    }

    async restorePurchases(): Promise<boolean> {
        const initialized = await this.ensureInitialized();
        if (!initialized) return false;

        try {
            const customerInfo = await Purchases.restorePurchases();
            return this.checkProEntitlement(customerInfo);
        } catch (e) {
            console.error('[RevenueCat] Restore error:', e);
            throw e;
        }
    }

    async checkProStatus(): Promise<boolean> {
        const initialized = await this.ensureInitialized();
        if (!initialized) return false;

        try {
            const customerInfo = await Purchases.getCustomerInfo();
            return this.checkProEntitlement(customerInfo);
        } catch (e) {
            console.error('[RevenueCat] Check status error:', e);
            return false;
        }
    }

    private checkProEntitlement(customerInfo: CustomerInfo): boolean {
        return ENTITLEMENT_IDS.some(id => customerInfo.entitlements.active[id] !== undefined);
    }
}

export default RevenueCatService.getInstance();
