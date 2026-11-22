import { createContext, useContext } from 'react';
import type { GestureType } from 'react-native-gesture-handler';

/**
 * A sideways pager around some content (Community's two pages, the Wallet ·
 * Streak · Missed sheet), as a gesture. Anything inside that is dragged
 * sideways itself (a chart's scrub, a pack of cards, the calendar's months)
 * holds the pager off while it has the finger, so the two never move at once.
 */
export const PagerGesture = createContext<GestureType | null>(null);
export const usePagerGesture = () => useContext(PagerGesture);
