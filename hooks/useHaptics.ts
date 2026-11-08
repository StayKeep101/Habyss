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

/** The one strength every haptic in the app uses. */
const STRENGTH = Haptics.ImpactFeedbackStyle.Medium;

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
  // One strength everywhere: every buzz in the app is the same tap, so none
  // feels louder or weaker than another. What tells them apart is rhythm, not
  // force: a choice is one tap, done is two, a problem is three quick ones,
  // a goal reached is three slow ones.
  const tap = () => {
    if (hapticsEnabled) fire(() => Haptics.impactAsync(STRENGTH));
  };
  const taps = (count: number, gap: number) => {
    if (!hapticsEnabled) return;
    for (let index = 0; index < count; index += 1) {
      if (index === 0) tap(); else setTimeout(tap, index * gap);
    }
  };

  const lightFeedback = tap;
  const mediumFeedback = tap;
  const thud = tap;
  const selectionFeedback = tap;
  /** A finger landing on a chart. */
  const softFeedback = tap;
  /** The high, the low or the end of a chart under the finger. */
  const rigidFeedback = tap;

  /** The long one, for a goal reached: three slow taps. Never awaited by anything. */
  const resonance = async () => { taps(3, 150); };
  const successFeedback = () => taps(2, 90);
  const errorFeedback = () => taps(3, 70);

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
