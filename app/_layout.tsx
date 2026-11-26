import { MarksOrbs } from '@/components/Marks/MarksOrbs';
import { noteTouch } from '@/lib/marksOrbs';
import '@/lib/polyfills'; // Must be first
import { CoachLayer } from '@/components/ui/CoachMarks';
import { getLocalUserId } from '@/lib/localUser';
import { ThemeProvider } from "@/context/ThemeContext";
import { useFonts, Lexend_400Regular, Lexend_500Medium, Lexend_600SemiBold, Lexend_700Bold } from '@expo-google-fonts/lexend';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { Colors } from '@/theme/colors';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import '../global.css';
import { useColorScheme } from '@/hooks/useColorScheme';
import { DarkTheme, LightTheme } from "@/theme/navigation";
import React from "react";
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import {View, AppState, Alert, InteractionManager} from 'react-native';
import { VoidShell } from '@/components/ui/VoidShell';
import { NotificationService } from '@/lib/notificationService';
import { ensureData } from '@/lib/dataStore';
import '@/lib/LocationService'; // Register background tasks
import { AIPersonalityProvider } from '@/context/AIPersonalityContext';
import { AppSettingsProvider } from '@/context/AppSettingsContext';
import { AccentProvider, useAccentGradient } from '@/context/AccentContext';
import { FocusTimeProvider, useFocusSession } from '@/context/FocusTimeContext';
import { CreationModal } from '@/components/Create/CreationModal';
import { CheckInHost } from '@/components/Echo/CheckInHost';
import { FreezeAskHost } from '@/components/Echo/FreezeAskHost';
import { ChallengeHost } from '@/components/Challenge/ChallengeHost';
import { RaceSheet } from '@/components/Challenge/RaceSheet';
import { ProofCameraHost } from '@/components/Proof/ProofCameraHost';
import { DayCompleteCelebration } from '@/components/Celebrations/DayCompleteCelebration';
import { HabitSheet } from '@/components/Create/HabitSheet';
import { GlassRipple } from '@/components/Home/GlassRipple';
import { TaskFormModal } from '@/components/Tasks/TaskFormModal';
import { FeedbackSheet } from '@/components/Common/FeedbackSheet';
import { flushFeedback } from '@/lib/feedback';
import { installCrashReporting, sendPendingCrash } from '@/lib/crashReport';

// Before anything else can throw: uncaught errors are written down and sent next launch.
installCrashReporting();
// The launch animation plays: hold the app's own animations until it lifts.
(require('@/lib/introGate') as typeof import('@/lib/introGate')).holdForIntro();
import RevenueCatService from '@/lib/RevenueCat';
// import { SuperwallProvider, SuperwallExpoModule } from 'expo-superwall';
// import * as Linking from 'expo-linking';
import { BiometricGuard } from '@/components/Auth/BiometricGuard';
import { ErrorBoundary } from '@/components/Common/ErrorBoundary';
import { CrackIntro } from '@/components/Common/CrackIntro';
import { QuietLoading } from '@/components/Loading/QuietLoading';
import { SiriService } from '@/lib/siriService';
import { emit, on, onAny } from '@/lib/appEvents';
import { watchForUpdates } from '@/lib/liveUpdates';
import { VoiceCapture } from '@/components/Create/VoiceCapture';
import { DailyTargetCelebration } from '@/components/Celebrations/DailyTargetCelebration';

SplashScreen.preventAutoHideAsync().catch(() => { });

/**
 * Backs up when the app comes to the foreground, if signed in.
 *
 * At most every few minutes, so switching apps does not upload each time. A
 * failure is silent here: the data is safe on the phone, the next attempt
 * retries, and the Account screen reports the state honestly.
 */
