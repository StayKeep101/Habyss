import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Design baseline: iPhone 14/15 (390 x 844)
const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

// Scale factor based on screen width (most important for horizontal layout)
const widthScale = SCREEN_WIDTH / BASE_WIDTH;
// Scale factor based on screen height
const heightScale = SCREEN_HEIGHT / BASE_HEIGHT;

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
