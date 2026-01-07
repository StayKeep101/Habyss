/**
 * Habyss Brand Colors
 * Based on BRAND.md and FIGMA_FILE.md
 */

const tintColorLight = '#3B82F6';
const tintColorDark = '#8B5CF6';

export const Colors = {
  light: {
    text: '#1F2937', // Text Primary
    background: '#FFFFFF', // Pure white background
    tint: tintColorLight,
    tabIconDefault: '#9CA3AF', // Text Tertiary
    tabIconSelected: tintColorLight,

    // Brand Colors - Keep the Habyss vibe with blues/purples
    primary: '#3B82F6', // Blue-500
    primaryLight: '#60A5FA', // Blue-400
    primaryDark: '#2563EB', // Blue-600
    secondary: '#8B5CF6', // Violet-500
    accent: '#EC4899', // Pink-500

    // Status
    success: '#10B981', // Emerald-500
    brandSuccess: '#4ECDC4', // Teal
    warning: '#F59E0B', // Amber-500
    error: '#EF4444', // Red-500

    // Surfaces - Light mode surfaces
    surface: '#FFFFFF', // Pure white
    surfaceSecondary: '#F8FAFC', // Slate-50 - very subtle gray
    surfaceTertiary: '#F1F5F9', // Slate-100

    border: '#E2E8F0', // Slate-200
    borderLight: '#F1F5F9', // Slate-100

    textPrimary: '#0F172A', // Slate-900 - almost black
    textSecondary: '#475569', // Slate-600
    textTertiary: '#94A3B8', // Slate-400

    // Gradients - Use vibrant Habyss colors for light mode
    gradientStart: '#3B82F6', // Blue-500
    gradientEnd: '#8B5CF6', // Violet-500
  },
  abyss: {
    text: '#E0E6ED', // High Emphasis (Cloud White)
    background: '#050505', // Void Black (Not pure black)
    tint: '#8BADD6', // Muted Light Blue (softer look)
    tabIconDefault: '#94A3B8', // Low Emphasis (Blue-Grey)
    tabIconSelected: '#8BADD6', // Muted Light Blue

    // Brand Colors (Muted Blue Palette)
    primary: '#8BADD6', // Muted Light Blue
    primaryLight: '#7B2CBF', // Phantom Purple (Wisdom) - used for secondary brand elements
    primaryDark: '#0A0F14', // Trench Blue (Secondary Background)
    secondary: '#121826', // Abyssal Navy (Surfaces)
    accent: '#FF4757', // Alert Coral

    // Status
    success: '#4ECDC4', // Softer teal green
    brandSuccess: '#4ECDC4',
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
    background: '#000000', // Pure Black - OLED
    tint: '#8BADD6', // Muted Light Blue (same as abyss)
    tabIconDefault: '#4B5563', // Darker icons
    tabIconSelected: '#8BADD6', // Muted Light Blue

    // Brand Colors - Use muted blue (accent color via context overrides these)
    primary: '#8BADD6', // Muted Light Blue (not purple)
    primaryLight: '#A8C4E0', // Lighter blue
    primaryDark: '#5B7FB8', // Mid blue
    secondary: '#3A5A8C', // Deep blue
    accent: '#8BADD6', // Muted blue

    // Status
    success: '#10B981', // Emerald-500
    brandSuccess: '#4ECDC4',
    warning: '#F59E0B',
    error: '#EF4444',

    // Surfaces - Pure blacks for OLED
    surface: '#000000', // Pure black
    surfaceSecondary: '#0A0A0A', // Nearly pure black
    surfaceTertiary: '#171717', // Very dark gray

    border: '#262626', // Neutral-800
    borderLight: '#3F3F46', // Zinc-700

    textPrimary: '#FFFFFF',
    textSecondary: '#A1A1AA', // Zinc-400
    textTertiary: '#71717A', // Zinc-500

    // Gradients - No gradients in true dark, use solid colors
    gradientStart: '#000000',
    gradientEnd: '#000000',
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
