import { useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import { useAppSettings } from '@/context/AppSettingsContext';

/**
 * Fires a haptic and swallows whatever comes back.
 *
 * Every `Haptics.*Async` returns a promise, and every one of them used to be
 * called and dropped. A dropped promise that rejects is an *unhandled*
 * rejection, which React Native raises as a red screen in development — so a
 * device with no haptic engine, which is every simulator, turned an ordinary
 * tap into a crash report. The tap had already done its real work; the buzz is
 * the decoration.
 *
 * `.catch` rather than try/catch: these reject asynchronously, so a try block
 * around the call would never see it.
 */
const fire = (run: () => Promise<unknown>): void => {
  try {
    void run().catch(() => undefined);
  } catch {
    // A module that throws synchronously — an old build, a missing native
    // side — is still not a reason to interrupt somebody choosing an icon.
  }
};

export const useHaptics = () => {
  // Try to get global settings, fallback to always enabled if context not available
  let hapticsEnabled = true;
  try {
    const settings = useAppSettings();
    hapticsEnabled = settings.hapticsEnabled;
  } catch {
    // Context not available, default to enabled
  }

  return useMemo(() => {
  const lightFeedback = () => {
    if (hapticsEnabled) fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  };

  const mediumFeedback = () => {
    if (hapticsEnabled) fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  };

  const thud = () => {
    if (hapticsEnabled) fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  };

  /**
   * The long one, for a goal reached.
   *
   * Not `await`ed any more: it used to hold the caller until the first buzz
   * came back, and a rejection there propagated into whatever had awaited it.
   * The two later taps are timers, so they were never awaited anyway.
   */
  const resonance = async () => {
    if (!hapticsEnabled) return;
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
    setTimeout(() => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)), 100);
    setTimeout(() => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)), 250);
  };

  const successFeedback = () => {
    if (hapticsEnabled) fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  };

  const errorFeedback = () => {
    if (hapticsEnabled) fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  };

  const selectionFeedback = () => {
    if (hapticsEnabled) fire(() => Haptics.selectionAsync());
  };

  /** A cushioned tap: a finger landing on a chart. */
  const softFeedback = () => {
    if (hapticsEnabled) fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft));
  };

  /** A crisp, firm tap: the high, the low or the end of a chart under the finger. */
  const rigidFeedback = () => {
    if (hapticsEnabled) fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid));
  };

  return {
    enabled: hapticsEnabled,
    lightFeedback,
    mediumFeedback,
    heavyFeedback: thud,
    thud,
    resonance,
    successFeedback,
    errorFeedback,
    selectionFeedback,
    softFeedback,
    rigidFeedback,
  };
  }, [hapticsEnabled]);
};
