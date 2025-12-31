Awesome idea. Here’s a **ready-to-use Markdown spec** you can drop into Gemini so it can implement a **Stripe paywall system** in your habit-tracking app.
It’s written so Gemini clearly understands: architecture, endpoints, logic, and *how you will tell it which buttons are paywalled*.

---

# 🧠 Habyss – Stripe Paywall Integration (Gemini Instructions)

This document tells Gemini how to integrate **Stripe Billing / Payments** into the Habyss habit tracking app, enabling a **paywall for specific features, screens, or buttons**.

We will support:

* One-time purchase **OR** subscription
* Secure Stripe checkout
* Backend verification
* Paywall UI
* “Tell Gemini which button has a paywall” system

> ❗ **IMPORTANT:**
> If the project is a **mobile app** (iOS / Android) and you are selling in-app digital features, Apple and Google REQUIRE native IAP. Stripe is fine for Web + Desktop.
> If this app is mobile-only: implement **Apple/Google IAP** instead.
> If this app runs on **Web / Hybrid**, Stripe is perfect.

---

## ✅ Core Goal

Allow the developer (me) to say:

```
This button is premium:
Button ID → "export_data_button"
```

And Gemini must:

1. Detect if user has premium access
2. If yes → allow
3. If no → show paywall and redirect to Stripe checkout

---

# 1️⃣ Stripe Setup

Gemini must assume Stripe keys exist as ENV:

```
STRIPE_SECRET_KEY=
STRIPE_PUBLIC_KEY=
WEBHOOK_SECRET=
```

If not present, Gemini must:

* Prompt developer to add them
* Fail gracefully

---

# 2️⃣ Architecture

Gemini must create:

### Backend

* `/create-checkout-session`
* `/webhook`
* `/user-status`

### Frontend

* `PaywallModal`
* `usePremiumStatus()` hook / service
* `wrapPaywalledButton(buttonId, action)`

---

# 3️⃣ Subscription Product Rules

Gemini should expect a SINGLE default subscription:

* Name: `Habyss Premium`
* Interval: monthly
* Price: $4.99 (configurable)

If Stripe Product not present:
Gemini should guide developer to create one OR automatically via API.

---

# 4️⃣ Backend Logic (Language Flexible)

Gemini should generate backend in **whatever language the project uses** (Node / Python / Firebase / Go / etc).
If none exists, Gemini must create NodeJS Express backend.

### `/create-checkout-session`

Input:

```
userId
email
```

Output:

```
url (Stripe Checkout)
```

### `/webhook`

Handles:

* checkout completed
* subscription created
* subscription renewed
  Stores:

```
userId → plan = "premium"
expires = timestamp
stripeCustomerId
```

### `/user-status`

Returns:

```
{
 premium: boolean,
 expires: date | null
}
```

Gemini MUST store status in:

* Firestore OR
* Supabase OR
* App DB

Whichever is currently used. If none, Gemini creates SQLite.

---

# 5️⃣ Paywall System Rules

Gemini must implement a **universal paywall guard**.

## Developer declares premium buttons using ID tags

Developer will list paywalled buttons here:

```
PREMIUM_BUTTONS = [
 "export_data_button",
 "advanced_analytics_button",
 "ai_coaching_button",
 "habit_sync_button"
]
```

Gemini must:

1. Wrap target buttons
2. Intercept click
3. Check `/user-status`
4. If not premium → show paywall modal

### Paywall Modal Must Include

* Feature benefits list
* Price
* Checkout button
* Restore access option
* “Maybe later” dismissal

---

# 6️⃣ Frontend Dev Behavior Rules

Gemini must make it EASY to protect something.

Example:

```
paywallGuard({
  buttonId: "ai_coaching_button",
  onAllow: () => runAICoachFeature(),
})
```

Or for screens:

```
requirePremium(() => <AdvancedAnalyticsScreen />)
```

Or boolean helper:

```
if (isPremium()) {
   enableFeature()
}
```

---

# 7️⃣ UX Requirements

Gemini must ensure:

### When user clicks locked premium feature:

* Soft animation lock
* Premium modal appears
* No crashes
* No silent failures

### If payment succeeds:

* System refreshes automatically
* Unlocks instantly

### If payment fails / canceled:

* User kept in free state

---

# 8️⃣ Webhook Verification Rules

Gemini must:

* Verify Stripe signature
* Reject mismatched secret
* Prevent spoofing
* Sync subscription states

---

# 9️⃣ Offline Mode Rule

If no internet:

* Assume NOT premium
* Show friendly message:
  “Premium features require internet to verify your subscription.”

---

# 🔥 Developer Instruction to Gemini

Gemini, using this file:

1️⃣ Detect the framework (React Native / Flutter / Swift / Web)
2️⃣ Implement the backend + frontend system above
3️⃣ Create a clean Paywall UI
4️⃣ Create helpers to protect any button using ID tags
5️⃣ Create documentation showing the developer how to add new premium features

Gemini must produce:

* Code
* Config
* Example usage
* Deployment instructions

---

# 🧩 Example Developer Usage

To make a button premium:

```
add "habit_export_button" to PREMIUM_BUTTONS
```

Done.

---

# 🏁 Success Criteria

Gemini has completed successfully when:

* I can mark any button as premium
* Users are blocked unless subscribed
* Stripe checkout works
* Webhooks update user access
* Developer experience is simple

---