const BACKUP_INTERVAL_MS = 3 * 60 * 1000;
let lastBackgroundBackup = 0;
async function backUpInBackground() {
    if (Date.now() - lastBackgroundBackup < BACKUP_INTERVAL_MS) return;
    lastBackgroundBackup = Date.now();
    try {
        const { currentAccount } = require('@/lib/account');
        if (!(await currentAccount())) return;
        const { syncNow } = require('@/lib/cloudSync');
        await syncNow();
    } catch (error) {
        console.warn('[Backup] background sync failed', error);
    }
}

export default function MobileLayout() {
  const [loaded] = useFonts({
    'Lexend': Lexend_700Bold,
    Lexend_400Regular,
    Lexend_500Medium,
    Lexend_600SemiBold,
    Lexend_700Bold,
    SpaceGrotesk_700Bold,
  });
  const [bootReady, setBootReady] = React.useState(false);
  // The launch animation, once per cold start.
  const [showIntro, setShowIntro] = React.useState(true);
  const endIntro = React.useCallback(() => {
    setShowIntro(false);
    (require('@/lib/introGate') as typeof import('@/lib/introGate')).releaseIntro();
    // The link Habyss was opened with (a widget's Add, say) opens now, as the launch screen lifts (lib/launchLink.ts).
    const held = (require('@/lib/launchLink') as typeof import('@/lib/launchLink')).takeLaunchLink();
    if (held) setTimeout(() => { try { (require('expo-router') as typeof import('expo-router')).router.push(held as never); } catch { /* a link that no longer exists */ } }, 50);
  }, []);
  // Opened cold from a widget, a Live Activity or a link: the launch animation
  // still plays, over the page that was tapped, which is there when it lifts.
  // (Ending it early here made a first open from a widget skip the intro.)

  useEffect(() => {
    async function prepare() {
      try {
        if (loaded) {
          // Initialize notifications sequence safely
          try {
            // The splash waits for one thing: the data Home shows, which is
            // on the phone and quick. Home then opens complete, and its
            // numbers, rings and bars play in from it. Capped, so a slow
            // database can never hold the app closed.
            const data = ensureData().catch(() => undefined);
            // Time off (sick, vacation) first: the reminders booked next leave those days quiet.
            await (require('@/lib/timeOff') as typeof import('@/lib/timeOff')).loadTimeOff().catch(() => undefined);
            await NotificationService.init();
            // Permissions are requested when the user enables a reminder.
            void NotificationService.refreshHabitReminders().catch(error => console.warn('Reminder refresh failed', error));
            // Purchases and Siri carry on in the background; nothing on
            // Home waits for them.
            void RevenueCatService.init().catch(error => console.warn('Purchases unavailable', error));
            void SiriService.syncTodayProgress().catch(() => undefined);
            // Upright on a phone, any way round on an iPad (lib/orientation.ts).
            (require('@/lib/orientation') as typeof import('@/lib/orientation')).applyDefaultOrientation();
            // Your day and Echo's settings, read once so every screen opens on them.
            (require('@/lib/echo') as typeof import('@/lib/echo')).warmEchoSettings();
            await Promise.race([data, new Promise(resolve => setTimeout(resolve, 1500))]);
            // On-device AI in the background: Apple's built-in model when the
            // phone has one, otherwise the Llama model, downloaded on Wi-Fi the
            // first time. Never blocks startup and never throws.
            import('@/lib/onDeviceAI').then(ai => ai.prepareOnDeviceAI()).catch(() => undefined);
          } catch (e) {
            console.warn("Notification initialization failed", e);
          }
        }
      } catch (e) {
        console.warn("Preparation failed", e);
      } finally {
        if (loaded) {
          setBootReady(true);
          await SplashScreen.hideAsync();
        }
      }
    }
    prepare();
  }, [loaded]);

  // Realtime Notifications removed — will be re-enabled with premium cloud sync

  // The phone runs the newest published update, not the one before it.
  useEffect(() => watchForUpdates(), []);
  // Challenges and bets: their items in your plan, days kept reported, and what a tick must prove (lib/challengeProof.ts).
  useEffect(() => (require('@/lib/challengeProof') as typeof import('@/lib/challengeProof')).watchProof(), []);
  // One "what's on now" in Notification Center at a time (lib/dayGuideTidy.ts).
  useEffect(() => (require('@/lib/dayGuideTidy') as typeof import('@/lib/dayGuideTidy')).watchDayGuide(), []);

  // Your profile and its photo, read as the app opens, so the profile page
  // shows the picture at once rather than after a download.
  useEffect(() => {
    void (require('@/lib/profile') as typeof import('@/lib/profile')).getProfile()
      .then(profile => { if (profile.avatar) void (require('@/lib/imageCache') as typeof import('@/lib/imageCache')).cacheImage(profile.avatar); })
      .catch(() => undefined);
  }, []);

  // The brain dump's week: clear last week's thoughts, schedule this week's review.
  useEffect(() => {
    const { syncBrainDumpReview } = require('@/lib/brainDumpReview') as typeof import('@/lib/brainDumpReview');
    syncBrainDumpReview();
    const { syncWeeklyReviewNotice } = require('@/lib/weeklyReviewNotice') as typeof import('@/lib/weeklyReviewNotice');
    void syncWeeklyReviewNotice();
    // How long things really take, learnt quietly (lib/learnedLength.ts): one sample per thing done today,
    // collected each time the app comes back. Nothing is changed for you; it is only measured.
    const learn = () => { void (require('@/lib/dayReviewRun') as typeof import('@/lib/dayReviewRun')).runDayReview(new Date(), { adapt: false }).catch(() => undefined); };
    learn();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') { syncBrainDumpReview(); void syncWeeklyReviewNotice(); learn(); } });
    return () => subscription.remove();
  }, []);

  // Earn your scroll (lib/appGate.ts): the block screen always knows today's top 3,
  // and lifts the moment the third is ticked.
  useEffect(() => {
    const { syncGate } = require('@/lib/appGate') as typeof import('@/lib/appGate');
    const { onAny } = require('@/lib/appEvents') as typeof import('@/lib/appEvents');
    void syncGate();
    // The night's hours to iOS (the Bedtime lock), so tonight's block is set even if Habyss stays closed.
    void (require('@/lib/bedtimeLock') as typeof import('@/lib/bedtimeLock')).syncBedtime();
    const off = onAny(['tasks_changed', 'habit_completion_updated', 'habit_updated', 'habit_created', 'habit_deleted'], () => { void syncGate(); });
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void syncGate(); });
    return () => { off(); subscription.remove(); };
  }, []);

  // --- Notification Deep Linking ---
  useEffect(() => {
    const handle = async (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      try {
        // Typed into the Quick Add widget's notification: added without opening Habyss.
        if (await (require('@/lib/quickAddResponse') as typeof import('@/lib/quickAddResponse')).handleQuickAddResponse(response)) {
          await Notifications.clearLastNotificationResponseAsync();
          return;
        }
        if (!(await NotificationService.handleEchoResponse(response))) {
          await (require('@/lib/socialActions') as typeof import('@/lib/socialActions')).handleSocialResponse(response);
        }
        await Notifications.clearLastNotificationResponseAsync();
        const data = response.notification.request.content.data;
        // Every tap goes to its place (navigate): a tab is switched to, a page
        // opened, never a second copy of the app pushed over the first.
        const url = data?.url;
        // A button (Done, Start focus, …) does its own job; only a tap on the notification opens its place.
        if (typeof url === 'string' && url.startsWith('/') && response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
          setTimeout(() => { require('expo-router').router.navigate(url); }, 500);
        }
        // Your day dropped, a friend reacted to it, or a bet opened or settled: the tap opens Community.
        if ((data?.type === 'day_drop' || data?.type === 'reaction' || data?.type === 'market') && response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
          setTimeout(() => { require('expo-router').router.navigate('/(root)/(tabs)/community'); }, 500);
        }
        // "Alex is locking in. Join?": the tap joins them (lib/focusTogether.ts).
        if (data?.type === 'focus_invite' && typeof data.from === 'string' && response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
          const { togetherId } = require('@/lib/focusTogether') as typeof import('@/lib/focusTogether');
          const params = { id: togetherId(data.from), kind: 'together' };
          setTimeout(() => { require('expo-router').router.navigate({ pathname: '/(root)/focus', params }); }, 500);
        }
      } catch (error) {
        console.warn('Could not apply notification action', error);
        if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
          Alert.alert('Action could not finish', 'Open the item in Habyss and try again.');
        }
      }
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(response => { void handle(response); });
    void Notifications.getLastNotificationResponseAsync().then(handle).catch(() => undefined);

    return () => subscription.remove();
  }, []);

  // --- Superwall Deep Linking ---
  // useEffect(() => {
  //   const handleDeepLink = async ({ url }: { url: string }) => {
  //     if (url) {
  //       try {
  //         await SuperwallExpoModule.handleDeepLink(url);
  //       } catch (e) {
  //         console.warn('[Superwall] Deep link error:', e);
  //       }
  //     }
  //   };

  //   const subscription = Linking.addEventListener('url', handleDeepLink);

  //   // Check initial URL
  //   // Linking.getInitialURL().then((url) => {
  //   //   if (url) handleDeepLink({ url });
  //   // });

  //   return () => {
  //     // subscription.remove();
  //   };
  // }, []);

  // --- Local User + RevenueCat Init ---
  useEffect(() => {
    async function initLocalUser() {
      try {
        const userId = await getLocalUserId();
        await RevenueCatService.logIn(userId);
      } catch (e) {
        console.warn('[Auth] Local user init failed:', e);
      }
    }
    initLocalUser();
  }, []);

  if (!loaded || !bootReady) {
    return <QuietLoading />;
  }

  return (
    <>
    {/* <SuperwallProvider apiKeys={{ ios: "pk_UMIRgoqWMWWOJ9H2Lp6RG" }}> */}
    <ErrorBoundary>
      <ThemeProvider>
        <AppSettingsProvider>
          <AIPersonalityProvider>
            <AccentProvider>
              <FocusTimeProvider>
                  <GestureHandlerRootView style={{ flex: 1 }}>
                    <BiometricGuard>
                      <InnerLayout />
                    </BiometricGuard>
                  </GestureHandlerRootView>
              </FocusTimeProvider>
            </AccentProvider>
          </AIPersonalityProvider>
        </AppSettingsProvider>
      </ThemeProvider>
    </ErrorBoundary>
    {/* Opening the app is going down the crack in the logo. */}
    {showIntro ? <CrackIntro onDone={endIntro} /> : null}
    </>
  );
}

