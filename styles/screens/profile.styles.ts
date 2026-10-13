import { StyleSheet } from 'react-native';
import { FontFamily } from '@/constants/DesignSystem';
import { ms, s, vs } from '@/constants/Layout';

/** The look of app/(root)/profile.tsx. Values are exactly what the screen used. */
export const styles = StyleSheet.create({
    // The banner runs to both edges, so the page's padding cannot apply to it.
    content: { paddingBottom: vs(40), gap: vs(12) },
    // Half on the banner, half off it: the overlap is what makes it a profile
    // rather than a photograph with a card under it.
    // No box: a bio reads as a sentence about someone, not as a filled field.
    removeRow: { flexDirection: 'row', gap: s(16), paddingTop: vs(4) },
    removeText: { fontSize: ms(12), fontFamily: FontFamily.medium },
    footnote: { fontSize: ms(11), lineHeight: ms(16), fontFamily: FontFamily.regular, textAlign: 'center', marginTop: vs(8), marginHorizontal: s(20) },
});
