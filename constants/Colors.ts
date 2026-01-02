/**
 * Habyss Brand Colors
 * Based on BRAND.md and FIGMA_FILE.md
 */

const tintColorLight = '#3A5A8C';
const tintColorDark = '#8BADD6';

export const Colors = {
  light: {
    text: '#1F2937', // Text Primary
    background: '#F8F9FA', // Background Light
    tint: tintColorLight,
    tabIconDefault: '#9CA3AF', // Text Tertiary
    tabIconSelected: tintColorLight,

    // Brand Colors
    primary: '#3A5A8C', // Deep Blue
    primaryLight: '#8BADD6', // Light Blue
    primaryDark: '#2A4470', // Blue-900 (Deepest)
    secondary: '#5B7FB8', // Mid Blue
    accent: '#FF6B6B', // Energetic Coral

    // Status
    success: '#10B981', // Semantic Success
    brandSuccess: '#4ECDC4', // Success Green
    warning: '#F59E0B',
    error: '#EF4444',

    // Surfaces
    surface: '#FFFFFF',
    surfaceSecondary: '#F3F4F6', // Gray-100 ish for secondary surfaces
    surfaceTertiary: '#E5E7EB', // Border Light color used as tertiary surface if needed

    border: '#E5E7EB',
    borderLight: '#F3F4F6',

    textPrimary: '#1F2937',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',

    // Gradients
    gradientStart: '#3A5A8C',
    gradientEnd: '#5B7FB8',
  },
  abyss: {
    text: '#E0E6ED', // High Emphasis (Cloud White)
    background: '#050505', // Void Black (Not pure black)
    tint: '#00F0FF', // Electric Cyan (Focus)
    tabIconDefault: '#94A3B8', // Low Emphasis (Blue-Grey)
    tabIconSelected: '#00F0FF', // Electric Cyan

    // Brand Colors (Bioluminescence)
    primary: '#00F0FF', // Electric Cyan (Focus)
    primaryLight: '#7B2CBF', // Phantom Purple (Wisdom) - used for secondary brand elements
    primaryDark: '#0A0F14', // Trench Blue (Secondary Background)
    secondary: '#121826', // Abyssal Navy (Surfaces)
    accent: '#FF4757', // Alert Coral

    // Status
    success: '#00FF94', // Algae Green
    brandSuccess: '#00FF94',
    warning: '#F59E0B',
    error: '#FF4757', // Alert Coral

    // Surfaces
    surface: '#121826', // Abyssal Navy
    surfaceSecondary: '#0A0F14', // Trench Blue
    surfaceTertiary: 'rgba(255, 255, 255, 0.08)', // Glass White

    border: 'rgba(255, 255, 255, 0.08)', // Glass White
    borderLight: 'rgba(255, 255, 255, 0.15)',

    textPrimary: '#E0E6ED', // High Emphasis
    textSecondary: '#94A3B8', // Low Emphasis
    textTertiary: '#64748B', // Muted

    // Gradients
    gradientStart: '#0A0F14', // Trench Blue
    gradientEnd: '#050505', // Void Black
  },
  trueDark: {
    text: '#FFFFFF',
    background: '#000000', // Pure Black
    tint: tintColorDark,
    tabIconDefault: '#6B7280',
    tabIconSelected: tintColorDark,

    // Brand Colors
    primary: '#8BADD6', // Light Blue
    primaryLight: '#C8D9ED', // Blue-100
    primaryDark: '#5B7FB8', // Mid Blue
    secondary: '#5B7FB8',
    accent: '#FF6B6B',

    // Status
    success: '#34D399',
    brandSuccess: '#4ECDC4',
    warning: '#FBBF24',
    error: '#F87171',

    // Surfaces
    surface: '#121212', // Slightly off-black for OLED contrast
    surfaceSecondary: '#1C1C1E', // Standard iOS dark gray
    surfaceTertiary: '#2C2C2E',

    border: '#333333',
    borderLight: '#444444',

    textPrimary: '#FFFFFF',
    textSecondary: '#A1A1AA', // Gray-400 equivalent
    textTertiary: '#71717A', // Gray-500

    // Gradients
    gradientStart: '#3A5A8C',
    gradientEnd: '#5B7FB8',
  },
  common: {
    black: '#000000',
    white: '#FFFFFF',
    transparent: 'transparent',

    // Core Brand Palette
    deepBlue: '#3A5A8C',
    midBlue: '#5B7FB8',
    lightBlue: '#8BADD6',
    successGreen: '#4ECDC4',
    energeticCoral: '#FF6B6B',
    warmGold: '#FFD93D',
    softPurple: '#A78BFA',
  }
};

// Backwards compatibility alias
// @ts-ignore
Colors.dark = Colors.abyss;
