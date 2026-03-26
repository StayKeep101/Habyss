# 🚀 Habyss - Setup Guide

Complete setup instructions for the Habyss React Native habit tracking app.

---

## 📋 **Prerequisites**

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher): [Download](https://nodejs.org/)
- **npm** or **yarn**: Comes with Node.js
- **Expo CLI**: `npm install -g expo-cli`
- **EAS CLI** (for production builds): `npm install -g eas-cli`
- **iOS**: Xcode 14+ (Mac only) and CocoaPods
- **Android**: Android Studio with Android SDK

---

## 🔧 **Step 1: Environment Setup**

### 1.1 Clone and Install Dependencies

```bash
cd /path/to/Habyss
npm install
```

### 1.2 Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://wlbjhtlznzdumqxetilx.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=your_supabase_anon_key_here

# Stripe Configuration (for payments)
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key_here

# Optional: AI API Keys
# EXPO_PUBLIC_DEEPSEEK_API_KEY=your_deepseek_key
# EXPO_PUBLIC_OPENROUTER_API_KEY=your_openrouter_key
```

**⚠️ IMPORTANT:** Get your FULL Supabase anon key from:
- Go to: https://app.supabase.com/project/wlbjhtlznzdumqxetilx/settings/api
- Copy the **anon/public** key (starts with `eyJhbGci...`)
- The key should be ~200+ characters long

---

## 🗄️ **Step 2: Supabase Database Setup**

### 2.1 Run the Migration

1. Log in to your Supabase dashboard: https://app.supabase.com/project/wlbjhtlznzdumqxetilx

2. Navigate to **SQL Editor**

3. Copy and paste the contents of:
   ```
   /Users/erwan/Coding/Habyss/supabase/migrations/20250318_create_routine_and_focus_tables.sql
   ```

4. Click **Run** to execute the migration

This will create the following tables:
- `routines` - User-defined habit routines
- `routine_habits` - Links habits to routines
- `routine_sessions` - Routine execution history
- `focus_sessions` - Focus/timer session tracking
- `focus_stats` - Aggregate focus time statistics

### 2.2 Verify Tables

In the Supabase dashboard, go to **Table Editor** and verify these tables exist:
- ✅ `habits`
- ✅ `habit_completions`
- ✅ `routines`
- ✅ `routine_habits`
- ✅ `routine_sessions`
- ✅ `focus_sessions`
- ✅ `focus_stats`

---

## 📱 **Step 3: Development Setup**

### 3.1 Start the Development Server

```bash
# Start Expo dev server
npm start

# Or use specific platforms
npm run ios     # iOS simulator
npm run android # Android emulator
npm run web     # Web browser
```

### 3.2 Run on Physical Device

#### iOS (Requires Mac):
```bash
# First time only: Install pods
cd ios && pod install && cd ..

# Run on iOS device
npm run ios
```

#### Android:
```bash
# Run on Android device
npm run android
```

---

## 🧪 **Step 4: Testing**

### 4.1 TypeScript Type Checking

```bash
npx tsc --noEmit
```

✅ **All TypeScript errors have been fixed!**

### 4.2 Manual Testing Checklist

Test these core features:

- [ ] **Authentication**
  - Sign up with email/password
  - Sign in with existing account
  - Sign out

- [ ] **Habits**
  - Create a new habit
  - Complete a habit
  - Edit habit details
  - Archive/delete a habit
  - View habit statistics

- [ ] **Goals**
  - Create a goal
  - Link habits to goal
  - Track goal progress

- [ ] **Routines**
  - Create a routine
  - Add habits to routine
  - Start routine playback
  - Complete routine

- [ ] **Focus Timer**
  - Start focus session
  - Pause/resume timer
  - Complete session
  - View focus statistics

- [ ] **Offline Mode**
  - Disable network
  - Create/complete habits
  - Re-enable network
  - Verify sync works

- [ ] **Notifications**
  - Grant notification permissions
  - Schedule habit reminder
  - Receive notification

---

## 🏗️ **Step 5: Production Build**

### 5.1 Configure EAS

```bash
# Login to Expo
eas login

# Initialize EAS (if not done)
eas build:configure
```

### 5.2 Build for iOS

```bash
# Development build
eas build --platform ios --profile development

# Production build
eas build --platform ios --profile production
```

### 5.3 Build for Android

```bash
# Development build
eas build --platform android --profile development

# Production build
eas build --platform android --profile production
```

### 5.4 Submit to App Stores

```bash
# iOS App Store
eas submit --platform ios

# Google Play Store
eas submit --platform android
```

---

## 🔐 **Step 6: Security Configuration**

### 6.1 Update Row Level Security (RLS)

Ensure all Supabase tables have proper RLS policies. The migration script already includes:

- Users can only access their own data
- Proper CASCADE deletes on user deletion
- Secure authentication checks

### 6.2 API Key Security

**⚠️ NEVER commit these files to git:**
- `.env.local`
- `.env.production`
- `google-services.json` (Android)
- `GoogleService-Info.plist` (iOS)

Add to `.gitignore`:
```
.env*
!.env.example
```

---

## 📊 **Step 7: Monitoring & Analytics**

### 7.1 Error Tracking (Optional - Recommended)

Install Sentry for crash reporting:

```bash
npm install @sentry/react-native
npx @sentry/wizard -i reactNative
```

### 7.2 Analytics (Optional)

Consider adding:
- **PostHog** for product analytics
- **RevenueCat** for subscription analytics (already integrated)
- **Mixpanel** for user behavior tracking

---

## 🐛 **Troubleshooting**

### Issue: "Cannot find module './habits'"
**Solution:** Fixed! The `lib/habits.ts` file has been created.

### Issue: TypeScript errors in habitRepository.ts or syncService.ts
**Solution:** Fixed! All type assertions have been added.

### Issue: "Supabase URL is invalid"
**Solution:** Check your `.env.local` file and ensure you copied the FULL anon key.

### Issue: "SQLite not available"
**Solution:** This is normal in Expo Go. The app will automatically use Supabase-only mode. For SQLite support, create a development build:
```bash
eas build --platform ios --profile development
```

### Issue: "Expo module not found"
**Solution:**
```bash
npx expo install
npx expo-doctor
```

### Issue: iOS build fails with pod errors
**Solution:**
```bash
cd ios
pod deintegrate
pod install
cd ..
```

---

## 📚 **Architecture Overview**

### Database Architecture

**Hybrid SQLite + Supabase:**
- **SQLite**: Local offline-first storage with automatic sync queue
- **Supabase**: Cloud backup and multi-device sync
- **Fallback**: Automatically uses Supabase-only mode in Expo Go

### Key Features

1. **Offline-First**: All CRUD operations work offline and sync when online
2. **Conflict Resolution**: Last-write-wins with timestamp comparison
3. **Soft Deletes**: Data is never hard-deleted, uses `deleted_at` timestamps
4. **Optimized Performance**: WAL mode, composite indexes, cached aggregates
5. **Type Safety**: Full TypeScript coverage with strict types

### File Structure

```
Habyss/
├── app/                    # Expo Router pages
│   ├── (auth)/            # Authentication screens
│   ├── (root)/            # Main app screens
│   └── _layout.tsx        # Root layout with providers
├── components/            # React components
├── constants/             # Context providers & themes
├── lib/                   # Core business logic
│   ├── database.ts        # SQLite setup & migrations
│   ├── habitsSQLite.ts    # Main habits service
│   ├── habitRepository.ts # SQLite CRUD operations
│   ├── syncService.ts     # Background sync service
│   ├── supabase.ts        # Supabase client
│   └── ...               # Other services
├── supabase/
│   └── migrations/        # SQL migration files
└── SETUP.md              # This file
```

---

## 🎉 **Next Steps**

1. ✅ **Environment variables configured**
2. ✅ **Supabase tables created**
3. ✅ **TypeScript errors fixed**
4. ✅ **Error boundary added**
5. 🔲 **Test all features manually**
6. 🔲 **Create test accounts**
7. 🔲 **Build development version**
8. 🔲 **Beta test with real users**
9. 🔲 **Submit to App Store & Play Store**

---

## 📞 **Support**

If you encounter any issues:

1. Check the troubleshooting section above
2. Run `npx expo-doctor` to diagnose common issues
3. Check Expo documentation: https://docs.expo.dev
4. Check Supabase documentation: https://supabase.com/docs

---

## 📝 **License**

Private repository - All rights reserved.

---

**Built with ❤️ using Expo, React Native, TypeScript, Supabase, and SQLite**
