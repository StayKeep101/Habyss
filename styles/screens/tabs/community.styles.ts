import { StyleSheet } from 'react-native';
import { FontFamily, Radius, Spacing, Typography } from '@/theme/designSystem';

/** The look of app/(root)/(tabs)/community.tsx. */
export const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
    headerTitle: Typography.screenTitle,
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    rank: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2, height: 40, paddingHorizontal: Spacing.md },
    rankText: { fontFamily: FontFamily.bold, fontSize: 14, fontVariant: ['tabular-nums'] },
    block: { marginBottom: Spacing.xxl },
    /** The race behind everything, from the top of the screen. */
    race: { position: 'absolute', top: 0, left: 0, right: 0 },
    /** The buttons, over the race and the page. */
    /** The top-right buttons, cut off by the page's edge as it slides over them (overflow hidden). */
    actions: { position: 'absolute', zIndex: 10, overflow: 'hidden' },
    /** Today and Challenges side by side, each as tall as itself. */
    pages: { flexDirection: 'row', alignItems: 'flex-start' },
    /** The top of a page resting over the race: rounded, with a grabber. */
    sheetTop: {
        borderTopLeftRadius: Radius.sheet, borderTopRightRadius: Radius.sheet, borderTopWidth: StyleSheet.hairlineWidth,
        paddingTop: Spacing.sm,
    },
    grabber: { alignSelf: 'center', width: Spacing.xxl + Spacing.md, height: Spacing.xs + 1, borderRadius: Radius.pill },
    /** Confetti over the feed when a perfect day is cheered. */
    cheer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
    requests: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },
    requestRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm + 2 },
    requestName: { flex: 1, fontFamily: FontFamily.semibold, fontSize: 15 },
    empty: { alignItems: 'center', paddingVertical: Spacing.section, gap: Spacing.sm },
    emptyText: { fontFamily: FontFamily.regular, fontSize: 14, textAlign: 'center', lineHeight: 20 },
    emptyLink: { fontFamily: FontFamily.semibold, fontSize: 14 },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    more: { paddingVertical: Spacing.lg },
    offlineContent: { flexGrow: 1 },
    offline: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.section * 3 },
    offlineTitle: { fontFamily: FontFamily.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.3, textAlign: 'center' },
    offlineText: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
