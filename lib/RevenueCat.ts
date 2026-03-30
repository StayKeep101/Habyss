import Purchases, { PurchasesOffering, PurchasesPackage, CustomerInfo, LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';

const API_KEYS = {
    apple: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY || 'test_EdqZuOzgwERAuCejCCNfNMRicdW',
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
            console.warn(`[RevenueCat] Missing API key for ${Platform.OS}`);
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
            console.warn(`[RevenueCat] Skipping initialization: no API key for ${Platform.OS}`);
            return;
        }

        Purchases.setLogLevel(LOG_LEVEL.DEBUG);

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
        console.log('[RevenueCat] Checking Entitlements:', JSON.stringify(customerInfo.entitlements.active, null, 2));

        for (const entitlementId of ENTITLEMENT_IDS) {
            if (customerInfo.entitlements.active[entitlementId] !== undefined) {
                console.log('[RevenueCat] User IS Pro');
                return true;
            }
        }

        console.log('[RevenueCat] User is NOT Pro');
        return false;
    }
}

export default RevenueCatService.getInstance();
