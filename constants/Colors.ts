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
    text: '#FFFFFF',
    background: '#1A1D2E', // Background Dark (Brand Deep Blue)
    tint: tintColorDark,
    tabIconDefault: '#6B7280',
    tabIconSelected: tintColorDark,
    
    // Brand Colors
    primary: '#8BADD6', // Light Blue for visibility on dark
    primaryLight: '#C8D9ED', // Blue-100
    primaryDark: '#5B7FB8', // Mid Blue
    secondary: '#5B7FB8',
    accent: '#FF6B6B', // Keep Coral or maybe lighter?
    
    // Status
    success: '#34D399', // Lighter green for dark mode
    brandSuccess: '#4ECDC4',
    warning: '#FBBF24',
    error: '#F87171',
    
    // Surfaces
    surface: '#252A3D', // Surface Dark
    surfaceSecondary: '#2C334A', // Slightly lighter than surface
    surfaceTertiary: '#3A4460',
    
    border: '#2E364F', // Dark border
    borderLight: '#3A4460',
    
    textPrimary: '#FFFFFF', // 87% opacity logic handled in styles usually, or use pure white
    textSecondary: '#9CA3AF', // Gray-400
    textTertiary: '#6B7280', // Gray-600
    
    // Gradients
    gradientStart: '#3A5A8C',
    gradientEnd: '#5B7FB8',
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
