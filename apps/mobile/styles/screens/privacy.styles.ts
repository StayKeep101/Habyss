import { StyleSheet } from 'react-native';
import { FontFamily, UIStyles, Radius, Spacing } from '@/theme/designSystem';

/** The look of app/(root)/privacy.tsx. Values are exactly what the screen used. */
export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: { ...UIStyles.screenContent, gap: Spacing.xxl },
  sectionTitle: UIStyles.sectionTitle,
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
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 8,
  },
  dangerText: {
    fontSize: 15,
    fontFamily: FontFamily.semibold,
  },
});
