import type { ImageSourcePropType } from 'react-native';

/**
 * Focus's backgrounds: your own pictures, behind the clock and the hourglass
 * (Focus settings → Background), besides None (plain black, the default).
 *
 * To add one: put the picture in assets/images/focus/ and add a line here,
 *   { id: 'forest', label: 'Forest', image: require('@/assets/images/focus/forest.jpg') },
 * The id is what is saved, so keep it once people may have chosen it.
 * A picture fills the screen (cropped to it, never stretched).
 */
export interface FocusPicture { id: string; label: string; image: ImageSourcePropType }

export const FOCUS_BACKGROUNDS: FocusPicture[] = [];
