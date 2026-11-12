import type { ImageSourcePropType } from 'react-native';
import type { RankLookName } from '@/theme/rankLooks';

/**
 * The scene behind Home and the hourglasses, per rank: the world your
 * hourglass stands in. Placeholders: every rank uses the moonlit desert for
 * now; give a rank its own picture by changing its entry (put the image in
 * assets/images/scenes/).
 */
const DESERT_NIGHT: ImageSourcePropType = require('@/assets/images/scenes/desert-night.jpg');

export const RANK_SCENES: Record<RankLookName, ImageSourcePropType> = {
    Lost: DESERT_NIGHT,
    Beginner: DESERT_NIGHT,
    Growing: DESERT_NIGHT,
    Consistent: DESERT_NIGHT,
    Disciplined: DESERT_NIGHT,
    Focused: DESERT_NIGHT,
    Master: DESERT_NIGHT,
    Unbreakable: DESERT_NIGHT,
    Timekeeper: DESERT_NIGHT,
    Eternal: DESERT_NIGHT,
};

export const sceneFor = (rank: string | null | undefined): ImageSourcePropType =>
    RANK_SCENES[(rank ?? 'Lost') as RankLookName] ?? RANK_SCENES.Lost;
