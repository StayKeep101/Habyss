/**
 * Habyss Brand Colors
 * Based on BRAND.md and FIGMA_FILE.md
 */

const tintColorLight = '#3B82F6';
const tintColorDark = '#8B5CF6';

/**
 * The app's palette, in one switch. 'slate' is the deep blue-grey palette
 * (#06141B → #CCD0CF); 'original' is Habyss's first look (near-black with
 * white text). Change this one word to go back; theme/designSystem.ts
 * Surfaces follows it too.
 */
export const PALETTE: 'original' | 'slate' = 'slate';

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
    success: '#20C98B', // Emerald-500
    brandSuccess: '#4ECDC4', // Teal
    warning: '#FFAD29', // Amber-500
    error: '#EF4444', // Red-500

    // Community: restrained game colours (cobalt leads, silver follows).
    cobalt: '#1F4FD8', // 6.6:1 on white
    silver: '#5F6673', // 5.8:1 on white

    // Surfaces - Light mode surfaces
    surface: '#FFFFFF', // Pure white
    surfaceSecondary: '#F8FAFC', // Slate-50 - very subtle gray
    surfaceTertiary: '#F1F5F9', // Slate-100

    border: '#E2E8F0', // Slate-200
    borderLight: '#F1F5F9', // Slate-100

    textPrimary: '#0F172A', // Slate-900 - almost black
    textSecondary: '#475569', // Slate-600
    textTertiary: '#64748B', // Slate-400

    // Gradients - Use vibrant Habyss colors for light mode
    gradientStart: '#3B82F6', // Blue-500
    gradientEnd: '#8B5CF6', // Violet-500
  },
  abyss: PALETTE === 'slate' ? {
    // The slate palette (#06141B #11212D #253745 #4A5C6A #9BA8AB #CCD0CF): the
    // dark blue-greys of deep water. Your rank's colour stays the accent.
    text: '#CCD0CF', // Mist: 10.6:1 on a card
    background: '#06141B', // The deep
    tint: '#8EB0FF', // Habyss blue (the rank's colour takes over)
    tabIconDefault: '#8A979B', // Between Fog and Steel: 5.5:1 on a card
    tabIconSelected: '#8EB0FF',

    primary: '#8EB0FF',
    primaryLight: '#7B2CBF',
    primaryDark: '#0B1A23', // Between the deep and Slate
    secondary: '#11212D', // Slate
    accent: '#FF4757',

    success: '#2FE3A1',
    brandSuccess: '#4ECDC4',
    warning: '#FFB020',
    error: '#FF4757',

    cobalt: '#6494FF',
    silver: '#CCD0CF', // Mist

    surface: '#11212D', // Slate: cards
    surfaceSecondary: '#0B1A23',
    surfaceTertiary: 'rgba(155, 168, 171, 0.10)', // Fog, faint

    border: '#253745', // Harbour: hairlines only, never text
    borderLight: '#4A5C6A', // Steel: lines and tracks only (2.4:1, too faint for text)

    textPrimary: '#CCD0CF', // Mist: 10.6:1 on a card
    textSecondary: '#9BA8AB', // Fog: 6.7:1 on a card
    textTertiary: '#8A979B', // Between Steel and Fog: 5.5:1 on a card

    gradientStart: '#11212D',
    gradientEnd: '#06141B',
  } : {
    text: '#F4F5F7', // High emphasis: crisp white
    background: '#050505', // Void Black (Not pure black)
    tint: '#8EB0FF', // Habyss blue, bright
    tabIconDefault: '#8A8A94', // Neutral grey
    tabIconSelected: '#8EB0FF', // Habyss blue, bright

    // Brand Colors (Muted Blue Palette)
    primary: '#8EB0FF', // Habyss blue, bright
    primaryLight: '#7B2CBF', // Phantom Purple (Wisdom) - used for secondary brand elements
    primaryDark: '#0A0F14', // Trench Blue (Secondary Background)
    secondary: '#121826', // Abyssal Navy (Surfaces)
    accent: '#FF4757', // Alert Coral

    // Status
    success: '#2FE3A1', // Vivid green
    brandSuccess: '#4ECDC4',
    warning: '#FFB020', // Vivid amber
    error: '#FF4757', // Alert Coral

    // Community: restrained game colours (cobalt leads, silver follows).
    cobalt: '#6494FF', // 6.1:1 on the card, 4.8:1 on its own pill
    silver: '#C3C9D4', // 10.7:1 on the card

    // Surfaces
    surface: '#121826', // Abyssal Navy
    surfaceSecondary: '#0A0F14', // Trench Blue
    surfaceTertiary: 'rgba(255, 255, 255, 0.08)', // Glass White

    border: 'rgba(255, 255, 255, 0.08)', // Glass White
    borderLight: 'rgba(255, 255, 255, 0.15)',

    textPrimary: '#F4F5F7', // Crisp white
    textSecondary: '#A3A3AD', // Neutral grey
    textTertiary: '#8A8A94', // Quiet neutral grey

    // Gradients
    gradientStart: '#0A0F14', // Trench Blue
    gradientEnd: '#050505', // Void Black
  },
  trueDark: {
    text: '#FFFFFF',
    background: '#000000', // Pure Black - OLED
    tint: '#7098FF', // Muted Light Blue (same as abyss)
    tabIconDefault: '#4B5563', // Darker icons
    tabIconSelected: '#7098FF', // Muted Light Blue

    // Brand Colors - Use muted blue (accent color via context overrides these)
    primary: '#7098FF', // Muted Light Blue (not purple)
    primaryLight: '#A8C4E0', // Lighter blue
    primaryDark: '#5B7FB8', // Mid blue
    secondary: '#3A5A8C', // Deep blue
    accent: '#7098FF', // Muted blue

    // Status
    success: '#20C98B', // Emerald-500
    brandSuccess: '#4ECDC4',
    warning: '#FFAD29',
    error: '#EF4444',

    // Community: restrained game colours (cobalt leads, silver follows).
    cobalt: '#4F7DFF', // 4.9:1 on a raised chip, 5.7:1 on black
    silver: '#BFC5CF', // 10.3:1 on a raised chip

    // Surfaces - Pure blacks for OLED
    surface: '#000000', // Pure black
    surfaceSecondary: '#0A0A0A', // Nearly pure black
    surfaceTertiary: '#171717', // Very dark gray

    border: '#262626', // Neutral-800
    borderLight: '#3F3F46', // Zinc-700

    textPrimary: '#FFFFFF',
    textSecondary: '#A1A1AA', // Zinc-400
    textTertiary: '#90909B', // Zinc-500

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
    lightBlue: '#7098FF',
    successGreen: '#4ECDC4',
    energeticCoral: '#FF6B6B',
    warmGold: '#FFD93D',
    softPurple: '#A78BFA',
  }
};

/**
 * Each rank's colour (lib/marks.ts RANKS), "into the light": the deeper you
 * climb, the brighter the gem. Only ever the gem and its glow, never text;
 * the rank's name stays in the text colours. Eternal is white light, broken
 * into an iridescent sweep (EternalIridescence).
 */
export const RankColors = {
  Lost: '#4B5563',
  Beginner: '#5B5F97',
  Growing: '#4F46E5',
  Consistent: '#2563EB',
  Disciplined: '#06B6D4',
  Focused: '#10B981',
  Master: '#F59E0B',
  Unbreakable: '#F97316',
  Timekeeper: '#FDE68A',
  Eternal: '#FFFFFF',
} as const;

/** Eternal's light, split as it passes through the gem. */
export const EternalIridescence = ['#FFFFFF', '#C7F9FF', '#E9D5FF', '#FDE68A'] as const;

// Backwards compatibility alias
// @ts-ignore
Colors.dark = Colors.abyss;
