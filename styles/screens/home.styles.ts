import { StyleSheet } from 'react-native';
import { Radius, Spacing } from '@/theme/designSystem';

/** The look of app/(root)/(tabs)/home.tsx's floating parts. */
export const homeStyles = StyleSheet.create({
    /** The floating stats bar, fixed over everything. */
    bar: { position: 'absolute', top: 0, left: 0, right: 0 },
    /** Just under the plain dark bar: the cards fade into it as they rise, never cut. */
    // Short, so the sky and your background still show just under the bar.
    barFade: { position: 'absolute', bottom: -Spacing.xl, left: 0, right: 0, height: Spacing.xl },
    /** The panel rising over the scene, like Transit's list over its map. */
    panel: { borderTopLeftRadius: Radius.sheet * 1.5, borderTopRightRadius: Radius.sheet * 1.5, borderTopWidth: StyleSheet.hairlineWidth, borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth },
    /** One stat's own matte pill in the floating bar. */
    statPill: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 2 },
    /** The scene behind everything, fading as the panel rises. */
    scene: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    /** Home's sheets and moments, over the page. */
    overlays: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
