import type { ImageSourcePropType } from 'react-native';

/**
 * A rank shown still (RankHourglass) is its empty frame (theme/hourglassFrames.ts):
 * the glass with no painted sand, as on Home.
 */

/**
 * How opaque every hourglass stands in the scene (Home, Focus, the carousel): at
 * its top the scene shows through (HOURGLASS_OPACITY); towards its base it turns
 * solid, so the podium's light does not shine up through the foot.
 */
export const HOURGLASS_OPACITY = 0.7;

/** The fade as a mask, top to bottom: only its alpha counts. */
export const HOURGLASS_FADE = [`rgba(0,0,0,${HOURGLASS_OPACITY})`, 'rgba(0,0,0,1)'] as const;

/** Width over height of the art (1113 × 1413). */
export const HOURGLASS_ART_RATIO = 1113 / 1413;

/**
 * The art for the live hourglass on Home (components/Home/ArtHourglass.tsx):
 * the empty glass, and the sand alone (taken from the full art by
 * scripts/extract-hourglass-sand.py), which is shown a little at a time as the
 * day runs. `topSand` is where the top sand starts the day, `pile` the top of
 * the full pile, both on the art's own 1113 × 1413 grid. A rank without these
 * stays drawn there.
 */
export interface LiveGlassArt { glass: ImageSourcePropType; sand: ImageSourcePropType; topSand: number; pile: number }

export const LIVE_HOURGLASS_ART: Record<string, LiveGlassArt> = {
    Growing: { glass: require('@/assets/images/hourglasses/empty/growing.png'), sand: require('@/assets/images/hourglasses/sand/growing.png'), topSand: 606, pile: 1016 },
    Disciplined: { glass: require('@/assets/images/hourglasses/empty/disciplined.png'), sand: require('@/assets/images/hourglasses/sand/disciplined.png'), topSand: 572, pile: 1035 },
    Focused: { glass: require('@/assets/images/hourglasses/empty/focused.png'), sand: require('@/assets/images/hourglasses/sand/focused.png'), topSand: 582, pile: 1033 },
    Unbreakable: { glass: require('@/assets/images/hourglasses/empty/unbreakable.png'), sand: require('@/assets/images/hourglasses/sand/unbreakable.png'), topSand: 558, pile: 977 },
};

/**
 * Ranks whose Home hourglass is drawn in the app's own material
 * (components/Home/CraftedHourglass.tsx): the cards' matte surface for the
 * frame, the rank's colour only in the sand and two thin lines.
 */
export const CRAFTED_HOURGLASS: ReadonlySet<string> = new Set(['Growing']);

/**
 * Trying a hourglass design on Home as a still picture, to judge the fit
 * before it is drawn live (a test: the sand does not move).
 */
export const HOME_PREVIEW_ART: Record<string, { image: ImageSourcePropType; ratio: number }> = {
    Growing: { image: require('@/assets/images/hourglasses/home-preview.png'), ratio: 623 / 829 },
};

/**
 * Home's scene: a temple at night, the hourglass on its podium. On the image's
 * own grid: its size, the podium's top step (where the hourglass stands: the
 * bottom of its lit edge, 888–901, so it covers the light and none shines under it) and
 * where the stairs end (the cards start below them).
 */
export const TEMPLE = {
    image: require('@/assets/images/scenes/temple.jpg') as ImageSourcePropType,
    width: 1199,
    height: 1312,
    step: 901,
    stairsEnd: 1075,
};

/**
 * The blue hourglass's own colours, sampled from the art, for the live one
 * drawn with Skia (components/Home/SkiaHourglass.tsx). Its sand is the rank's.
 */
export const HOURGLASS_INK = {
    pillar: ['#4A5888', '#5C6B9E', '#3F4C7A'],
    glass: ['#1F2B4C', '#162039', '#1B2747'],
    rim: '#9BB2F0',
    rimGlow: '#8FA8EE',
    cap: ['#7A8DC9', '#4A5A92', '#3A4878'],
} as const;
