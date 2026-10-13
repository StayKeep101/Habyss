import { StyleSheet } from 'react-native';
import { FontFamily, UIStyles, Radius } from '@/constants/DesignSystem';

/** The look of app/(root)/notifications.tsx. Values are exactly what the screen used. */
export const styles = StyleSheet.create({
  detail: { paddingHorizontal: 16, paddingBottom: 16, fontSize: 12, lineHeight: 18, fontFamily: FontFamily.regular },
  preview: { marginHorizontal: 16, marginBottom: 12, padding: 13, borderRadius: 14, gap: 6 },
  previewTime: { fontSize: 9, letterSpacing: 0.8, fontFamily: FontFamily.medium },
  previewTitle: { fontSize: 13, fontFamily: FontFamily.medium },
  previewBody: { fontSize: 12, lineHeight: 18, fontFamily: FontFamily.regular },
  echoLink: { padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  container: {
    flex: 1,
  },
  content: { ...UIStyles.screenContent,

    gap: 16,
   },
  card: {
    borderRadius: Radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  textContent: {
    flex: 1,
  },
  label: {
    fontSize: 15,
    fontFamily: FontFamily.semibold,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
});
