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
    // Habyss Theme Colors - Landing Page Inspired
    primary: '#4A70B8', // Muted blue from landing page
    primaryLight: '#7EA0D8', // Lighter blue gradient
    primaryDark: '#3B82F6', // Vibrant blue for accents
    secondary: '#5A7BB8', // Medium blue for text
    accent: '#3B82F6', // Vibrant blue for buttons
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
    // Gradient Colors - Landing Page Inspired
    gradientStart: '#4A70B8',
    gradientEnd: '#7EA0D8',
    gradientLight: '#7EA0D8',
    gradientDark: '#3B82F6',
  },
  dark: {
    text: '#FFFFFF',
    background: '#000000', // Pure black background like logo
    tint: '#7EA0D8', // Lighter blue from logo gradient
    tabIconDefault: '#4A70B8', // Darker blue from logo
    tabIconSelected: '#7EA0D8', // Lighter blue from logo
    // Habyss Theme Colors - Logo Inspired
    primary: '#7EA0D8', // Lighter blue from logo gradient
    primaryLight: '#7EA0D8', // Same as primary for consistency
    primaryDark: '#4A70B8', // Darker blue from logo
    secondary: '#4A70B8', // Darker blue for secondary elements
    accent: '#7EA0D8', // Lighter blue for accents
    success: '#34D399', // Emerald 400
    warning: '#FBBF24', // Amber 400
    error: '#F87171', // Red 400
    surface: '#111111', // Very dark gray, slightly lighter than black
    surfaceSecondary: '#1A1A1A', // Dark gray for cards/buttons
    surfaceTertiary: '#222222', // Even lighter for subtle elements
    border: '#333333', // Dark gray for borders
    borderLight: '#444444', // Lighter border
    textPrimary: '#FFFFFF', // White for primary text
    textSecondary: '#7EA0D8', // Lighter blue for secondary text
    textTertiary: '#4A70B8', // Darker blue for tertiary text
    // Gradient Colors - Logo Inspired
    gradientStart: '#4A70B8',
    gradientEnd: '#7EA0D8',
    gradientLight: '#7EA0D8',
    gradientDark: '#4A70B8',
  },
  // Common Colors - Logo Inspired
  common: {
    black: '#000000', // Pure black background like logo
    white: '#FFFFFF',
    transparent: 'transparent',
    // Habyss Logo Colors - Exact logo colors
    habyssBlue: '#7EA0D8', // Lighter blue from logo
    habyssBlueLight: '#7EA0D8', // Lighter blue from logo
    habyssBlueDark: '#4A70B8', // Darker blue from logo
    habyssGradientStart: '#4A70B8', // Darker blue from logo
    habyssGradientEnd: '#7EA0D8', // Lighter blue from logo
    // Logo Specific Colors
    logoBackground: '#000000',
    logoTextSecondary: '#7EA0D8',
    logoTextMuted: '#4A70B8',
    logoButtonBg: '#1A1A1A',
  }
};
