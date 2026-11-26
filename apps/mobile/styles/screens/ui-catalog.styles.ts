import { StyleSheet } from 'react-native';
import { radius, space } from '@/theme/tokens';

/** The look of app/(root)/ui-catalog.tsx. */
export const styles = StyleSheet.create({
    content: { paddingHorizontal: space.xl, paddingBottom: space['4xl'] * 2 },
    intro: { gap: space.md, paddingTop: space.sm },
    wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    cardBody: { padding: space.lg, gap: space.xs },
    spaceBar: { height: space.md, borderRadius: radius.sm },
    radiusBox: { width: space['4xl'] * 1.5, height: space['4xl'] * 1.5 },
    shadowBox: { width: space['4xl'] * 2, height: space['4xl'] * 1.5, alignItems: 'center', justifyContent: 'center' },
    swipeBody: { padding: space.lg },
    motionTrack: { height: space.sm, borderRadius: radius.full, overflow: 'hidden' },
    motionFill: { height: '100%', borderRadius: radius.full },
    popCell: { width: space['2xl'], height: space['2xl'], borderRadius: radius.sm },
    /** Inside the sample bottom sheet: the same side margins as a real one. */
    sheetBody: { paddingHorizontal: space.xl, gap: space.md },
});
