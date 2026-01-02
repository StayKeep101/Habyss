import * as Haptics from 'expo-haptics';

export const useHaptics = () => {
  const lightFeedback = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const mediumFeedback = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // The "Thud" - heavy, deliberate styling for the Void
  const thud = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  // "Resonance" - A ripple effect for major achievements
  const resonance = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 100);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 250);
  };

  const successFeedback = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const errorFeedback = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  return {
    lightFeedback,
    mediumFeedback,
    heavyFeedback: thud, // Alias for backward compatibility if needed, or replace usages
    thud,
    resonance,
    successFeedback,
    errorFeedback,
  };
}; 