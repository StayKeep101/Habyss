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
