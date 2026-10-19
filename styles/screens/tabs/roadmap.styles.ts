import { StyleSheet } from 'react-native';
import { FontFamily, Spacing } from '@/theme/designSystem';

/** The look of app/(root)/(tabs)/roadmap.tsx. Values are exactly what the screen used. */
export const styles = StyleSheet.create({
    /** Timeline or List, under the day's plan. */
    viewSwitch: { marginBottom: Spacing.lg },
    // The filter icon that rises out of a pull past the top of the list.
    pullIcon: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', zIndex: 5 },
    pullDisc: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    dragOverlay: {
        ...StyleSheet.absoluteFill,
        zIndex: 30,
    },
    // The dragged item: a pill centred under the finger, with where it will
    // land written beneath it.
    dragFloat: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', gap: 6 },
    dragPill: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 8, paddingRight: 16, paddingVertical: 8, maxWidth: 260 },
    dragPreviewText: { flexShrink: 1, fontSize: 14, fontFamily: FontFamily.medium },
    dragHint: { fontSize: 12, fontFamily: FontFamily.medium },
    filterOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        gap: 12
    },
    filterText: {
        fontSize: 16,
        fontFamily: FontFamily.semibold
    },
    sortChip: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(128,128,128,0.2)',
        backgroundColor: 'rgba(128,128,128,0.05)',
    },
    sortText: {
        fontSize: 12,
        color: 'rgba(128,128,128,0.7)',
        fontFamily: FontFamily.semibold
    }
});
