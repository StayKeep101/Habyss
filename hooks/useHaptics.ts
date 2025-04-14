import * as Haptics from 'expo-haptics';

export const useHaptics = () => {
  const lightFeedback = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const mediumFeedback = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const heavyFeedback = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
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
    heavyFeedback,
    successFeedback,
    errorFeedback,
  };
}; 