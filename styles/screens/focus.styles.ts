import { StyleSheet } from 'react-native';
import { FontFamily, Spacing } from '@/theme/designSystem';

/**
 * The look of app/(root)/focus.tsx. Pure black while running: on an OLED
 * screen black pixels are off, which is most of the screen for hours.
 */
export const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#000000' },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl },
    title: { flex: 1, fontFamily: FontFamily.semibold, fontSize: 16, textAlign: 'center', color: '#FFFFFF' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
    setup: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.lg },
    setupTitle: { fontFamily: FontFamily.bold, fontSize: 28, color: '#FFFFFF', textAlign: 'center' },
    hint: { fontFamily: FontFamily.regular, fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },
    doneTitle: { fontFamily: FontFamily.bold, fontSize: 30, color: '#FFFFFF', textAlign: 'center' },
    doneSub: { fontFamily: FontFamily.medium, fontSize: 16, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: Spacing.sm },
});
