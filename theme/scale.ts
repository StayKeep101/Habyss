import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Design baseline: iPhone 14/15 (390 x 844)
const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

/**
 * How much bigger or smaller than the design phone things are drawn.
 *
 * Read off the shortest side, so turning the device (or an iPad opened in
 * landscape, or a foldable opened flat) does not change it, and capped: a
 * small phone shrinks a little, a big one grows a little, and an iPad gets
 * the phone's sizes with room around them rather than everything 2.6 times
 * bigger. The extra room goes to layout (useResponsiveLayout), not to size.
 */
const MIN_SCALE = 0.85;
const MAX_SCALE = 1.15;
const clampScale = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
const SHORT_SIDE = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT);
const LONG_SIDE = Math.max(SCREEN_WIDTH, SCREEN_HEIGHT);
const widthScale = clampScale(SHORT_SIDE / BASE_WIDTH);
const heightScale = clampScale(LONG_SIDE / BASE_HEIGHT);

/**
 * Scale a value proportionally to the screen width.
 * Use for: fontSize, padding, margin, borderRadius, icon sizes, gap.
 */
export function s(size: number): number {
  return Math.round(PixelRatio.roundToNearestPixel(size * widthScale));
}

/**
 * Scale a value proportionally to the screen height.
 * Use for: vertical spacing, container heights, top/bottom padding.
 */
export function vs(size: number): number {
  return Math.round(PixelRatio.roundToNearestPixel(size * heightScale));
}

/**
 * Moderate scale — a blend between width-scale and no-scale.
 * Good for font sizes so text doesn't get too tiny on small screens
 * or too huge on tablets. factor=0.5 by default (half-way).
 */
export function ms(size: number, factor: number = 0.5): number {
  return Math.round(
    PixelRatio.roundToNearestPixel(size + (s(size) - size) * factor)
  );
}

export { SCREEN_WIDTH, SCREEN_HEIGHT };
