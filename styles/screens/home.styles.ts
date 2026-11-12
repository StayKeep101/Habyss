import { StyleSheet } from 'react-native';

/** The look of app/(root)/(tabs)/home.tsx's floating parts. */
export const homeStyles = StyleSheet.create({
    /** The floating stats bar, fixed over everything. */
    bar: { position: 'absolute', top: 0, left: 0, right: 0 },
    /** Dark at the very top, gone below the bar: the cards pass under it and fade. */
    barFade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: -24 },
    /** Home's sheets and moments, over the page. */
    overlays: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
