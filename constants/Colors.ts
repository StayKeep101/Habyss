/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#3B82F6';
const tintColorDark = '#60A5FA';

export const Colors = {
  light: {
    text: '#000000',
    background: '#FFFFFF',
    tint: tintColorLight,
    tabIconDefault: '#94A3B8',
    tabIconSelected: tintColorLight,
    // Habyss Theme Colors
    primary: '#3B82F6', // Blue 500
    primaryLight: '#60A5FA', // Blue 400
    primaryDark: '#1D4ED8', // Blue 700
    secondary: '#6366F1', // Indigo 500
    accent: '#8B5CF6', // Violet 500
    success: '#10B981', // Emerald 500
    warning: '#F59E0B', // Amber 500
    error: '#EF4444', // Red 500
    surface: '#FFFFFF',
    surfaceSecondary: '#F8FAFC',
    surfaceTertiary: '#F1F5F9',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textTertiary: '#94A3B8',
    // Gradient Colors
    gradientStart: '#3B82F6',
    gradientEnd: '#1D4ED8',
    gradientLight: '#60A5FA',
    gradientDark: '#1E40AF',
  },
  dark: {
    text: '#FFFFFF',
    background: '#000000',
    tint: tintColorDark,
    tabIconDefault: '#64748B',
    tabIconSelected: tintColorDark,
    // Habyss Theme Colors
    primary: '#60A5FA', // Blue 400
    primaryLight: '#93C5FD', // Blue 300
    primaryDark: '#3B82F6', // Blue 500
    secondary: '#818CF8', // Indigo 400
    accent: '#A78BFA', // Violet 400
    success: '#34D399', // Emerald 400
    warning: '#FBBF24', // Amber 400
    error: '#F87171', // Red 400
    surface: '#0F172A',
    surfaceSecondary: '#1E293B',
    surfaceTertiary: '#334155',
    border: '#334155',
    borderLight: '#475569',
    textPrimary: '#F8FAFC',
    textSecondary: '#CBD5E1',
    textTertiary: '#94A3B8',
    // Gradient Colors
    gradientStart: '#60A5FA',
    gradientEnd: '#3B82F6',
    gradientLight: '#93C5FD',
    gradientDark: '#1D4ED8',
  },
  // Common Colors
  common: {
    black: '#000000',
    white: '#FFFFFF',
    transparent: 'transparent',
    // Habyss Logo Colors
    habyssBlue: '#3B82F6',
    habyssBlueLight: '#60A5FA',
    habyssBlueDark: '#1D4ED8',
    habyssGradientStart: '#3B82F6',
    habyssGradientEnd: '#1D4ED8',
  }
};
