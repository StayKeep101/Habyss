// Port of the phone's theme/colors.ts, designSystem.ts and motion.ts. Values are copied exactly.
export type ThemeName = 'abyss' | 'trueDark' | 'light';

export interface Palette { background: string; textPrimary: string; textSecondary: string; textTertiary: string; primary: string; success: string; warning: string; error: string }
export const palettes: Record<ThemeName, Palette> = {
  light: { background: '#FFFFFF', textPrimary: '#0F172A', textSecondary: '#475569', textTertiary: '#64748B', primary: '#3B82F6', success: '#20C98B', warning: '#FFAD29', error: '#EF4444' },
  abyss: { background: '#050505', textPrimary: '#F4F5F7', textSecondary: '#A3A3AD', textTertiary: '#8A8A94', primary: '#8EB0FF', success: '#2FE3A1', warning: '#FFB020', error: '#FF4757' },
  trueDark: { background: '#000000', textPrimary: '#FFFFFF', textSecondary: '#A1A1AA', textTertiary: '#90909B', primary: '#7098FF', success: '#20C98B', warning: '#FFAD29', error: '#EF4444' },
};

export interface SurfaceTone { fill: string; top: string; bottom: string; raised: string; lip: string; line: string }
export const Surfaces: Record<ThemeName, SurfaceTone> = {
  light: { fill: '#F2F2F5', top: '#F8F8FA', bottom: '#ECECF0', raised: '#E6E6EB', lip: 'rgba(15,23,42,0.06)', line: 'rgba(15,23,42,0.07)' },
  abyss: { fill: '#111113', top: '#18181B', bottom: '#0C0C0E', raised: '#1C1C1F', lip: 'rgba(255,255,255,0.06)', line: 'rgba(255,255,255,0.05)' },
  trueDark: { fill: '#101010', top: '#171717', bottom: '#0B0B0B', raised: '#1B1B1B', lip: 'rgba(255,255,255,0.06)', line: 'rgba(255,255,255,0.05)' },
};

export const Radius = { small: 12, control: 18, card: 22, sheet: 24, pill: 999 } as const;
export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, section: 32 } as const;
export const Control = { height: 54, hitTarget: 44, icon: 20 } as const;

/** Desktop sizes, in line with Notion, ClickUp, Claude and Apple's HIG (body 13–14 pt): the phone's scale, one step tighter. */
export const Typography = {
  screenTitle: { weight: 700, size: 26, lineHeight: 32, letterSpacing: -0.6 },
  title: { weight: 700, size: 20, lineHeight: 28 },
  heading: { weight: 600, size: 15, lineHeight: 22 },
  body: { weight: 400, size: 14, lineHeight: 20 },
  bodySmall: { weight: 400, size: 13, lineHeight: 18 },
  caption: { weight: 400, size: 12, lineHeight: 16 },
  button: { weight: 500, size: 13, lineHeight: 18 },
} as const;

/** React Native shadow (offset, opacity, radius) as it is turned into CSS box-shadow. */
export const Elevation = {
  card: { height: 8, opacity: 0.45, radius: 18 },
  control: { height: 4, opacity: 0.4, radius: 10 },
  floating: { height: 18, opacity: 0.38, radius: 36 },
} as const;
/** Daylight wants a fainter, cooler shadow. */
export const lightShadowOpacity = { card: 0.07, control: 0.06, floating: 0.12 } as const;

export const DURATION = { tap: 120, quick: 180, base: 260, exit: 190, emphasis: 420, reward: 700 } as const;
// Reanimated out/in/inOut cubic as CSS cubic-bezier.
export const EASE = { enter: 'cubic-bezier(0.33,1,0.68,1)', exit: 'cubic-bezier(0.32,0,0.67,0)', move: 'cubic-bezier(0.65,0,0.35,1)' } as const;
