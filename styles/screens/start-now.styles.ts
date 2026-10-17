import { StyleSheet } from 'react-native';
import { FontFamily, Radius, Spacing } from '@/theme/designSystem';

/** The look of app/(root)/start-now.tsx: one thing, one step, a clock. */
export const styles = StyleSheet.create({
    content: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, paddingBottom: Spacing.bottom, gap: Spacing.md },
    flex: { flex: 1 },
    lead: { fontFamily: FontFamily.regular, fontSize: 15, lineHeight: 21 },
    pick: { padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    pickText: { flex: 1, fontFamily: FontFamily.medium, fontSize: 15 },
    pickKind: { fontFamily: FontFamily.medium, fontSize: 12 },
    title: { fontFamily: FontFamily.bold, fontSize: 24, letterSpacing: -0.4 },
    stepCard: { padding: Spacing.lg, gap: Spacing.xs },
    stepLabel: { fontFamily: FontFamily.medium, fontSize: 12 },
    step: { fontFamily: FontFamily.semibold, fontSize: 18, lineHeight: 25 },
    label: { fontFamily: FontFamily.medium, fontSize: 12, marginTop: Spacing.sm },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    chipText: { fontFamily: FontFamily.medium, fontSize: 13 },
    tip: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20 },
    field: { fontFamily: FontFamily.regular, fontSize: 15 },
    clock: { fontFamily: FontFamily.bold, fontSize: 64, letterSpacing: -2, textAlign: 'center', fontVariant: ['tabular-nums'], marginTop: Spacing.xl },
    track: { height: 6, borderRadius: Radius.pill, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: Radius.pill },
    center: { textAlign: 'center' },
    plan: { fontFamily: FontFamily.semibold, fontSize: 17, lineHeight: 24 },
    crisis: { padding: Spacing.lg, gap: Spacing.sm },
    crisisTitle: { fontFamily: FontFamily.semibold, fontSize: 16 },
});
