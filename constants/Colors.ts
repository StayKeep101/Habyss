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
    tint: '#4E5F87',
    tabIconDefault: '#94A3B8',
    tabIconSelected: '#4E5F87',
    // Habyss Theme Colors - Logo Inspired (Desaturated Slate Blue)
    primary: '#4E5F87', // Darker slate-blue from logo
    primaryLight: '#9CB1D6', // Lighter steel-blue from logo
    primaryDark: '#3A4866', // Deep slate for contrast
    secondary: '#7589B0', // Mid-tone blue-gray
    accent: '#4E5F87', // Slate-blue for primary actions
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
    // Gradient Colors - REMOVED/FLATTENED
    gradientStart: '#4E5F87',
    gradientEnd: '#4E5F87',
    gradientLight: '#9CB1D6',
    gradientDark: '#4E5F87',
  },
  dark: {
    text: '#FFFFFF',
    background: '#000000', // Pure black
    tint: '#9CB1D6', // Light steel-blue
    tabIconDefault: '#4E5F87',
    tabIconSelected: '#9CB1D6',
    // Habyss Theme Colors - Logo Inspired (Desaturated Slate Blue)
    primary: '#9CB1D6', // Light steel-blue for dark mode
    primaryLight: '#B0C2E3', // Even lighter for hover/active
    primaryDark: '#4E5F87', // Slate-blue for depth
    secondary: '#7589B0', // Mid-tone
    accent: '#9CB1D6', // Light steel-blue for accents
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    surface: '#111111', // Very dark gray, almost black
    surfaceSecondary: '#1C1C1E', // Standard iOS dark gray
    surfaceTertiary: '#2C2C2E',
    border: '#333333',
    borderLight: '#444444',
    textPrimary: '#FFFFFF',
    textSecondary: '#9CB1D6', // Light steel-blue
    textTertiary: '#4E5F87', // Darker slate
    // Gradient Colors - REMOVED/FLATTENED
    gradientStart: '#9CB1D6',
    gradientEnd: '#9CB1D6',
    gradientLight: '#9CB1D6',
    gradientDark: '#4E5F87',
  },
  // Common Colors
  common: {
    black: '#000000',
    white: '#FFFFFF',
    transparent: 'transparent',
    // Habyss Logo Colors - Exact logo palette
    habyssSlate: '#4E5F87',
    habyssSteel: '#9CB1D6',
    habyssDarkSlate: '#3A4866',
    // Logo Specific Colors
    logoBackground: '#000000',
  }
};
