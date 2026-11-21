import { StyleSheet } from 'react-native';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { ms, s, vs } from '@/theme/scale';

/** The look of app/(root)/profile.tsx. Values are exactly what the screen used. */
export const styles = StyleSheet.create({
    // The banner runs to both edges, so the page's padding cannot apply to it.
    content: { paddingBottom: vs(40), gap: vs(12) },
    back: { position: 'absolute', left: 20 },
    /** Settings, opposite the back button. */
    settings: { position: 'absolute', right: 20 },
    // Half on the banner, half off it: the overlap is what makes it a profile
    // rather than a photograph with a card under it.
    // No box: a bio reads as a sentence about someone, not as a filled field.
    footnote: { fontSize: ms(11), lineHeight: ms(16), fontFamily: FontFamily.regular, textAlign: 'center', marginTop: vs(8), marginHorizontal: s(20) },
    /** The year's heatmap, under the numbers. */
    year: { marginTop: Spacing.xl, alignSelf: 'stretch' },
    /** Sleep, workouts and awards, under the numbers. */
    more: { marginHorizontal: Spacing.xl, marginTop: Spacing.xxl, gap: Spacing.xxl },
    freezeSheet: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
});
