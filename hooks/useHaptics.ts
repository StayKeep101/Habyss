import * as Haptics from 'expo-haptics';
import { useAppSettings } from '@/constants/AppSettingsContext';

export const useHaptics = () => {
  // Try to get global settings, fallback to always enabled if context not available
  let hapticsEnabled = true;
  try {
    const settings = useAppSettings();
    hapticsEnabled = settings.hapticsEnabled;
  } catch (e) {
    // Context not available, default to enabled
  }

  const lightFeedback = () => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const mediumFeedback = () => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const thud = () => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  const resonance = async () => {
    if (!hapticsEnabled) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 100);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 250);
  };

  const successFeedback = () => {
    if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const errorFeedback = () => {
    if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  const selectionFeedback = () => {
    if (hapticsEnabled) Haptics.selectionAsync();
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
  };
};