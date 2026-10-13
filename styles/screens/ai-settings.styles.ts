import { StyleSheet } from 'react-native';
import { FontFamily, UIStyles } from '@/theme/designSystem';

/** The look of app/(root)/ai-settings.tsx. Values are exactly what the screen used. */
export const styles = StyleSheet.create({
    sample: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, marginTop: 6 },
    sampleMark: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    sampleText: { flex: 1, fontSize: 14, lineHeight: 20, fontFamily: FontFamily.regular, fontStyle: 'italic' },
    group: { marginTop: 22 },
    gridTitle: { marginTop: 22, marginBottom: 8 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tile: { width: '48.8%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 14, borderRadius: 14, borderWidth: 1 },
    tileLabel: { flex: 1, fontSize: 14, fontFamily: FontFamily.semibold },
    groupTitle: { fontSize: 11, letterSpacing: 1.2, fontFamily: FontFamily.medium, marginLeft: 4 },
    groupHint: { fontSize: 12, fontFamily: FontFamily.regular, marginTop: 3, marginBottom: 8, marginLeft: 4 },
    groupCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
    divider: { height: StyleSheet.hairlineWidth, marginLeft: 46 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
    rowText: { flex: 1, gap: 2 },
    rowLabel: { fontSize: 15, fontFamily: FontFamily.regular },
    rowDetail: { fontSize: 12, fontFamily: FontFamily.regular },
    rowValue: { fontSize: 14, fontFamily: FontFamily.medium, fontVariant: ['tabular-nums'] },
    switch: { width: 44, height: 26, borderRadius: 13, padding: 3, justifyContent: 'center' },
    knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
    manage: { marginTop: 28, alignItems: 'center' },
    container: { flex: 1 },
    content: { ...UIStyles.screenContent },
    sectionTitle: UIStyles.sectionTitle,
    sectionDesc: UIStyles.sectionDescription,
    // 2x2 Grid for personalities
    emoji: { fontSize: 24 },
    // Greeting style cards
});
