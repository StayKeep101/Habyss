# Payment Setup Guide (RevenueCat)

You requested "Apple Pay" and the "Industry Standard" for payments.
For iOS Apps selling digital content (like Pro subscriptions), the **only** allowed industry standard is **Apple In-App Purchase**.
We use **RevenueCat** to manage this easily. It handles the "Apple Pay" UI automatically.

## 🚨 Action Required: Get Your Keys

I cannot generate these keys for you. You must create an account.

### 1. Create RevenueCat Account
1.  Go to [RevenueCat](https://www.revenuecat.com/).
2.  Sign up (Free tier is generous).
3.  Create a new Project called "Habyss".

### 2. Configure Apple App Store
1.  In RevenueCat, go to **Project Settings** -> **Apps** -> **+ New App** -> **App Store**.
2.  Follow the guide to link your App Store Connect account.
3.  **Shared Secret**: You'll need to generate this in App Store Connect (Users and Access -> Shared Secret).

### 3. Create Products (Entitlements)
1.  In RevenueCat, go to **Entitlements** in the sidebar.
2.  Create a new Entitlement identifier: `pro` (This must match the code in `lib/RevenueCat.ts`).
3.  Create an **Offering** (default) and add **Packages**:
    *   Create a "Yearly" package.
    *   Create a "Lifetime" package.
    *   Attach your **Apple Product IDs** (e.g., `com.habyss.yearly`, `com.habyss.lifetime` which you created in App Store Connect).

### 4. Get Public API Key
1.  Go to **Project Settings** -> **API Keys**.
2.  Copy the **Public Key** (starts with `appl_...`).

### 5. Update Your Code
Open `lib/RevenueCat.ts` and paste your key:

```typescript
// lib/RevenueCat.ts
const API_KEYS = {
    apple: 'appl_YOUR_ACTUAL_KEY_HERE', // <--- PASTE HERE
    google: '',
};
```

## Why isn't it working now?
The app logs show: `[RevenueCat] Invalid API Key`.
Until you paste a valid key, the payment screens will fail or show loading spinners.

## Does this support Apple Pay?
**Yes.** When `RevenueCatService.purchasePackage()` is called, iOS automatically presents the native "Confirm Subscription" sheet with FaceID/TouchID. This IS Apple Pay for digital goods.
