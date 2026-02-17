import Purchases, { PurchasesOffering, PurchasesPackage, CustomerInfo, LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';

// TODO: Replace with your actual RevenueCat API Keys
const API_KEYS = {
    apple: 'test_EdqZuOzgwERAuCejCCNfNMRicdW', // Set from user request
    google: 'goog_placeholder', // REPLACE THIS
};

const ENTITLEMENT_ID = 'Habyss Pro'; // Must match your RevenueCat Entitlement ID

export interface ProStatus {
    isPro: boolean;
    activeSubscription: string | null;
    expirationDate: string | null;
}

class RevenueCatService {
    private static instance: RevenueCatService;
    private isInitialized = false;

    private constructor() { }

    static getInstance(): RevenueCatService {
        if (!RevenueCatService.instance) {
            RevenueCatService.instance = new RevenueCatService();
        }
        return RevenueCatService.instance;
    }

    async init(userId?: string) {
        if (this.isInitialized) return;

        Purchases.setLogLevel(LOG_LEVEL.DEBUG);

        if (Platform.OS === 'ios') {
            Purchases.configure({ apiKey: API_KEYS.apple, appUserID: userId });
        } else if (Platform.OS === 'android') {
            Purchases.configure({ apiKey: API_KEYS.google, appUserID: userId });
        }

        this.isInitialized = true;
        console.log('[RevenueCat] Initialized');
    }

    async logIn(userId: string) {
        if (!this.isInitialized) {
            console.log('[RevenueCat] Login called before init. Initializing now...');
            await this.init(userId);
            return;
        }

        try {
            await Purchases.logIn(userId);
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
        if (!this.isInitialized) await this.init();

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
        if (!this.isInitialized) await this.init(); // Auto-init if needed (fallback)

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
        if (!this.isInitialized) await this.init();

        try {
            const customerInfo = await Purchases.restorePurchases();
            return this.checkProEntitlement(customerInfo);
        } catch (e) {
            console.error('[RevenueCat] Restore error:', e);
            throw e;
        }
    }

    async checkProStatus(): Promise<boolean> {
        if (!this.isInitialized) {
            await this.init();
        }

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

        if (
            customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined
        ) {
            console.log('[RevenueCat] User IS Pro');
            return true;
        }
        console.log('[RevenueCat] User is NOT Pro');
        return false;
    }
}

export default RevenueCatService.getInstance();