function InnerLayout() {
  const theme = useColorScheme();
  const isDark = theme !== 'light';
  const { foreground } = useAccentGradient();
  const palette = Colors[theme];
  const navigationTheme = {
    ...(isDark ? DarkTheme : LightTheme),
    colors: {
      ...(isDark ? DarkTheme : LightTheme).colors,
      primary: foreground, background: palette.background, card: palette.surface,
      text: palette.textPrimary, border: palette.border, notification: palette.error,
    },
  };

  // Anything written without signal is sent now rather than waiting for the
  // person to remember they ever wrote it.
  useEffect(() => { void flushFeedback().catch(() => undefined); void sendPendingCrash(); }, []);

  // Every account that existed before profiles were shared has a name and a
  // picture on the phone and neither on the server, so friends see a handle and
  // a grey circle. This sends whichever of them has not arrived yet.
  //
  // It listens rather than firing once: a mount effect runs before Supabase has
  // restored the stored session, so the single attempt always found nobody
  // signed in and quietly did nothing.
  useEffect(() => {
    const stop = (require('@/lib/profileSync') as typeof import('@/lib/profileSync')).startProfileSync();
    return stop;
  }, []);

  // Siri and Shortcuts act on the account without opening Habyss (lib/siriAccess.ts).
  useEffect(() => (require('@/lib/siriAccess') as typeof import('@/lib/siriAccess')).startSiriAccess(), []);
  // Habits timed in their apps: iOS watches them with today's names and minutes.
  useEffect(() => { void (require('@/lib/appTime') as typeof import('@/lib/appTime')).pushAppTime().catch(() => undefined); }, []);

  // --- App Intents Listener (Siri/Shortcuts) ---
  const { startTimer, stopTimer: globalStopTimer } = useFocusSession();

  useEffect(() => {
    const checkIntents = async () => {
      try {
        const SharedDefaults = require('@/lib/SharedDefaults').default;

        // 1. Check for Stop Focus Intent (NEW)
        const stopFlag = await SharedDefaults.getDouble('intent_stop_focus_timestamp');
        if (stopFlag > 0) {
          console.log('[AppIntents] Stopping focus session via Siri');
          globalStopTimer();
          await SharedDefaults.remove('intent_stop_focus');
          await SharedDefaults.remove('intent_stop_focus_timestamp');
        }

        // 2. Check for Start Focus Intent
        const focusDuration = await SharedDefaults.getInteger('intent_start_focus_duration');
        if (focusDuration > 0) {
          console.log('[AppIntents] Starting focus for', focusDuration, 'minutes');
          startTimer('intent_habit', 'Focus Session', focusDuration * 60);
          await SharedDefaults.remove('intent_start_focus_duration');
        }

        // 3. Completions arriving from Siri Shortcuts.
        // Previously this toggled unconditionally, so logging an already
        // completed habit switched it back off, and it keyed the completion by
        // UTC date, which lands on tomorrow in western timezones late in the day.
        const { drainPendingShortcutLogs } = require('@/lib/shortcutsInbox');
        const drained = await drainPendingShortcutLogs();
        if (drained.logged.length || drained.unmatched.length) {
          console.log('[AppIntents] Shortcut logs applied:', drained);
        }

        // Tasks and habits named from Siri, Spotlight, the Action button or a Shortcut.
        const { drainQuickAdds } = require('@/lib/shortcutsInbox');
        const added = await drainQuickAdds();
        if (added.tasks.length) emit('tasks_changed');
        if (added.habits.length) emit('habit_updated', {});

        // Long enough at a place that ticks itself, and still there (lib/LocationService.ts).
        await (require('@/lib/LocationService') as typeof import('@/lib/LocationService')).checkStays().catch(() => undefined);

        // Habits timed in their apps, reached or kept while Habyss was closed (lib/appTime.ts).
        if (await (require('@/lib/appTime') as typeof import('@/lib/appTime')).drainAppTime().catch(() => 0)) emit('habit_completion_updated', {});

        // Rows ticked on the widget while the app was closed, habits and tasks alike.
        const { drainWidgetToggles } = require('@/lib/widgetSync');
        const fromWidget = await drainWidgetToggles();
        if (fromWidget.habits || fromWidget.tasks) {
          emit('habit_completion_updated', {});
          emit('tasks_changed');
        }

      } catch (e) {
        console.warn('[AppIntents] Error checking intents:', e);
      }
    };

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        checkIntents();
        void NotificationService.refreshHabitReminders().catch(error => console.warn('Reminder refresh failed', error));
        void backUpInBackground();
      }
    });

    // Check on mount too
    checkIntents();

    return () => {
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;
    let again = false;
    const refresh = async (leavingApp = false) => {
      if (!alive || (!leavingApp && AppState.currentState !== 'active')) return;
      if (running) { again = true; return; }
      running = true;
      try {
        do {
          again = false;
          const { drainWidgetToggles, syncWidgets } = require('@/lib/widgetSync');
          const applied = await drainWidgetToggles();
          if (applied.habits || applied.tasks) {
            emit('habit_completion_updated', {});
            emit('tasks_changed');
          }
          if (!leavingApp) {
            // The moments first (the day's promise kept, the day won): they answer the tick just made,
            // so they never wait behind the widgets and Live Activities below.
            await require('@/lib/dayComplete').checkDayComplete();
            await require('@/lib/milestones').checkMilestones();
          }
          await syncWidgets();
          if (leavingApp) continue;
          await require('@/lib/scheduledActivities').refreshScheduledActivities();
        } while (again && alive);
      } catch (error) { console.warn('Could not refresh widgets or scheduled activities', error); }
      finally { running = false; }
    };
    // After a run of ticks has settled and any animation has finished: the
    // widgets and Live Activities read the whole day back, and doing that 150
    // ms after a tick landed in the middle of its animation.
    const enqueue = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { InteractionManager.runAfterInteractions(() => { void refresh(); }); }, 600);
    };
    const stop = onAny(['habit_completion_updated', 'habit_created', 'habit_updated', 'habit_deleted',
      'tasks_changed', 'cloud_restored', 'engagement_settings_changed', 'daily_focus_target_changed'], enqueue);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') enqueue();
      else {
        // Do not abandon the last task edit when the user immediately goes Home.
        if (timer) clearTimeout(timer);
        void refresh(true);
      }
    });
    // Native ActivityKit schedules the exact start. This foreground fallback
    // also covers older iOS and replenishes the upcoming cards while browsing.
    // Every change refreshes straight away; this is only the fallback, and each
    // pass reads the whole day back, so it runs every five minutes, not every one.
    const interval = setInterval(enqueue, 5 * 60000);
    // The watch asking for the day gets a fresh snapshot; its ticks land here.
    const { listenToWatch } = require('@/lib/watchSync') as typeof import('@/lib/watchSync');
    const stopWatch = listenToWatch(enqueue);
    enqueue();
    return () => { alive = false; stop(); stopWatch(); subscription.remove(); clearInterval(interval); if (timer) clearTimeout(timer); };
  }, [foreground]);

  return (
    <NavigationThemeProvider value={navigationTheme}>
    {/* Every touch is noted (it does not stop it): Marks orbs fly out of where you tapped. */}
    <View style={{ flex: 1 }} className={theme} onTouchStart={event => noteTouch(event.nativeEvent.pageX, event.nativeEvent.pageY)}>
      <VoidShell>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
          {/* Reached by the launch redirect, not by a tap: they appear in
              place instead of sliding in from the side. */}
          <Stack.Screen name="index" options={{ animation: 'none' }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="(root)" options={{ animation: 'none' }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <DayCompleteCelebration />
        <DailyTargetCelebration />
        <CreationModal />
        {/* What the + opens from any tab: Echo's one-tap question. */}
        <CheckInHost />
        <FreezeAskHost />
        <ChallengeHost />
        <RaceSheet />
        <ProofCameraHost />
        {/* Past bedtime with the app open: Echo, now and then, sending you to bed. */}
        {/* Hold the create button and speak. */}
        <VoiceCapture />
        <HabitSheet listenToGlobalEvents />
        <TaskFormModal listenToGlobalEvents />
        {/* Mounted once, raised from anywhere with `show_feedback`. Telling us
            something should never depend on being on the right screen. */}
        <FeedbackSheet />
        {/* Every hourglass you can earn, opened from the day's hourglass, over every screen. */}
        {/* The morning flip's rings, rolling out over every screen and the tab bar. */}
        <GlassRipple />
        {/* The first-run tour, over every screen. */}
        <CoachLayer root />
        {/* Orbs flying to your Marks whenever something earns them. Last, so they fly over everything. */}
        <MarksOrbs />
        <StatusBar style={isDark ? "light" : "dark"} />
      </VoidShell>
    </View>
    </NavigationThemeProvider>
  );
}
