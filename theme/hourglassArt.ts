import type { ImageSourcePropType } from 'react-native';

/**
 * Each rank's hourglass, as finished art (assets/images/hourglasses): used
 * wherever a rank is shown still (RankHourglass). The live glass on Home,
 * whose sand runs with the day, is still drawn (theme/hourglassDesigns.ts).
 */
export const HOURGLASS_ART: Record<string, ImageSourcePropType> = {
    Lost: require('@/assets/images/hourglasses/lost.png'),
    Beginner: require('@/assets/images/hourglasses/beginner.png'),
    Growing: require('@/assets/images/hourglasses/growing.png'),
    Consistent: require('@/assets/images/hourglasses/consistent.png'),
    Disciplined: require('@/assets/images/hourglasses/disciplined.png'),
    Focused: require('@/assets/images/hourglasses/focused.png'),
    Master: require('@/assets/images/hourglasses/master.png'),
    Unbreakable: require('@/assets/images/hourglasses/unbreakable.png'),
    Timekeeper: require('@/assets/images/hourglasses/timekeeper.png'),
    Eternal: require('@/assets/images/hourglasses/eternal.png'),
};

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
 * A quiet, matte hourglass for Home (no texture, no badge): its glass is
 * measured off the image so the day's sand can be drawn inside it
 * (components/Home/MatteHourglass.tsx). On the image's own pixel grid: the
 * glass's centre, and its half-width at each height, top bulb then bottom.
 */
export interface MatteGlass {
    image: ImageSourcePropType;
    width: number;
    height: number;
    centre: number;
    top: [number, number][];
    bottom: [number, number][];
    /** Where the top sand starts the day, and how high the pile ends it. */
    topFull: number;
    pileFull: number;
    /** The clear margin either side, as a share of the width. */
    bleed: number;
}

const BRONZE: MatteGlass = {
    image: require('@/assets/images/hourglasses/matte/bronze.png'),
    width: 1068,
    height: 1473,
    centre: 531,
    // Measured, then brought in from the rim so the sand never touches it.
    top: [[352, 205], [400, 246], [450, 259], [500, 257], [550, 240], [600, 207], [650, 161], [700, 109], [750, 58], [800, 25], [825, 14]],
    bottom: [[825, 14], [850, 31], [900, 77], [950, 132], [1000, 182], [1050, 223], [1100, 248], [1150, 258], [1200, 252], [1240, 228], [1262, 190]],
    topFull: 470,
    pileFull: 1070,
    bleed: 0.04,
};

/** The matte hourglass Home shows for a rank, before any finished art. */
export const MATTE_HOURGLASS: Record<string, MatteGlass> = {
    Growing: BRONZE,
};
