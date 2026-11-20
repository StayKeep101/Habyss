import { StyleSheet } from 'react-native';
import { Spacing } from '@/theme/designSystem';

/** The look of app/(root)/(tabs)/home.tsx's floating parts. */
export const homeStyles = StyleSheet.create({
    /** The floating stats bar, fixed over everything. */
    bar: { position: 'absolute', top: 0, left: 0, right: 0 },
    /** Behind the bar and a little under it: the page colour at the top, clear by its foot. */
    barFade: { position: 'absolute', top: 0, bottom: -Spacing.lg, left: 0, right: 0 },
    /** The day's cards: no surface of their own, they float over the scene as it fades away. */
    panel: {},
    /** One stat's own matte pill in the floating bar. */
    statPill: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 2 },
    /** The scene behind everything, fading as the panel rises. */
    scene: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    /** The scene's last stretch, fading into the page's colour. */
    sceneFoot: { position: 'absolute', left: 0, right: 0 },
    /** The hourglass, fixed on the podium (behind the page, which rises over it). */
    glassStage: { position: 'absolute' },
    /** Where the page takes a tap on the hourglass. */
    glassTap: { position: 'absolute', left: '50%' },
    /** Home's sheets and moments, over the page. */
    overlays: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
