import { StyleSheet } from 'react-native';
import { Spacing } from '@/theme/designSystem';

/** How tall the panel's soft top edge is. */
export const PANEL_FADE = Spacing.section * 3;

/** The look of app/(root)/(tabs)/home.tsx's floating parts. */
export const homeStyles = StyleSheet.create({
    /** The floating stats bar, fixed over everything. */
    bar: { position: 'absolute', top: 0, left: 0, right: 0 },
    /** Behind the bar and a little under it: the page colour at the top, clear by its foot. */
    barFade: { position: 'absolute', top: 0, bottom: -Spacing.lg, left: 0, right: 0 },
    /** The panel rising over the scene: no edge of its own, it rises out of the night (panelFade). */
    panel: {},
    /** Above the panel: its own colour fading up into the scene, a soft shadow instead of a drawn edge. */
    panelFade: { position: 'absolute', top: -PANEL_FADE, left: 0, right: 0, height: PANEL_FADE },
    /** One stat's own matte pill in the floating bar. */
    statPill: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 2 },
    /** The scene behind everything, fading as the panel rises. */
    scene: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    /** Home's sheets and moments, over the page. */
    overlays: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
