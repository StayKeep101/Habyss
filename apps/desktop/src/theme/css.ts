import { DURATION, EASE, Elevation, Radius, Spacing, Surfaces, lightShadowOpacity, palettes, type ThemeName } from './tokens';

export type { ThemeName };
export type Appearance = 'dark' | 'light' | 'system';

/** The settings value resolved to a theme: dark is abyss, system follows the OS. */
export function themeForAppearance(appearance: Appearance, prefersLight = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches): ThemeName {
  if (appearance === 'light') return 'light';
  if (appearance === 'dark') return 'abyss';
  return prefersLight ? 'light' : 'abyss';
}

export function cssVars(theme: ThemeName): Record<string, string> {
  const p = palettes[theme], s = Surfaces[theme];
  const rgb = theme === 'light' ? '15,23,42' : '0,0,0';
  const shadow = (k: keyof typeof Elevation) => `0 ${Elevation[k].height}px ${Elevation[k].radius}px rgba(${rgb},${theme === 'light' ? lightShadowOpacity[k] : Elevation[k].opacity})`;
  const vars: Record<string, string> = {
    '--bg': p.background, '--surface': s.fill, '--surface-top': s.top, '--surface-bottom': s.bottom, '--surface-raised': s.raised,
    '--lip': s.lip, '--line': s.line, '--text': p.textPrimary, '--text-muted': p.textSecondary, '--text-subtle': p.textTertiary,
    '--accent': p.primary, '--success': p.success, '--warning': p.warning, '--danger': p.error,
    '--ease-enter': EASE.enter, '--ease-exit': EASE.exit, '--ease-move': EASE.move,
    '--shadow-card': shadow('card'), '--shadow-control': shadow('control'), '--shadow-floating': shadow('floating'),
    '--font-body': '"Lexend", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', '--font-display': '"Space Grotesk", "Lexend", sans-serif',
  };
  for (const [k, v] of Object.entries(Radius)) vars[`--radius-${k}`] = `${v}px`;
  for (const [k, v] of Object.entries(Spacing)) vars[`--space-${k}`] = `${v}px`;
  for (const k of ['tap', 'quick', 'base', 'exit', 'emphasis'] as const) vars[`--dur-${k}`] = `${DURATION[k]}ms`;
  return vars;
}

export function applyTheme(theme: ThemeName, root: HTMLElement = document.documentElement): void {
  for (const [k, v] of Object.entries(cssVars(theme))) root.style.setProperty(k, v);
  root.dataset.theme = theme;
  root.style.colorScheme = theme === 'light' ? 'light' : 'dark';
}
