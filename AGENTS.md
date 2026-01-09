# Habyss - Habit Tracking App

## Commands
- `npm run start` - Start Expo dev server
- `npm run ios` - Run on iOS simulator
- `npm run android` - Run on Android emulator
- `npm run lint` - Run ESLint via expo lint
- `npm run test` - Run Jest tests (watch mode)
- `npm test -- --testPathPattern="filename"` - Run single test file

## Architecture
- **Framework**: Expo SDK 53 + React Native 0.79 with expo-router (file-based routing)
- **Styling**: NativeWind (TailwindCSS) with custom Lexend font family
- **Database**: Supabase (remote) + expo-sqlite (local), synced via lib/syncService.ts
- **State**: React Context (context/, contexts/) and custom hooks (hooks/)
- **Payments**: Stripe integration via @stripe/stripe-react-native

## Structure
- `app/` - Expo Router pages: (auth)/ for auth flows, (root)/ for main app
- `components/` - UI components organized by feature (Habit/, Goal/, AI/, ui/)
- `lib/` - Services & utilities: supabase.ts, habits.ts, database.ts, syncService.ts
- `hooks/` - Custom React hooks (useHaptics, usePremiumStatus, useSounds)

## Code Style
- TypeScript with strict mode; use `@/*` path alias for imports
- Functional components with hooks; async/await for all async operations
- Use NativeWind className for styling (avoid inline styles)
- Icons from lucide-react-native; prefer existing components in components/ui/

## Instructions

1. First think through the problem, read the codebase for relevant files.
2. Solve the problem with the most efficient logic possible.
3. Make sure to use standard practices and patterns from other apps in the world.
4. Do your absolute best and go above and beyond. 

