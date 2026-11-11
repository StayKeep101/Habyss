import { StyleSheet } from 'react-native';
import { space } from '@/theme/tokens';

/** The look of app/(root)/appearance.tsx. */
export const styles = StyleSheet.create({
    /** The colour circles, set back while the app follows your rank. */
    dimmed: { opacity: 0.45 },
    content: { paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space['4xl'], gap: space['2xl'] },
    swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'center' },
    swatchRing: { padding: 3, borderRadius: 24, borderWidth: 2, borderColor: 'transparent' },
    swatchRingOn: { borderColor: '#FFFFFF' },
    swatch: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
