import { StyleSheet } from 'react-native';
import { FontFamily, UIStyles } from '@/theme/designSystem';

/** The look of app/(root)/account.tsx. Values are exactly what the screen used. */
export const styles = StyleSheet.create({
    providerButton: { height: 50, alignSelf: 'stretch', marginTop: 12 },
    google: { borderRadius: 999, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    googleText: { fontSize: 16, fontFamily: FontFamily.medium },
    divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, marginBottom: 4 },
    dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
    dividerText: { fontSize: 12, fontFamily: FontFamily.regular },
    content: { ...UIStyles.screenContent,   gap: 12  },
    card: { padding: 18, gap: 6, marginBottom: 8 },
    cardTitle: { fontSize: 17, fontFamily: FontFamily.semibold, marginTop: 6 },
    cardBody: { fontSize: 13, lineHeight: 19, fontFamily: FontFamily.regular },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    codeInput: { fontSize: 22, letterSpacing: 6, textAlign: 'center', fontFamily: FontFamily.semibold }, // ui-allow: a one-time code reads digit by digit
    secondary: { paddingVertical: 14, alignItems: 'center' },
    secondaryText: { fontSize: 14, fontFamily: FontFamily.medium },
    note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 8 },
    noteText: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: FontFamily.regular },
});
