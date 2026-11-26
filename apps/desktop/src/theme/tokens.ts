// How Habyss looks, from packages/design (the same values the phone draws with), plus what a desktop needs
// differently: the type one step smaller (macOS body is 13 pt) and CSS easing curves.
import { Colors } from '@habyss/design/colors';
import * as Design from '@habyss/design/surfaces';
import { DURATION as Durations } from '@habyss/design/motion';

export type ThemeName = 'abyss' | 'trueDark' | 'light';

/** Each theme's colours. */
export interface Palette { background: string; textPrimary: string; textSecondary: string; textTertiary: string; primary: string; success: string; warning: string; error: string; border: string }
const pick = (t: ThemeName): Palette => {
  const c = Colors[t];
  return { background: c.background, textPrimary: c.textPrimary, textSecondary: c.textSecondary, textTertiary: c.textTertiary, primary: c.primary, success: c.success, warning: c.warning, error: c.error, border: c.border };
};
export const palettes: Record<ThemeName, Palette> = { light: pick('light'), abyss: pick('abyss'), trueDark: pick('trueDark') };

/** The matte surfaces. */
export type SurfaceTone = Design.SurfaceTone;
export const Surfaces: Record<ThemeName, SurfaceTone> = Design.Surfaces;

export const Radius = Design.Radius;
export const Spacing = Design.Spacing;
export const Control = Design.Control;

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

/** Elevation as the CSS box-shadow wants it: offset, opacity, blur. */
type Level = keyof typeof Design.Elevation;
const shadow = (k: Level) => ({ height: Design.Elevation[k].shadowOffset.height, opacity: Design.Elevation[k].shadowOpacity, radius: Design.Elevation[k].shadowRadius });
export const Elevation: Record<Level, { height: number; opacity: number; radius: number }> = { card: shadow('card'), control: shadow('control'), floating: shadow('floating') };
/** Daylight wants a fainter, cooler shadow. */
export const lightShadowOpacity = Design.LightShadowOpacity;

export const DURATION = Durations;
// Reanimated out/in/inOut cubic as CSS cubic-bezier.
export const EASE = { enter: 'cubic-bezier(0.33,1,0.68,1)', exit: 'cubic-bezier(0.32,0,0.67,0)', move: 'cubic-bezier(0.65,0,0.35,1)' } as const;
