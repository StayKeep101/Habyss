// The phone's look (phone.generated.ts, written by scripts/sync-theme.ts from its theme/),
// plus what a desktop needs differently: the type one step smaller (macOS body is 13 pt) and CSS easing curves.
export type ThemeName = 'abyss' | 'trueDark' | 'light';

import * as Phone from './phone.generated';

/** The phone's colours for each theme (generated from its theme/colors.ts). */
export interface Palette { background: string; textPrimary: string; textSecondary: string; textTertiary: string; primary: string; success: string; warning: string; error: string; border: string }
export const palettes: Record<ThemeName, Palette> = Phone.palettes;

/** The phone's matte surfaces (theme/designSystem.ts Surfaces). */
export interface SurfaceTone { fill: string; top: string; bottom: string; raised: string; lip: string; line: string }
export const Surfaces: Record<ThemeName, SurfaceTone> = Phone.Surfaces;

export const Radius = Phone.Radius;
export const Spacing = Phone.Spacing;
export const Control = Phone.Control;

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
export const Elevation = Phone.Elevation;
/** Daylight wants a fainter, cooler shadow. */
export const lightShadowOpacity = { card: 0.07, control: 0.06, floating: 0.12 } as const;

export const DURATION = Phone.DURATION;
// Reanimated out/in/inOut cubic as CSS cubic-bezier.
export const EASE = { enter: 'cubic-bezier(0.33,1,0.68,1)', exit: 'cubic-bezier(0.32,0,0.67,0)', move: 'cubic-bezier(0.65,0,0.35,1)' } as const;
